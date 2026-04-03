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
from app.schemas.booking import BookingCreate, BookingUpdate, BookingResponse, ReviewCreate, ReviewResponse
from app.routes.auth import get_current_user
from app.services.google_meet import google_meet_service
from app.services.google_calendar_service import tutor_google_calendar_service
from app.services.notification_service import notification_service
from app.services.payment_service import payment_service
from app.services.minio_service import minio_service
from app.services.email_service import email_service
from app.services.certificate_service import build_certificate_pdf
from app.core.config import settings
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from uuid import uuid4
from jose import jwt as jose_jwt
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

router = APIRouter()
logger = logging.getLogger(__name__)
MEET_LINK_EXPIRE_GRACE_MINUTES = 15
EFFECTIVE_MIN_NOTICE_HOURS = 1


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


def _dispatch_background(coro, context: str) -> None:
    async def _runner():
        try:
            await coro
        except Exception:
            logger.exception("Background task failed (%s)", context)

    asyncio.create_task(_runner())


def _role_value(role: object) -> str:
    return getattr(role, "value", role)

def _safe_zoneinfo(timezone_name: str | None) -> ZoneInfo:
    tz_name = (timezone_name or "UTC").strip() or "UTC"
    try:
        return ZoneInfo(tz_name)
    except Exception:
        return ZoneInfo("UTC")


async def _get_booking_access(booking: Booking, current_user: User) -> tuple[bool, bool]:
    is_student = booking.student_id == str(current_user.id)

    role_value = _role_value(current_user.role)
    is_tutor_owner = booking.tutor_id == str(current_user.id)
    if role_value == "tutor":
        tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
        if tutor:
            is_tutor_owner = is_tutor_owner or (str(tutor.id) == booking.tutor_id)

    return is_student, is_tutor_owner


def _build_jitsi_access_token(
    room_name: str,
    booking: Booking,
    user: User,
    is_moderator: bool,
) -> Optional[str]:
    secret = (settings.JITSI_APP_SECRET or "").strip()
    if not secret:
        return None

    now = datetime.utcnow()
    exp = now + timedelta(minutes=max(15, int(settings.JITSI_TOKEN_TTL_MINUTES or 180)))
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
            }
        },
    }
    return jose_jwt.encode(payload, secret, algorithm="HS256")


