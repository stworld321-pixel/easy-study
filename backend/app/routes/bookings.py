from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import logging
import asyncio
from pydantic import BaseModel
from app.models.booking import Booking, Review, BookingStatus, SessionType
from app.models.booking_slot import BookingSlot, SlotStatus
from app.models.availability import TutorAvailability
from app.models.tutor import TutorProfile
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingUpdate, BookingResponse, ReviewCreate, ReviewResponse, UtcDatetime
from app.routes.auth import get_current_user
from app.services.notification_service import notification_service
from app.services.payment_service import payment_service
from app.services.minio_service import minio_service
from app.services.email_service import email_service
from app.services.certificate_service import build_certificate_pdf
from app.core.config import settings
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from datetime import tzinfo
from uuid import uuid4
from jose import jwt as jose_jwt
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

router = APIRouter()
logger = logging.getLogger(__name__)
MEET_LINK_EXPIRE_GRACE_MINUTES = 15
EFFECTIVE_MIN_NOTICE_HOURS = 1
WORKSHOP_CERTIFICATE_GRACE_MINUTES = 30


def _build_jitsi_room_name(booking: Booking) -> str:
    if booking.meeting_room_key:
        return booking.meeting_room_key.lower()
    if booking.session_type == SessionType.GROUP:
        slot_key = booking.scheduled_at.strftime("%Y%m%d%H%M")
        return f"zealcatalyst-group-{booking.tutor_id}-{slot_key}-{booking.duration_minutes}".lower()
    return f"zealcatalyst-private-{str(booking.id)}".lower()


def _build_in_app_meeting_link(booking: Booking) -> str:
    base = (settings.FRONTEND_URL or "").rstrip("/")
    if not base:
        base = "http://localhost:5173"
    return f"{base}/meeting/{booking.id}"


def _is_workshop_booking(booking: Booking) -> bool:
    # Explicit flag preferred; fallback to non-empty group session name for backward compatibility.
    if getattr(booking, "is_workshop", False):
        return True
    return booking.session_type == SessionType.GROUP and bool((booking.session_name or "").strip())


def _dispatch_background(coro, context: str) -> None:
    async def _runner():
        try:
            await coro
        except Exception:
            logger.exception("Background task failed (%s)", context)

    asyncio.create_task(_runner())


def _role_value(role: object) -> str:
    return getattr(role, "value", role)

def _safe_zoneinfo(timezone_name: str | None) -> tzinfo:
    tz_name = (timezone_name or "UTC").strip() or "UTC"
    try:
        return ZoneInfo(tz_name)
    except Exception:
        try:
            return ZoneInfo("UTC")
        except Exception:
            return timezone.utc


async def _get_tutor_timezone_name(tutor_id: str) -> Optional[str]:
    """Return the IANA timezone string configured on the tutor's
    availability doc, or None if unset. Used to format dates in emails
    and notifications so the reader sees a clock that matches the zone
    the session was scheduled in."""
    availability = await TutorAvailability.find_one(TutorAvailability.tutor_id == tutor_id)
    if not availability:
        return None
    name = (availability.timezone or "").strip()
    return name or None


async def _get_booking_access(booking: Booking, current_user: User) -> tuple[bool, bool]:
    is_student = booking.student_id == str(current_user.id)

    role_value = _role_value(current_user.role)
    is_tutor_owner = booking.tutor_id == str(current_user.id)
    if role_value == "tutor":
        tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
        if tutor:
            is_tutor_owner = is_tutor_owner or (str(tutor.id) == booking.tutor_id)

    return is_student, is_tutor_owner


async def _resolve_booking_for_current_user(
    requested_booking: Booking,
    current_user: User,
) -> tuple[Booking, bool, bool]:
    """
    Resolve booking context for shared group/workshop links.
    - If user already owns requested booking => return it.
    - If requested booking is group/workshop and user is a booked participant in same slot,
      return user's own booking so access remains login+booking scoped.
    """
    is_student, is_tutor_owner = await _get_booking_access(requested_booking, current_user)
    if is_student or is_tutor_owner:
        return requested_booking, is_student, is_tutor_owner

    if requested_booking.session_type != SessionType.GROUP:
        raise HTTPException(status_code=403, detail="Not authorized")

    participant_booking = await Booking.find_one({
        "student_id": str(current_user.id),
        "tutor_id": requested_booking.tutor_id,
        "session_type": SessionType.GROUP.value,
        "scheduled_at": requested_booking.scheduled_at,
        "duration_minutes": requested_booking.duration_minutes,
        "status": BookingStatus.CONFIRMED.value,
    })

    if not participant_booking:
        raise HTTPException(status_code=403, detail="Not authorized")

    is_student, is_tutor_owner = await _get_booking_access(participant_booking, current_user)
    return participant_booking, is_student, is_tutor_owner


def _jaas_enabled() -> bool:
    return bool(
        (settings.JAAS_APP_ID or "").strip()
        and (settings.JAAS_KID or "").strip()
        and (settings.JAAS_PRIVATE_KEY or "").strip()
    )


def _load_jaas_private_key() -> str:
    """Return the JaaS RSA private key as a PEM string. Accepts either inline PEM
    (with literal \\n in .env) or a filesystem path to a .pem file."""
    raw = (settings.JAAS_PRIVATE_KEY or "").strip()
    if not raw:
        return ""
    if raw.startswith("-----BEGIN"):
        return raw.replace("\\n", "\n")
    # treat as path
    try:
        with open(raw, "r", encoding="utf-8") as fh:
            return fh.read()
    except OSError:
        return raw.replace("\\n", "\n")


def _build_jaas_token(
    room_name: str,
    user: User,
    is_moderator: bool,
) -> Optional[str]:
    """Build a JaaS-compatible RS256 JWT. Tutors get moderator=true; everyone else false.
    The JWT is what makes the staff/tutor the room admin — JaaS enforces it server-side,
    so first-joiner-becomes-moderator no longer applies."""
    private_key = _load_jaas_private_key()
    if not private_key:
        return None

    now = datetime.utcnow()
    exp = now + timedelta(minutes=max(15, int(settings.JITSI_TOKEN_TTL_MINUTES or 180)))
    app_id = settings.JAAS_APP_ID.strip()
    payload = {
        "aud": "jitsi",
        "iss": "chat",
        "sub": app_id,
        # JaaS expects the room to be either "*" or "<appId>/<room>". "*" lets a single
        # token work across rooms; we still scope it via context.user.
        "room": "*",
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()) - 30,
        "exp": int(exp.timestamp()),
        "context": {
            "user": {
                "id": str(user.id),
                "name": user.full_name or "User",
                "email": user.email or "",
                "avatar": "",
                "moderator": "true" if is_moderator else "false",
            },
            "features": {
                "livestreaming": "true" if is_moderator else "false",
                "recording": "true" if is_moderator else "false",
                "transcription": "true" if is_moderator else "false",
                "outbound-call": "true" if is_moderator else "false",
            },
            "room": {
                "regex": False,
            },
        },
    }
    headers = {"kid": settings.JAAS_KID.strip(), "typ": "JWT"}
    return jose_jwt.encode(payload, private_key, algorithm="RS256", headers=headers)