def _to_utc_naive(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _meeting_link_expires_at(booking: Booking) -> Optional[datetime]:
    if not booking.meeting_link:
        return None
    start = _to_utc_naive(booking.scheduled_at)
    return start + timedelta(minutes=booking.duration_minutes + MEET_LINK_EXPIRE_GRACE_MINUTES)


def _is_meeting_link_expired(booking: Booking) -> bool:
    expires_at = _meeting_link_expires_at(booking)
    if not expires_at:
        return False
    return datetime.utcnow() > expires_at


async def _ensure_completion_certificate_for_booking(booking: Booking) -> Optional[str]:
    """Create completion certificate once per booking and return URL."""
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
    pdf_bytes = build_certificate_pdf(
        student_name=student.full_name or "Student",
        tutor_name=tutor_name,
        subject=booking.subject or "Session",
        session_date=session_date,
        certificate_number=certificate_number,
        session_name=booking.session_name,
        tutor_signature_url=tutor_signature_url,
        tutor_signature_bytes=tutor_signature_bytes,
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
        status=b.status,
        notes=b.notes,
        meeting_link=safe_meeting_link,
        meeting_room_key=b.meeting_room_key,
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
    meeting_url: str
    launch_url: str
    is_moderator: bool
    jwt: Optional[str] = None


class JitsiTestAccessResponse(BaseModel):
    room_name: str
    domain: str
    meeting_url: str
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
    capacity = 1 if booking_data.session_type == SessionType.PRIVATE else await _get_group_capacity(tutor)

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
    tutor = await TutorProfile.get(booking_data.tutor_id)
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found")

    availability = await TutorAvailability.find_one(TutorAvailability.tutor_id == booking_data.tutor_id)
    tutor_tz = _safe_zoneinfo(getattr(availability, "timezone", None))
    now_in_tutor_tz = datetime.now(tutor_tz)
    min_notice_cutoff = now_in_tutor_tz + timedelta(hours=EFFECTIVE_MIN_NOTICE_HOURS)

    scheduled_at = booking_data.scheduled_at
    if scheduled_at.tzinfo is None:
        scheduled_at_in_tutor_tz = scheduled_at.replace(tzinfo=tutor_tz)
    else:
        scheduled_at_in_tutor_tz = scheduled_at.astimezone(tutor_tz)

    if scheduled_at_in_tutor_tz < min_notice_cutoff:
        raise HTTPException(
            status_code=400,
            detail="This slot is closed. You can only book at least 1 hour in advance."
        )

    # Student email is required for Google Meet attendee safety controls.
    if not current_user.email:
        raise HTTPException(
            status_code=400,
            detail="A valid student email is required to create a booking."
        )

    # Reserve tutor slot atomically (capacity + cross-type conflict guards).
    await _reserve_slot(tutor, booking_data)

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
        subject=booking_data.subject,
        session_type=booking_data.session_type,
        scheduled_at=booking_data.scheduled_at,
        duration_minutes=booking_data.duration_minutes,
        price=session_price,
        currency=booking_data.currency,
        notes=booking_data.notes,
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
            scheduled_at=booking.scheduled_at
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
                await _ensure_completion_certificate_for_booking(b)
        except Exception:
            logger.exception("Failed post-session processing for booking %s", b.id)

    return [create_booking_response(b) for b in bookings]


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking_by_id(booking_id: str, current_user: User = Depends(get_current_user)):
    booking = await Booking.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    is_student, is_tutor_owner = await _get_booking_access(booking, current_user)

    if not is_student and not is_tutor_owner:
        raise HTTPException(status_code=403, detail="Not authorized")

    return create_booking_response(booking)


@router.get("/jitsi/test-access", response_model=JitsiTestAccessResponse)
async def get_jitsi_test_access(current_user: User = Depends(get_current_user)):
    """
    Generate a tutor-only Jitsi test room access.
    This helps tutors validate audio/video and moderator behavior before real sessions.
    """
    tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor:
        raise HTTPException(status_code=403, detail="Only tutors can use Jitsi test access.")

    room_name = f"zealcatalyst-test-{str(tutor.id)}-{uuid4().hex[:8]}".lower()
    domain = settings.JITSI_DOMAIN
    meeting_url = f"https://{domain}/{room_name}"

    token = None
    if (settings.JITSI_APP_SECRET or "").strip():
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
                }
            },
        }
        token = jose_jwt.encode(payload, settings.JITSI_APP_SECRET, algorithm="HS256")

    launch_url = f"{meeting_url}?jwt={token}" if token else meeting_url
    return JitsiTestAccessResponse(
        room_name=room_name,
        domain=domain,
        meeting_url=meeting_url,
        launch_url=launch_url,
        is_moderator=True,
        jwt=token,
    )