def _build_jitsi_access_token(
    room_name: str,
    booking: Booking,
    user: User,
    is_moderator: bool,
) -> Optional[str]:
    # Prefer JaaS (8x8.vc) when configured — it actually enforces moderator via JWT.
    if _jaas_enabled():
        return _build_jaas_token(room_name=room_name, user=user, is_moderator=is_moderator)

    # Self-hosted Jitsi fallback (HS256 with prosody token auth).
    secret = (settings.JITSI_APP_SECRET or "").strip()
    if not secret:
        return None

    now = datetime.utcnow()
    exp = now + timedelta(minutes=max(15, int(settings.JITSI_TOKEN_TTL_MINUTES or 180)))
    affiliation = "owner" if is_moderator else "member"
    payload = {
        "aud": settings.JITSI_TOKEN_AUDIENCE,
        "iss": settings.JITSI_TOKEN_ISSUER,
        "sub": settings.JITSI_DOMAIN,
        "room": room_name,
        "nbf": int(now.timestamp()) - 30,
        "exp": int(exp.timestamp()),
        "booking_id": str(booking.id),
        "session_type": booking.session_type.value if hasattr(booking.session_type, "value") else str(booking.session_type),
        "tutor_id": booking.tutor_id,
        "student_id": booking.student_id,
        "context": {
            "user": {
                "id": str(user.id),
                "name": user.full_name or "User",
                "email": user.email or "",
                "moderator": is_moderator,
                "affiliation": affiliation,
            }
        },
        "moderator": is_moderator,
        "affiliation": affiliation,
    }
    return jose_jwt.encode(payload, secret, algorithm="HS256")


def _meeting_jwt_required() -> bool:
    # The app should never fall back to anonymous room access for real sessions.
    return bool(
        _jaas_enabled()
        or (settings.JITSI_APP_SECRET or "").strip()
        or bool(settings.JITSI_REQUIRE_JWT)
    )


def _resolve_meeting_domain_and_room(room_key: str) -> tuple[str, str, str]:
    """Return (domain, room_name_for_client, meeting_url). When JaaS is enabled,
    the room name is namespaced under the AppID and the domain switches to 8x8.vc."""
    if _jaas_enabled():
        domain = (settings.JAAS_DOMAIN or "8x8.vc").strip()
        room_name = f"{settings.JAAS_APP_ID.strip()}/{room_key}"
        return domain, room_name, f"https://{domain}/{room_name}"
    domain = settings.JITSI_DOMAIN
    return domain, room_key, f"https://{domain}/{room_key}"


def _to_utc_naive(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _meeting_link_expires_at(booking: Booking) -> Optional[datetime]:
    if not booking.meeting_link:
        return None
    start = _to_utc_naive(booking.scheduled_at)
    return start + timedelta(minutes=booking.duration_minutes + MEET_LINK_EXPIRE_GRACE_MINUTES)


def _meeting_join_available_at(booking: Booking) -> Optional[datetime]:
    if not booking.meeting_link:
        return None
    start = _to_utc_naive(booking.scheduled_at)
    return start - timedelta(minutes=15)


def _workshop_certificate_ready_at(booking: Booking) -> Optional[datetime]:
    if not _is_workshop_booking(booking):
        return None
    start = _to_utc_naive(booking.scheduled_at)
    return start + timedelta(minutes=booking.duration_minutes + WORKSHOP_CERTIFICATE_GRACE_MINUTES)


def _is_meeting_link_expired(booking: Booking) -> bool:
    expires_at = _meeting_link_expires_at(booking)
    if not expires_at:
        return False
    return datetime.utcnow() > expires_at


async def _ensure_completion_certificate_for_booking(booking: Booking) -> Optional[str]:
    """Create completion certificate once per booking and return URL."""
    if not _is_workshop_booking(booking):
        return None
    if booking.status != BookingStatus.COMPLETED:
        return None

    from app.models.material import CompletionCertificate

    existing = await CompletionCertificate.find_one(CompletionCertificate.booking_id == str(booking.id))
    if existing:
        return existing.file_url

    student = await User.get(booking.student_id)
    if not student:
        return None

    tutor_name = booking.tutor_name or "Tutor"
    tutor_signature_url = None
    tutor_signature_bytes = None
    try:
        tutor_profile = await TutorProfile.get(booking.tutor_id)
        if tutor_profile and tutor_profile.signature_image_url:
            tutor_signature_url = tutor_profile.signature_image_url
            try:
                tutor_signature_bytes = minio_service.get_file_bytes(tutor_signature_url)
            except Exception:
                tutor_signature_bytes = None
    except Exception:
        tutor_signature_url = None
        tutor_signature_bytes = None

    session_date = booking.scheduled_at
    certificate_number = f"ZC-{session_date.strftime('%Y%m%d')}-{str(student.id)[-6:].upper()}-{str(booking.id)[-4:].upper()}"
    cert_tz_name = await _get_tutor_timezone_name(booking.tutor_id)
    pdf_bytes = build_certificate_pdf(
        student_name=student.full_name or "Student",
        tutor_name=tutor_name,
        subject=booking.subject or "Session",
        session_date=session_date,
        certificate_number=certificate_number,
        session_name=booking.session_name,
        tutor_signature_url=tutor_signature_url,
        tutor_signature_bytes=tutor_signature_bytes,
        timezone_name=cert_tz_name,
    )
    file_name = f"completion-certificate-{booking.id}.pdf"
    upload_result = minio_service.upload_bytes(
        file_data=pdf_bytes,
        filename=file_name,
        folder=f"certificates/{student.id}",
        content_type="application/pdf",
    )
    if not upload_result or not upload_result.get("url"):
        return None

    certificate = CompletionCertificate(
        student_id=str(student.id),
        student_name=student.full_name or "Student",
        tutor_id=booking.tutor_id,
        tutor_name=tutor_name,
        booking_id=str(booking.id),
        subject=booking.subject or "Session",
        session_name=booking.session_name,
        session_date=session_date,
        certificate_number=certificate_number,
        file_url=upload_result["url"],
        file_name=file_name,
    )
    await certificate.insert()

    if student.email:
        _dispatch_background(
            email_service.send_email(
                to_email=student.email,
                subject="Your Session Completion Certificate is Ready",
                html_content=email_service._base_template(
                    f"""
                    <h2 style=\"color:#1f2937; margin:0 0 16px;\">Certificate Ready</h2>
                    <p style=\"color:#4b5563;\">Hi {student.full_name},</p>
                    <p style=\"color:#4b5563;\">Your session has been completed and your certificate is now available.</p>
                    <p style=\"color:#4b5563;\"><strong>Subject:</strong> {booking.subject or 'Session'}</p>
                    <p style=\"color:#4b5563;\"><strong>Tutor:</strong> {tutor_name}</p>
                    <p style=\"color:#4b5563;\"><strong>Certificate No:</strong> {certificate_number}</p>
                    <div style=\"text-align:center;\">
                        <a href=\"{upload_result['url']}\"
                           style=\"display:inline-block; background:#2563eb; color:white; text-decoration:none; padding:12px 20px; border-radius:8px;\">
                           Download Certificate
                        </a>
                    </div>
                    """
                ),
                plain_content=f"Your certificate is ready. Download: {upload_result['url']}",
            ),
            "booking_completion_certificate_email",
        )

    return upload_result["url"]


async def _maybe_generate_workshop_certificate_after_grace(booking: Booking) -> Optional[str]:
    """Generate workshop certificate only after the grace period has passed."""
    ready_at = _workshop_certificate_ready_at(booking)
    if not ready_at or datetime.utcnow() < ready_at:
        return None
    return await _ensure_completion_certificate_for_booking(booking)


async def _schedule_workshop_certificate_issue(booking_id: str) -> None:
    """Fire-and-forget scheduler for workshop certificates after session end + grace."""
    async def _runner():
        try:
            booking = await Booking.get(booking_id)
            if not booking or not _is_workshop_booking(booking):
                return

            ready_at = _workshop_certificate_ready_at(booking)
            if not ready_at:
                return

            delay = max(0.0, (ready_at - datetime.utcnow()).total_seconds())
            if delay > 0:
                await asyncio.sleep(delay)

            booking = await Booking.get(booking_id)
            if not booking or booking.status == BookingStatus.CANCELLED:
                return

            if booking.status != BookingStatus.COMPLETED:
                booking.status = BookingStatus.COMPLETED
                booking.updated_at = datetime.utcnow()
                await booking.save()

            await _ensure_completion_certificate_for_booking(booking)
        except Exception:
            logger.exception("Failed to schedule workshop certificate for booking %s", booking_id)

    asyncio.create_task(_runner())


async def _auto_complete_if_past(booking: Booking) -> bool:
    """Mark confirmed booking completed once session end time has passed."""
    if booking.status != BookingStatus.CONFIRMED:
        return False

    end_time = _to_utc_naive(booking.scheduled_at) + timedelta(minutes=booking.duration_minutes)
    if datetime.utcnow() < end_time:
        return False

    booking.status = BookingStatus.COMPLETED
    booking.updated_at = datetime.utcnow()
    await booking.save()
    return True


def _get_booking_slot_collection():
    """
    Beanie compatibility helper:
    - v1/v2 environments may expose either get_motor_collection() or get_pymongo_collection().
    """
    getter = getattr(BookingSlot, "get_motor_collection", None) or getattr(BookingSlot, "get_pymongo_collection", None)
    if getter is None:
        raise RuntimeError("BookingSlot collection accessor is unavailable")
    return getter()


def create_booking_response(b: Booking) -> BookingResponse:
    """Helper to create BookingResponse from Booking model"""
    expires_at = _meeting_link_expires_at(b)
    expired = _is_meeting_link_expired(b)
    safe_meeting_link = None if expired else b.meeting_link

    return BookingResponse(
        id=str(b.id),
        student_id=b.student_id,
        tutor_id=b.tutor_id,
        student_name=b.student_name,
        tutor_name=b.tutor_name,
        student_email=b.student_email,
        tutor_email=b.tutor_email,
        subject=b.subject,
        session_type=b.session_type,
        scheduled_at=b.scheduled_at,
        duration_minutes=b.duration_minutes,
        price=b.price,
        currency=b.currency,
        session_name=b.session_name,
        is_workshop=bool(getattr(b, "is_workshop", False)),
        status=b.status,
        notes=b.notes,
        meeting_link=safe_meeting_link,
        meeting_room_key=b.meeting_room_key,
        meeting_provider=b.meeting_provider,
        meeting_origin=b.meeting_origin,
        meeting_link_expires_at=expires_at,
        meeting_link_expired=expired,
        google_event_id=b.google_event_id,
        created_at=b.created_at
    )


async def _ensure_meeting_room_key(booking: Booking) -> str:
    """
    Ensure booking has a stable, unguessable Jitsi room key.
    - Private: unique random room per booking.
    - Group: shared random room across same tutor+timeslot.
    """
    if booking.meeting_room_key:
        return booking.meeting_room_key

    if _is_workshop_booking(booking):
        workshop_key_source = ""
        if booking.notes and "workshop booking:" in booking.notes.lower():
            try:
                workshop_key_source = booking.notes.split(":", 1)[1].strip()
            except Exception:
                workshop_key_source = ""
        workshop_key_source = workshop_key_source or (booking.session_name or booking.subject or str(booking.id))
        booking.meeting_room_key = f"zc-w-{workshop_key_source}".lower().replace(" ", "-")
        booking.updated_at = datetime.utcnow()
        await booking.save()
        return booking.meeting_room_key

    if booking.session_type == SessionType.GROUP:
        sibling = await Booking.find_one({
            "_id": {"$ne": booking.id},
            "tutor_id": booking.tutor_id,
            "session_type": SessionType.GROUP.value,
            "scheduled_at": booking.scheduled_at,
            "duration_minutes": booking.duration_minutes,
            "status": BookingStatus.CONFIRMED.value,
            "meeting_room_key": {"$ne": None},
        })
        if sibling and sibling.meeting_room_key:
            booking.meeting_room_key = sibling.meeting_room_key
        else:
            booking.meeting_room_key = f"zc-g-{uuid4().hex}"
    else:
        booking.meeting_room_key = f"zc-p-{uuid4().hex}"

    booking.updated_at = datetime.utcnow()
    await booking.save()
    return booking.meeting_room_key


class MeetingAccessResponse(BaseModel):
    booking_id: str
    room_name: str
    domain: str
    launch_url: str
    is_moderator: bool
    # Email of the tutor for this booking. Exposed so clients can
    # recognize the tutor in the participant list for moderator-related
    # UX (e.g. the "waiting for tutor to reconnect" banner).
    tutor_email: Optional[str] = None
    jwt: Optional[str] = None
    join_available_at: Optional[UtcDatetime] = None
    join_expires_at: Optional[UtcDatetime] = None
    feedback_allowed_at: Optional[UtcDatetime] = None
    certificate_ready_at: Optional[UtcDatetime] = None


class JitsiTestAccessResponse(BaseModel):
    room_name: str
    domain: str
    launch_url: str
    is_moderator: bool
    jwt: Optional[str] = None


class SessionNameUpdate(BaseModel):
    session_name: str


# Currency conversion rate (INR to USD)
INR_TO_USD_RATE = 0.012
MIN_ORDER_AMOUNT = 1.0


async def _get_group_capacity(tutor: TutorProfile) -> int:
    # Prefer availability setting; fallback to tutor override/default.
    availability = await TutorAvailability.find_one(TutorAvailability.tutor_id == str(tutor.id))
    raw = getattr(availability, "group_session_capacity", None)
    if raw is None:
        raw = getattr(tutor, "group_capacity", 10)
    try:
        value = int(raw)
    except Exception:
        value = 10
    return max(1, value)


async def _reserve_slot(
    tutor: TutorProfile,
    booking_data: BookingCreate,
    capacity_override: Optional[int] = None,
) -> None:
    """
    Atomically reserve one seat in tutor slot.
    Enforces:
    - single slot definition per tutor+time+duration (cross-type conflict prevention)
    - private capacity=1
    - group capacity=N
    """
    slot_filter = {
        "tutor_id": booking_data.tutor_id,
        "scheduled_at": booking_data.scheduled_at,
        "duration_minutes": booking_data.duration_minutes,
    }

    collection = _get_booking_slot_collection()
    capacity = (
        max(1, int(capacity_override))
        if capacity_override is not None
        else (1 if booking_data.session_type == SessionType.PRIVATE else await _get_group_capacity(tutor))
    )

    for _ in range(3):
        slot = await BookingSlot.find_one(slot_filter)
        if slot:
            if slot.session_type != booking_data.session_type:
                raise HTTPException(
                    status_code=400,
                    detail="This slot is already booked under another session type."
                )

            updated = await collection.find_one_and_update(
                {
                    "_id": slot.id,
                    "booked_count": {"$lt": slot.capacity},
                },
                {
                    "$inc": {"booked_count": 1},
                    "$set": {"updated_at": datetime.utcnow()},
                },
                return_document=ReturnDocument.AFTER,
            )

            if updated:
                status_value = SlotStatus.FULL.value if updated["booked_count"] >= updated["capacity"] else SlotStatus.OPEN.value
                await collection.update_one({"_id": slot.id}, {"$set": {"status": status_value}})
                return

            if slot.session_type == SessionType.PRIVATE:
                raise HTTPException(
                    status_code=400,
                    detail="This private slot is already booked. Please choose another time."
                )
            raise HTTPException(
                status_code=400,
                detail="This group slot is full. Please choose another time."
            )

        # Backfill support for old data: if bookings exist without slot doc, initialize counts from active bookings.
        active_bookings = await Booking.find({
            "tutor_id": booking_data.tutor_id,
            "scheduled_at": booking_data.scheduled_at,
            "duration_minutes": booking_data.duration_minutes,
            "status": {"$in": [BookingStatus.PENDING.value, BookingStatus.CONFIRMED.value]},
        }).to_list()

        if active_bookings:
            existing_types = {b.session_type.value if hasattr(b.session_type, "value") else str(b.session_type) for b in active_bookings}
            if booking_data.session_type.value not in existing_types or len(existing_types) > 1:
                raise HTTPException(
                    status_code=400,
                    detail="This slot is already booked under another session type."
                )
            if len(active_bookings) >= capacity:
                message = "This private slot is already booked. Please choose another time." if booking_data.session_type == SessionType.PRIVATE else "This group slot is full. Please choose another time."
                raise HTTPException(status_code=400, detail=message)
            initial_count = len(active_bookings) + 1
        else:
            initial_count = 1

        try:
            slot = BookingSlot(
                tutor_id=booking_data.tutor_id,
                scheduled_at=booking_data.scheduled_at,
                duration_minutes=booking_data.duration_minutes,
                session_type=booking_data.session_type,
                capacity=capacity,
                booked_count=initial_count,
                status=SlotStatus.FULL if initial_count >= capacity else SlotStatus.OPEN,
            )
            await slot.insert()
            return
        except DuplicateKeyError:
            # Race on create; retry loop.
            continue

    raise HTTPException(status_code=409, detail="Could not reserve slot. Please retry.")


async def _release_slot(tutor_id: str, scheduled_at: datetime, duration_minutes: int) -> None:
    collection = _get_booking_slot_collection()
    slot = await BookingSlot.find_one({
        "tutor_id": tutor_id,
        "scheduled_at": scheduled_at,
        "duration_minutes": duration_minutes,
    })
    if not slot:
        return

    updated = await collection.find_one_and_update(
        {"_id": slot.id, "booked_count": {"$gt": 0}},
        {"$inc": {"booked_count": -1}, "$set": {"updated_at": datetime.utcnow()}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        return

    status_value = SlotStatus.FULL.value if updated["booked_count"] >= updated["capacity"] else SlotStatus.OPEN.value
    await collection.update_one({"_id": slot.id}, {"$set": {"status": status_value}})

@router.post("", response_model=BookingResponse)
async def create_booking(
    booking_data: BookingCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new booking request"""
    is_workshop_flow = "workshop booking:" in (booking_data.notes or "").lower()
    workshop_id: Optional[str] = None
    workshop = None
    if is_workshop_flow:
        try:
            raw = (booking_data.notes or "").split(":", 1)[1].strip()
            workshop_id = raw or None
        except Exception:
            workshop_id = None

        if workshop_id:
            from app.models.workshop import Workshop
            workshop = await Workshop.get(workshop_id)
            if not workshop or not workshop.is_active:
                raise HTTPException(status_code=400, detail="Workshop not found or inactive.")
    if booking_data.session_type == SessionType.GROUP:
        if not is_workshop_flow:
            raise HTTPException(
                status_code=400,
                detail="Group sessions are currently disabled. Please book a private session."
            )

    tutor = await TutorProfile.get(booking_data.tutor_id)
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found")

    current_user_tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if current_user_tutor and str(current_user_tutor.id) == booking_data.tutor_id:
        raise HTTPException(status_code=403, detail="Tutors cannot book their own sessions.")

    availability = await TutorAvailability.find_one(TutorAvailability.tutor_id == booking_data.tutor_id)
    tutor_tz = _safe_zoneinfo(getattr(availability, "timezone", None))
    now_in_tutor_tz = datetime.now(tutor_tz)
    min_notice_cutoff = now_in_tutor_tz

    # Normalize incoming scheduled_at to naive UTC (our storage convention).
    # - Timezone-aware input (the new frontend contract — ISO string with 'Z' or offset):
    #     convert to UTC and drop tzinfo.
    # - Timezone-naive input (legacy clients): fall back to treating it as tutor-local
    #     wall time, then convert to UTC so both paths store the same instant.
    raw_scheduled_at = booking_data.scheduled_at
    if raw_scheduled_at.tzinfo is None:
        aware_scheduled_at = raw_scheduled_at.replace(tzinfo=tutor_tz)
    else:
        aware_scheduled_at = raw_scheduled_at.astimezone(timezone.utc)

    normalized_scheduled_at = aware_scheduled_at.astimezone(timezone.utc).replace(tzinfo=None)
    # Keep the canonical UTC value on the request object so every downstream
    # use (slot reservation, duplicate check, booking insert, notifications)
    # sees the same instant.
    booking_data.scheduled_at = normalized_scheduled_at

    scheduled_at_in_tutor_tz = aware_scheduled_at.astimezone(tutor_tz)
    if scheduled_at_in_tutor_tz.date() < min_notice_cutoff.date():
        raise HTTPException(
            status_code=400,
            detail="This session date is closed for booking."
        )

    # Reserve tutor slot atomically (capacity + cross-type conflict guards).
    await _reserve_slot(
        tutor,
        booking_data,
        capacity_override=(workshop.max_participants if workshop else None),
    )

    # Prevent duplicate active bookings for the same slot by the same student.
    existing_booking = await Booking.find_one({
        "student_id": str(current_user.id),
        "tutor_id": booking_data.tutor_id,
        "session_type": booking_data.session_type.value,
        "scheduled_at": booking_data.scheduled_at,
        "duration_minutes": booking_data.duration_minutes,
        "status": {"$ne": BookingStatus.CANCELLED.value}
    })
    if existing_booking:
        raise HTTPException(status_code=400, detail="You already booked this timeslot.")

    if workshop:
        base_amount = float(workshop.amount or 0)
        workshop_currency = (workshop.currency or "INR").upper()
        if booking_data.currency == workshop_currency:
            session_price = round(base_amount, 2)
        elif workshop_currency == "INR" and booking_data.currency == "USD":
            session_price = round(base_amount * INR_TO_USD_RATE, 2)
        elif workshop_currency == "USD" and booking_data.currency == "INR":
            session_price = round(base_amount / INR_TO_USD_RATE, 2)
        else:
            session_price = round(base_amount, 2)
    else:
        # Get the correct hourly rate based on session type
        if booking_data.session_type.value == "group":
            # Use group rate if available, otherwise calculate 60% of private rate
            hourly_rate = tutor.group_hourly_rate if tutor.group_hourly_rate else tutor.hourly_rate * 0.6
        else:
            hourly_rate = tutor.hourly_rate

        # Calculate session price in INR (base currency)
        session_price_inr = hourly_rate * (booking_data.duration_minutes / 60)

        # Convert to requested currency if needed
        if booking_data.currency == "USD":
            session_price = round(session_price_inr * INR_TO_USD_RATE, 2)
        else:
            session_price = session_price_inr

    # Razorpay minimum order amount guard (prevents create-order failures later).
    if session_price < MIN_ORDER_AMOUNT:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Session amount ({booking_data.currency} {session_price:.2f}) is below minimum allowed "
                f"({booking_data.currency} {MIN_ORDER_AMOUNT:.2f}). Increase tutor rate or duration."
            )
        )

    booking = Booking(
        student_id=str(current_user.id),
        tutor_id=booking_data.tutor_id,
        subject=(workshop.title if workshop else booking_data.subject),
        session_type=booking_data.session_type,
        scheduled_at=booking_data.scheduled_at,
        duration_minutes=booking_data.duration_minutes,
        price=session_price,
        currency=booking_data.currency,
        notes=booking_data.notes,
        is_workshop=bool(workshop),
        session_name=(workshop.title if workshop else None),
        meeting_room_key=(f"zc-w-{workshop_id}".lower().replace(" ", "-") if workshop_id else None),
        student_name=current_user.full_name,
        tutor_name=tutor.full_name,
        student_email=current_user.email,
        tutor_email=tutor.email
    )
    try:
        await booking.insert()
    except Exception:
        # Roll back slot reservation on booking insert failure.
        await _release_slot(
            tutor_id=booking_data.tutor_id,
            scheduled_at=booking_data.scheduled_at,
            duration_minutes=booking_data.duration_minutes,
        )
        raise

    # Create payment record with fee calculation
    try:
        await payment_service.create_payment(
            booking_id=str(booking.id),
            student_id=str(current_user.id),
            tutor_id=booking_data.tutor_id,
            session_amount=session_price,
            currency=booking_data.currency
        )
    except Exception:
        logger.exception("Failed to create payment record for booking %s", booking.id)
        # Roll back booking + reserved slot when payment initialization fails.
        try:
            await booking.delete()
        finally:
            await _release_slot(
                tutor_id=booking_data.tutor_id,
                scheduled_at=booking_data.scheduled_at,
                duration_minutes=booking_data.duration_minutes,
            )
        raise HTTPException(
            status_code=500,
            detail="Unable to initialize payment for this booking. Please try again."
        )

    # Notify tutor immediately when booking is created (faster than waiting for payment verify).
    try:
        await notification_service.notify_new_booking(
            tutor_user_id=tutor.user_id,
            student_name=current_user.full_name,
            student_id=str(current_user.id),
            subject=booking.subject,
            booking_id=str(booking.id),
            scheduled_at=booking.scheduled_at,
            timezone_name=(availability.timezone if availability else None),
        )
    except Exception:
        logger.exception("Failed to send booking-created notification for booking %s", booking.id)

    return create_booking_response(booking)


@router.get("", response_model=List[BookingResponse])
async def get_my_bookings(current_user: User = Depends(get_current_user)):
    """Get all bookings for the current user (as student or tutor)"""
    tutor_profile = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    tutor_ids = [str(current_user.id)]
    if tutor_profile:
        tutor_ids.append(str(tutor_profile.id))

    bookings = await Booking.find(
        {"$or": [
            {"student_id": str(current_user.id)},
            {"tutor_id": {"$in": tutor_ids}}
        ]}
    ).sort("-created_at").to_list()

    for b in bookings:
        try:
            changed = await _auto_complete_if_past(b)
            if changed or b.status == BookingStatus.COMPLETED:
                if _is_workshop_booking(b):
                    await _maybe_generate_workshop_certificate_after_grace(b)
                else:
                    await _ensure_completion_certificate_for_booking(b)
        except Exception:
            logger.exception("Failed post-session processing for booking %s", b.id)

    return [create_booking_response(b) for b in bookings]


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking_by_id(booking_id: str, current_user: User = Depends(get_current_user)):
    booking = await Booking.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    resolved_booking, _, _ = await _resolve_booking_for_current_user(booking, current_user)
    try:
        changed = await _auto_complete_if_past(resolved_booking)
        if changed or resolved_booking.status == BookingStatus.COMPLETED:
            if _is_workshop_booking(resolved_booking):
                await _maybe_generate_workshop_certificate_after_grace(resolved_booking)
            else:
                await _ensure_completion_certificate_for_booking(resolved_booking)
    except Exception:
        logger.exception("Failed post-session processing for booking %s", resolved_booking.id)
    return create_booking_response(resolved_booking)


@router.get("/jitsi/test-access", response_model=JitsiTestAccessResponse)
async def get_jitsi_test_access(current_user: User = Depends(get_current_user)):
    """
    Generate a tutor-only Jitsi test room access.
    This helps tutors validate audio/video and moderator behavior before real sessions.
    """
    tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor:
        raise HTTPException(status_code=403, detail="Only tutors can use Jitsi test access.")

    room_key = f"zealcatalyst-test-{str(tutor.id)}-{uuid4().hex[:8]}".lower()
    domain, room_name, meeting_url = _resolve_meeting_domain_and_room(room_key)

    token = None
    if _jaas_enabled():
        token = _build_jaas_token(room_name=room_name, user=current_user, is_moderator=True)
    elif (settings.JITSI_APP_SECRET or "").strip():
        now = datetime.utcnow()
        exp = now + timedelta(minutes=max(15, int(settings.JITSI_TOKEN_TTL_MINUTES or 180)))
        payload = {
            "aud": settings.JITSI_TOKEN_AUDIENCE,
            "iss": settings.JITSI_TOKEN_ISSUER,
            "sub": settings.JITSI_DOMAIN,
            "room": room_name,
            "nbf": int(now.timestamp()) - 30,
            "exp": int(exp.timestamp()),
            "context": {
                "user": {
                    "id": str(current_user.id),
                    "name": current_user.full_name or "Tutor",
                    "email": current_user.email or "",
                    "moderator": True,
                    "affiliation": "owner",
                }
            },
            "moderator": True,
            "affiliation": "owner",
        }
        token = jose_jwt.encode(payload, settings.JITSI_APP_SECRET, algorithm="HS256")
    elif _meeting_jwt_required():
        raise HTTPException(
            status_code=503,
            detail="Jitsi JWT authentication is required but not configured. Set JITSI_APP_SECRET or JaaS credentials."
        )

    launch_url = f"{meeting_url}?jwt={token}" if token else meeting_url
    return JitsiTestAccessResponse(
        room_name=room_name,
        domain=domain,
        launch_url=launch_url,
        is_moderator=True,
        jwt=token,
    )


@router.get("/{booking_id}/meeting-access", response_model=MeetingAccessResponse)
async def get_meeting_access(booking_id: str, current_user: User = Depends(get_current_user)):
    booking = await Booking.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking, is_student, is_tutor_owner = await _resolve_booking_for_current_user(booking, current_user)

    if booking.status != BookingStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Session is not confirmed.")
    if _is_meeting_link_expired(booking):
        raise HTTPException(status_code=410, detail="Session link expired.")

    # Security mode: require JWT token auth to prevent anonymous joins with shared links.
    if settings.JITSI_REQUIRE_JWT and not (settings.JITSI_APP_SECRET or "").strip():
        raise HTTPException(
            status_code=503,
            detail="Secure meeting access is enabled but JITSI_APP_SECRET is not configured."
        )

    join_available_at = _meeting_join_available_at(booking)
    if join_available_at and datetime.utcnow() < join_available_at:
        # Return a structured detail so the frontend can render the join
        # time in the viewer's local timezone instead of hard-coded UTC.
        join_iso = (
            join_available_at.replace(tzinfo=timezone.utc)
            .isoformat()
            .replace("+00:00", "Z")
        )
        raise HTTPException(
            status_code=403,
            detail={
                "code": "session_not_open",
                "message": "Session is not open yet.",
                "join_available_at": join_iso,
            },
        )

    # Moderator safety: the first person to join a Jitsi room becomes
    # moderator on deployments that don't enforce our JWT moderator
    # claim (meet.jit.si, some self-hosted setups). To guarantee the
    # tutor is always the first joiner, we latch `tutor_joined_at` on
    # the shared BookingSlot the first time the tutor hits this
    # endpoint, and block students until that latch is set. Slot-level
    # storage means group and workshop sessions share a single latch
    # across every participant booking.
    slot = await BookingSlot.find_one({
        "tutor_id": booking.tutor_id,
        "scheduled_at": booking.scheduled_at,
        "duration_minutes": booking.duration_minutes,
    })
    if slot is not None:
        if is_tutor_owner:
            if slot.tutor_joined_at is None:
                slot.tutor_joined_at = datetime.utcnow()
                slot.updated_at = datetime.utcnow()
                try:
                    await slot.save()
                except Exception:
                    # Non-fatal — we'd rather let the tutor join than block them on a save failure.
                    logger.exception(
                        "Failed to latch tutor_joined_at for slot of booking %s", booking.id,
                    )
        elif is_student and slot.tutor_joined_at is None:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "waiting_for_tutor",
                    "message": "Waiting for the tutor to start the session.",
                },
            )
    # If there's no slot document (legacy booking made before BookingSlot
    # existed), fall through with no latch — preserves old behavior for
    # those rows so they aren't silently broken.

    room_key = await _ensure_meeting_room_key(booking)
    domain, room_name, meeting_url = _resolve_meeting_domain_and_room(room_key)
    token = _build_jitsi_access_token(
        room_name=room_name,
        booking=booking,
        user=current_user,
        is_moderator=is_tutor_owner
    )
    if not token:
        raise HTTPException(
            status_code=503,
            detail="Jitsi JWT authentication is required but not configured. Set JITSI_APP_SECRET or JaaS credentials."
        )
    launch_url = f"{meeting_url}?jwt={token}" if token else meeting_url

    return MeetingAccessResponse(
        booking_id=str(booking.id),
        room_name=room_name,
        domain=domain,
        launch_url=launch_url,
        is_moderator=is_tutor_owner,
        tutor_email=booking.tutor_email,
        jwt=token,
        join_available_at=join_available_at,
        join_expires_at=_meeting_link_expires_at(booking),
        feedback_allowed_at=_to_utc_naive(booking.scheduled_at) + timedelta(minutes=booking.duration_minutes),
        certificate_ready_at=_workshop_certificate_ready_at(booking) if _is_workshop_booking(booking) else None,
    )


@router.post("/{booking_id}/meeting-restart", response_model=MeetingAccessResponse)
async def restart_meeting(
    booking_id: str,
    current_user: User = Depends(get_current_user),
):
    """Rotate the Jitsi room for this booking so the tutor is the first
    joiner of a brand-new room. Used to reclaim moderator after a
    network drop on deployments (meet.jit.si) that don't re-read the
    JWT moderator claim on reconnect — by moving everyone into a fresh
    room, whoever initiates the rotation (always the tutor here) is
    guaranteed to be the first participant in the new one."""
    booking = await Booking.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    _, is_tutor_owner = await _get_booking_access(booking, current_user)
    if not is_tutor_owner:
        raise HTTPException(status_code=403, detail="Only the tutor can reset the meeting room")

    if booking.status != BookingStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Session is not confirmed.")

    # Generate a new random key with the same prefix (zc-p / zc-g / zc-w)
    # so all existing key conventions keep working. For group/workshop
    # sessions every sibling booking that shares this slot must be
    # rotated in the same request or half the room ends up stranded in
    # the old Jitsi channel.
    old_key = booking.meeting_room_key or ""
    if old_key.startswith("zc-w-"):
        prefix = "zc-w"
    elif old_key.startswith("zc-g-") or booking.session_type == SessionType.GROUP:
        prefix = "zc-g"
    else:
        prefix = "zc-p"
    new_key = f"{prefix}-{uuid4().hex}"

    now_utc = datetime.utcnow()
    siblings: list[Booking] = []
    if booking.session_type == SessionType.GROUP or prefix == "zc-w":
        # Every booking for the same slot shares one Jitsi room — rotate
        # them as a group so students don't end up isolated.
        siblings = await Booking.find({
            "tutor_id": booking.tutor_id,
            "session_type": booking.session_type.value if hasattr(booking.session_type, "value") else str(booking.session_type),
            "scheduled_at": booking.scheduled_at,
            "duration_minutes": booking.duration_minutes,
            "status": BookingStatus.CONFIRMED.value,
        }).to_list()
    else:
        siblings = [booking]

    for b in siblings:
        b.meeting_room_key = new_key
        b.updated_at = now_utc
        try:
            await b.save()
        except Exception:
            logger.exception("Failed to rotate meeting_room_key for booking %s", b.id)

    # Re-latch the slot so `tutor_joined_at` reflects this fresh start —
    # students polling /meeting-access will now see the new room name
    # and a valid latch, and rejoin the rotated room cleanly.
    slot = await BookingSlot.find_one({
        "tutor_id": booking.tutor_id,
        "scheduled_at": booking.scheduled_at,
        "duration_minutes": booking.duration_minutes,
    })
    if slot is not None:
        slot.tutor_joined_at = now_utc
        slot.updated_at = now_utc
        try:
            await slot.save()
        except Exception:
            logger.exception("Failed to re-latch tutor_joined_at on restart for booking %s", booking.id)

    # Reload the booking so we return the rotated key.
    refreshed = await Booking.get(booking_id)
    if not refreshed:
        raise HTTPException(status_code=500, detail="Meeting restart failed")

    domain, room_name, meeting_url = _resolve_meeting_domain_and_room(new_key)
    token = _build_jitsi_access_token(
        room_name=room_name,
        booking=refreshed,
        user=current_user,
        is_moderator=True,
    )
    if not token:
        raise HTTPException(
            status_code=503,
            detail="Jitsi JWT authentication is required but not configured.",
        )
    launch_url = f"{meeting_url}?jwt={token}"

    return MeetingAccessResponse(
        booking_id=str(refreshed.id),
        room_name=room_name,
        domain=domain,
        launch_url=launch_url,
        is_moderator=True,
        tutor_email=refreshed.tutor_email,
        jwt=token,
        join_available_at=_meeting_join_available_at(refreshed),
        join_expires_at=_meeting_link_expires_at(refreshed),
        feedback_allowed_at=_to_utc_naive(refreshed.scheduled_at) + timedelta(minutes=refreshed.duration_minutes),
        certificate_ready_at=_workshop_certificate_ready_at(refreshed) if _is_workshop_booking(refreshed) else None,
    )


@router.put("/{booking_id}", response_model=BookingResponse)
async def update_booking(
    booking_id: str,
    booking_data: BookingUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a booking"""
    booking = await Booking.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    is_student, is_tutor_owner = await _get_booking_access(booking, current_user)
    if not is_student and not is_tutor_owner:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = booking_data.model_dump(exclude_unset=True)
    role_value = _role_value(current_user.role)
    new_status = update_data.get("status")
    if new_status == BookingStatus.COMPLETED and not (is_tutor_owner or role_value == "admin"):
        raise HTTPException(status_code=403, detail="Only tutor/admin can mark session as completed")

    for field, value in update_data.items():
        setattr(booking, field, value)
    booking.updated_at = datetime.utcnow()

    await booking.save()
    if booking.status == BookingStatus.COMPLETED:
        try:
            await _ensure_completion_certificate_for_booking(booking)
        except Exception:
            logger.exception("Failed to generate completion certificate for booking %s", booking.id)

    return create_booking_response(booking)


@router.put("/{booking_id}/session-name", response_model=BookingResponse)
async def update_session_name(
    booking_id: str,
    payload: SessionNameUpdate,
    current_user: User = Depends(get_current_user)
):
    """Set/update session name for a group slot (tutor only)."""
    booking = await Booking.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor or str(tutor.id) != booking.tutor_id:
        raise HTTPException(status_code=403, detail="Only the tutor can update session name")

    if booking.session_type != SessionType.GROUP:
        raise HTTPException(status_code=400, detail="Session name can only be set for group sessions")

    session_name = (payload.session_name or "").strip()
    if not session_name:
        raise HTTPException(status_code=400, detail="Session name is required")

    if len(session_name) > 120:
        raise HTTPException(status_code=400, detail="Session name must be 120 characters or less")

    now = datetime.utcnow()

    # Apply the same name to all active bookings in this group slot.
    slot_bookings = await Booking.find({
        "tutor_id": booking.tutor_id,
        "session_type": SessionType.GROUP.value,
        "scheduled_at": booking.scheduled_at,
        "duration_minutes": booking.duration_minutes,
        "status": {"$ne": BookingStatus.CANCELLED.value},
    }).to_list()

    if not slot_bookings:
        booking.session_name = session_name
        booking.is_workshop = True
        booking.updated_at = now
        await booking.save()
        return create_booking_response(booking)

    for b in slot_bookings:
        b.session_name = session_name
        b.is_workshop = True
        b.updated_at = now
        await b.save()

    refreshed = await Booking.get(booking_id)
    return create_booking_response(refreshed if refreshed else booking)


@router.post("/{booking_id}/confirm", response_model=BookingResponse)
async def confirm_booking(
    booking_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Confirm a booking and generate Jitsi session link.
    Only the tutor can confirm a booking.
    """
    booking = await Booking.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Check if user is the tutor
    tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor or str(tutor.id) != booking.tutor_id:
        raise HTTPException(status_code=403, detail="Only the tutor can confirm this booking")

    if booking.status == BookingStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Booking is already confirmed")

    # Jitsi-only flow: always generate in-app meeting URL.
    booking.status = BookingStatus.CONFIRMED
    await _ensure_meeting_room_key(booking)
    meeting_link = _build_in_app_meeting_link(booking)
    if booking.session_type == SessionType.GROUP:
        slot_filter = {
            "tutor_id": booking.tutor_id,
            "session_type": SessionType.GROUP.value,
            "scheduled_at": booking.scheduled_at,
            "duration_minutes": booking.duration_minutes,
            "status": BookingStatus.CONFIRMED.value,
        }
        siblings = await Booking.find(slot_filter).sort("+created_at").to_list()
        anchor = siblings[0] if siblings else booking
        meeting_link = _build_in_app_meeting_link(anchor)
        # Keep same meeting link for all confirmed participants in this group slot.
        for sib in siblings:
            if sib.meeting_link != meeting_link:
                sib.meeting_link = meeting_link
                sib.updated_at = datetime.utcnow()
                await sib.save()

    booking.meeting_link = meeting_link
    booking.meeting_provider = "jitsi"
    booking.meeting_origin = "lms_embedded"
    booking.google_event_id = None
    booking.updated_at = datetime.utcnow()

    await booking.save()
    if _is_workshop_booking(booking):
        _dispatch_background(_schedule_workshop_certificate_issue(str(booking.id)), "workshop_certificate_schedule_on_confirm")

    # Complete the payment when booking is confirmed
    tutor_tz_name = await _get_tutor_timezone_name(booking.tutor_id)

    try:
        payment = await payment_service.get_payment_by_booking(booking_id)
        if payment:
            await payment_service.complete_payment(str(payment.id))
            booking.payment_status = "paid"
            await booking.save()

            # Fallback invoice trigger for flows where payment verify endpoint is skipped.
            if booking.student_email:
                total_paid = payment.charge_amount if payment.charge_amount and payment.charge_amount > 0 else payment.session_amount
                _dispatch_background(
                    email_service.send_payment_invoice_email_with_retry(
                        to_email=booking.student_email,
                        student_name=booking.student_name or "Student",
                        booking_id=str(booking.id),
                        payment_id=str(payment.id),
                        subject_name=booking.subject,
                        tutor_name=booking.tutor_name or current_user.full_name or "Tutor",
                        scheduled_at=booking.scheduled_at,
                        currency=payment.currency,
                        session_amount=payment.session_amount,
                        platform_fee=payment.student_platform_fee,
                        total_paid=total_paid,
                        razorpay_payment_id=payment.razorpay_payment_id,
                        timezone_name=tutor_tz_name,
                    ),
                    "invoice_on_confirm_fallback",
                )

            if _is_workshop_booking(booking):
                _dispatch_background(_schedule_workshop_certificate_issue(str(booking.id)), "workshop_certificate_schedule_on_payment_confirm")
    except Exception:
        logger.exception("Failed to complete payment for booking %s", booking_id)

    # Send notification to student
    try:
        await notification_service.notify_booking_confirmed(
            student_user_id=booking.student_id,
            tutor_name=booking.tutor_name or current_user.full_name,
            tutor_id=str(current_user.id),
            subject=booking.subject,
            booking_id=str(booking.id),
            scheduled_at=booking.scheduled_at,
            meeting_link=booking.meeting_link,
            timezone_name=tutor_tz_name,
        )
    except Exception:
        logger.exception("Failed to send booking confirmation notification for booking %s", booking.id)

    # Send tutor-side session confirmation email (summary copy)
    try:
        if current_user.email:
            _dispatch_background(
                email_service.send_tutor_session_confirmation_email(
                    to_email=current_user.email,
                    tutor_name=current_user.full_name or (booking.tutor_name or "Tutor"),
                    student_name=booking.student_name or "Student",
                    subject_name=booking.subject,
                    scheduled_at=booking.scheduled_at,
                    meeting_link=booking.meeting_link,
                    timezone_name=tutor_tz_name,
                ),
                "tutor_session_confirmation_email",
            )
    except Exception:
        logger.exception("Failed to send tutor session confirmation email for booking %s", booking.id)

    return create_booking_response(booking)


class MeetLinkUpdate(BaseModel):
    meeting_link: str


@router.put("/{booking_id}/meet-link", response_model=BookingResponse)
async def update_meet_link(
    booking_id: str,
    data: MeetLinkUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Manually update the Meet link for a booking.
    Only the tutor can update the Meet link.
    """
    booking = await Booking.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Check if user is the tutor
    tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor or str(tutor.id) != booking.tutor_id:
        raise HTTPException(status_code=403, detail="Only the tutor can update the Meet link")

    booking.meeting_link = data.meeting_link
    booking.meeting_provider = "manual"
    booking.meeting_origin = "tutor_manual"
    booking.updated_at = datetime.utcnow()

    await booking.save()

    return create_booking_response(booking)


@router.post("/{booking_id}/cancel", response_model=BookingResponse)
async def cancel_booking(
    booking_id: str,
    current_user: User = Depends(get_current_user)
):
    """Cancel a booking. Both student and tutor can cancel."""
    booking = await Booking.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Check authorization
    current_tutor_profile = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    tutor_id = str(current_tutor_profile.id) if current_tutor_profile else None
    is_cancelled_by_student = booking.student_id == str(current_user.id)

    if booking.student_id != str(current_user.id) and booking.tutor_id != tutor_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if booking.status == BookingStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Booking is already cancelled")

    booking.status = BookingStatus.CANCELLED
    booking.updated_at = datetime.utcnow()
    # Track who cancelled — surfaced to the admin Refunds tab.
    booking.cancelled_at = datetime.utcnow()
    booking.cancelled_by_id = str(current_user.id)
    booking.cancelled_by_name = current_user.full_name
    if is_cancelled_by_student:
        booking.cancelled_by_role = "student"
    elif current_user.role == "admin":
        booking.cancelled_by_role = "admin"
    else:
        booking.cancelled_by_role = "tutor"
    # If the booking was already paid, this cancellation needs an admin refund.
    if booking.payment_status == "paid" and booking.refund_status is None:
        booking.refund_status = "pending"

    await booking.save()
    await _release_slot(
        tutor_id=booking.tutor_id,
        scheduled_at=booking.scheduled_at,
        duration_minutes=booking.duration_minutes,
    )

    cancel_tz_name = await _get_tutor_timezone_name(booking.tutor_id)

    # Send notification to the other party
    try:
        if is_cancelled_by_student:
            # Notify tutor that student cancelled
            booking_tutor_profile = await TutorProfile.get(booking.tutor_id)
            if booking_tutor_profile:
                await notification_service.notify_booking_cancelled(
                    user_id=booking_tutor_profile.user_id,
                    cancelled_by_name=current_user.full_name,
                    cancelled_by_id=str(current_user.id),
                    subject=booking.subject,
                    booking_id=str(booking.id),
                    scheduled_at=booking.scheduled_at,
                    is_student=False,
                    timezone_name=cancel_tz_name,
                )
        else:
            # Notify student that tutor cancelled
            await notification_service.notify_booking_cancelled(
                user_id=booking.student_id,
                cancelled_by_name=current_user.full_name,
                cancelled_by_id=str(current_user.id),
                subject=booking.subject,
                booking_id=str(booking.id),
                scheduled_at=booking.scheduled_at,
                is_student=True,
                timezone_name=cancel_tz_name,
            )
    except Exception:
        logger.exception("Failed to send cancellation notification for booking %s", booking.id)

    # Send cancellation acknowledgement to the user who performed the cancellation as well.
    try:
        if current_user.email:
            _dispatch_background(
                email_service.send_booking_cancelled_email(
                    to_email=current_user.email,
                    recipient_name=current_user.full_name or "User",
                    cancelled_by=current_user.full_name or "User",
                    subject_name=booking.subject,
                    scheduled_at=booking.scheduled_at,
                    timezone_name=cancel_tz_name,
                ),
                "booking_cancelled_ack_email",
            )
    except Exception:
        logger.exception("Failed to send cancellation acknowledgement email for booking %s", booking.id)

    # If paid booking is cancelled, notify student that refund is initiated.
    try:
        if booking.payment_status == "paid" and booking.student_email:
            payment = await payment_service.get_payment_by_booking(str(booking.id))
            refund_amount = 0.0
            refund_currency = booking.currency or "INR"
            if payment:
                refund_currency = payment.currency
                refund_amount = payment.charge_amount if (payment.charge_amount and payment.charge_amount > 0) else payment.session_amount
            else:
                refund_amount = booking.price

            _dispatch_background(
                email_service.send_refund_initiated_email(
                    to_email=booking.student_email,
                    student_name=booking.student_name or "Student",
                    booking_id=str(booking.id),
                    subject_name=booking.subject,
                    scheduled_at=booking.scheduled_at,
                    currency=refund_currency,
                    amount=refund_amount,
                    eta_text="2 to 4 business days",
                    timezone_name=cancel_tz_name,
                ),
                "refund_initiated_email",
            )
    except Exception:
        logger.exception("Failed to send refund initiated email for booking %s", booking.id)

    return create_booking_response(booking)


@router.get("/tutor/my-bookings", response_model=List[BookingResponse])
async def get_tutor_bookings(current_user: User = Depends(get_current_user)):
    """Get all bookings for the current tutor"""
    tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    bookings = await Booking.find(
        Booking.tutor_id == str(tutor.id)
    ).sort("-scheduled_at").to_list()

    for b in bookings:
        try:
            changed = await _auto_complete_if_past(b)
            if changed or b.status == BookingStatus.COMPLETED:
                await _ensure_completion_certificate_for_booking(b)
        except Exception:
            logger.exception("Failed post-session processing for booking %s", b.id)

    return [create_booking_response(b) for b in bookings]


@router.post("/reviews", response_model=ReviewResponse)
async def create_review(
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a review for a tutor"""
    tutor = await TutorProfile.get(review_data.tutor_id)
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found")

    review = Review(
        student_id=str(current_user.id),
        tutor_id=review_data.tutor_id,
        booking_id=review_data.booking_id,
        rating=review_data.rating,
        comment=review_data.comment,
        student_name=current_user.full_name,
        student_avatar=current_user.avatar
    )
    await review.insert()

    # Update tutor rating
    all_reviews = await Review.find(Review.tutor_id == review_data.tutor_id).to_list()
    total_rating = sum(r.rating for r in all_reviews)
    tutor.rating = total_rating / len(all_reviews)
    tutor.total_reviews = len(all_reviews)
    await tutor.save()

    # Send notification to tutor
    try:
        await notification_service.notify_review_received(
            tutor_user_id=tutor.user_id,
            student_name=current_user.full_name,
            student_id=str(current_user.id),
            rating=review_data.rating,
            booking_id=review_data.booking_id
        )
    except Exception:
        logger.exception("Failed to send review notification for tutor %s", tutor.id)

    return ReviewResponse(
        id=str(review.id),
        student_id=review.student_id,
        tutor_id=review.tutor_id,
        student_name=review.student_name,
        student_avatar=review.student_avatar,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at
    )