@router.get("/{booking_id}/meeting-access", response_model=MeetingAccessResponse)
async def get_meeting_access(booking_id: str, current_user: User = Depends(get_current_user)):
    booking = await Booking.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    is_student, is_tutor_owner = await _get_booking_access(booking, current_user)
    if not is_student and not is_tutor_owner:
        raise HTTPException(status_code=403, detail="Not authorized")

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

    room_name = await _ensure_meeting_room_key(booking)
    domain = settings.JITSI_DOMAIN
    meeting_url = f"https://{domain}/{room_name}"
    token = _build_jitsi_access_token(
        room_name=room_name,
        booking=booking,
        user=current_user,
        is_moderator=is_tutor_owner
    )
    launch_url = f"{meeting_url}?jwt={token}" if token else meeting_url

    return MeetingAccessResponse(
        booking_id=str(booking.id),
        room_name=room_name,
        domain=domain,
        meeting_url=meeting_url,
        launch_url=launch_url,
        is_moderator=is_tutor_owner,
        jwt=token,
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
        booking.updated_at = now
        await booking.save()
        return create_booking_response(booking)

    for b in slot_bookings:
        b.session_name = session_name
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
    Confirm a booking and generate Google Meet link.
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

    meeting_provider = (settings.MEETING_PROVIDER or "jitsi").strip().lower()

    # A valid student email is required for Google Meet attendee-based flow.
    if meeting_provider != "jitsi" and not booking.student_email:
        raise HTTPException(
            status_code=400,
            detail="Booking is missing student email. Please ask the student to update profile email."
        )

    if meeting_provider == "jitsi":
        # In-app meeting link; actual Jitsi room is derived deterministically on frontend.
        booking.status = BookingStatus.CONFIRMED
        await _ensure_meeting_room_key(booking)
        booking.meeting_link = _build_in_app_meeting_link(booking)
        booking.updated_at = datetime.utcnow()
        await booking.save()

        try:
            payment = await payment_service.get_payment_by_booking(booking_id)
            if payment:
                await payment_service.complete_payment(str(payment.id))
        except Exception:
            logger.exception("Failed to complete payment for booking %s", booking_id)

        try:
            await notification_service.notify_booking_confirmed(
                student_user_id=booking.student_id,
                tutor_name=booking.tutor_name or current_user.full_name,
                tutor_id=str(current_user.id),
                subject=booking.subject,
                booking_id=str(booking.id),
                scheduled_at=booking.scheduled_at,
                meeting_link=booking.meeting_link
            )
        except Exception:
            logger.exception("Failed to send booking confirmation notification for booking %s", booking.id)

        return create_booking_response(booking)

    meet_result = None
    session_type_str = "1-on-1" if booking.session_type.value == "private" else "Group"

    # For group sessions, reuse the same event/link for the same tutor+timeslot and add attendee.
    if booking.session_type == SessionType.GROUP:
        existing_group_booking = await Booking.find_one({
            "_id": {"$ne": booking.id},
            "tutor_id": booking.tutor_id,
            "session_type": SessionType.GROUP.value,
            "scheduled_at": booking.scheduled_at,
            "duration_minutes": booking.duration_minutes,
            "status": BookingStatus.CONFIRMED.value,
            "google_event_id": {"$ne": None}
        })

        if existing_group_booking and existing_group_booking.google_event_id:
            meet_result = await tutor_google_calendar_service.add_attendee_to_event_for_tutor(
                tutor=tutor,
                event_id=existing_group_booking.google_event_id,
                attendee_email=booking.student_email
            )
            # Reuse shared group link/event from the existing confirmed booking.
            booking.google_event_id = existing_group_booking.google_event_id
            booking.meeting_link = existing_group_booking.meeting_link or (meet_result or {}).get("meet_link")

    # Private sessions (or first group slot confirmation) create a new event.
    if not meet_result:
        meet_result = await tutor_google_calendar_service.create_meet_event_for_tutor(
            tutor=tutor,
            title=f"{booking.subject} Tutoring Session - {session_type_str}",
            description=f"Tutoring session with {booking.tutor_name}\nStudent: {booking.student_name}\nSubject: {booking.subject}\n\nNotes: {booking.notes or 'None'}",
            start_time=booking.scheduled_at,
            duration_minutes=booking.duration_minutes,
            tutor_email=booking.tutor_email,
            student_email=booking.student_email
        )

    # If tutor has connected Google Calendar, require automatic meet-link generation.
    if tutor.google_calendar_connected and (not meet_result or not meet_result.get("meet_link")):
        raise HTTPException(
            status_code=502,
            detail="Unable to generate Google Meet link from connected Google Calendar. Please reconnect Google Calendar and try again."
        )

    # Update booking with Meet link
    booking.status = BookingStatus.CONFIRMED
    if meet_result and meet_result.get("status") == "pending_meet_link":
        # Backward-compatible fallback for non-connected tutors
        fallback_result = google_meet_service.create_meet_event(
            title=f"{booking.subject} Tutoring Session - {session_type_str}",
            description=f"Tutoring session with {booking.tutor_name}\nStudent: {booking.student_name}\nSubject: {booking.subject}\n\nNotes: {booking.notes or 'None'}",
            start_time=booking.scheduled_at,
            duration_minutes=booking.duration_minutes,
            tutor_email=booking.tutor_email,
            student_email=booking.student_email
        )
        meet_result = fallback_result if fallback_result else meet_result

    if meet_result:
        booking.meeting_link = booking.meeting_link or meet_result.get('meet_link')
        booking.google_event_id = booking.google_event_id or meet_result.get('event_id')
        if meeting_provider == "jitsi":
            await _ensure_meeting_room_key(booking)
    booking.updated_at = datetime.utcnow()

    await booking.save()

    # Complete the payment when booking is confirmed
    try:
        payment = await payment_service.get_payment_by_booking(booking_id)
        if payment:
            await payment_service.complete_payment(str(payment.id))
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
            meeting_link=booking.meeting_link
        )
    except Exception:
        logger.exception("Failed to send booking confirmation notification for booking %s", booking.id)

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

    # Cancel Google Calendar event if exists
    if booking.google_event_id:
        google_meet_service.cancel_event(booking.google_event_id)

    booking.status = BookingStatus.CANCELLED
    booking.updated_at = datetime.utcnow()

    await booking.save()
    await _release_slot(
        tutor_id=booking.tutor_id,
        scheduled_at=booking.scheduled_at,
        duration_minutes=booking.duration_minutes,
    )

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
                    is_student=False
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
                is_student=True
            )
    except Exception:
        logger.exception("Failed to send cancellation notification for booking %s", booking.id)

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
