from datetime import datetime, timezone, timedelta
from typing import List, Optional
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.models.tutor import TutorProfile
from app.models.booking import Booking, BookingStatus
from app.models.user import User, UserRole
from app.models.workshop import Workshop
from app.core.config import settings
from app.routes.auth import get_current_user
from app.schemas.booking import UtcDatetime

router = APIRouter()
logger = logging.getLogger(__name__)


def _workshop_ends_at(workshop: Workshop) -> datetime:
    scheduled_at = getattr(workshop, "scheduled_at", None) or datetime.utcnow()
    duration_minutes = int(getattr(workshop, "duration_minutes", 60) or 60)
    return scheduled_at + timedelta(minutes=duration_minutes)


def _is_workshop_expired(workshop: Workshop, now: Optional[datetime] = None) -> bool:
    return _workshop_ends_at(workshop) <= (now or datetime.utcnow())


def _normalize_to_utc_naive(dt: datetime) -> datetime:
    """Store-side convention: every datetime in the DB is naive UTC.
    Aware inputs (the normal case — frontend sends `.toISOString()`) are
    converted; naive inputs are assumed to already be UTC."""
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


class WorkshopCreate(BaseModel):
    title: str = Field(min_length=2, max_length=140)
    description: Optional[str] = Field(default=None, max_length=3000)
    modules: List[str] = Field(default_factory=list)
    thumbnail_url: Optional[str] = None
    amount: float = Field(ge=0)
    currency: str = "INR"
    scheduled_at: datetime
    duration_minutes: int = Field(default=60, ge=15, le=1440)
    max_participants: int = Field(default=50, ge=1, le=5000)
    is_active: bool = True


class WorkshopUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=140)
    description: Optional[str] = Field(default=None, max_length=3000)
    modules: Optional[List[str]] = None
    thumbnail_url: Optional[str] = None
    amount: Optional[float] = Field(default=None, ge=0)
    currency: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(default=None, ge=15, le=1440)
    max_participants: Optional[int] = Field(default=None, ge=1, le=5000)
    is_active: Optional[bool] = None


class WorkshopResponse(BaseModel):
    id: str
    tutor_id: str
    tutor_user_id: str
    public_url: Optional[str] = None
    join_url: Optional[str] = None
    title: str
    description: Optional[str] = None
    modules: List[str] = []
    thumbnail_url: Optional[str] = None
    amount: float
    currency: str
    scheduled_at: UtcDatetime
    duration_minutes: int
    max_participants: int
    is_active: bool
    tutor_name: Optional[str] = None
    tutor_email: Optional[str] = None
    created_at: UtcDatetime
    updated_at: UtcDatetime


def _build_in_app_meeting_url(booking_id: str) -> Optional[str]:
    # Keep dashboard links relative so a misconfigured FRONTEND_URL cannot send
    # tutors to a different deployment or stale Jitsi room.
    return f"/meeting/{booking_id}"


async def _find_workshop_anchor_booking(workshop: Workshop) -> Optional[Booking]:
    room_key = f"zc-w-{str(workshop.id)}".lower().replace(" ", "-")
    booking = await Booking.find_one({
        "tutor_id": str(workshop.tutor_id),
        "is_workshop": True,
        "status": BookingStatus.CONFIRMED.value,
        "meeting_room_key": room_key,
    })
    if booking:
        return booking

    return await Booking.find_one({
        "tutor_id": str(workshop.tutor_id),
        "is_workshop": True,
        "status": BookingStatus.CONFIRMED.value,
        "notes": f"Workshop booking: {str(workshop.id)}",
    })


async def _build_tutor_join_url(workshop: Workshop, current_user: User) -> Optional[str]:
    # Tutors must enter workshop sessions through the same in-app meeting
    # endpoint as students. That endpoint latches tutor_joined_at on the
    # BookingSlot, which lets waiting students join the exact same room.
    anchor_booking = await _find_workshop_anchor_booking(workshop)
    if anchor_booking:
        return _build_in_app_meeting_url(str(anchor_booking.id))

    # No paid/confirmed participant exists yet, so there is no shared booking
    # context to authorize students against. Hide Join Workshop until then.
    return None


async def _to_response(workshop: Workshop, current_user: Optional[User] = None) -> WorkshopResponse:
    base_url = (settings.FRONTEND_URL or "").rstrip("/")
    public_url = f"{base_url}/workshops/{str(workshop.id)}" if base_url else None
    join_url = await _build_tutor_join_url(workshop, current_user) if current_user else None
    tutor_user_id = getattr(workshop, "tutor_user_id", None) or getattr(workshop, "tutor_id", "")
    created_at = getattr(workshop, "created_at", None) or datetime.utcnow()
    updated_at = getattr(workshop, "updated_at", None) or created_at
    return WorkshopResponse(
        id=str(workshop.id),
        tutor_id=str(getattr(workshop, "tutor_id", "") or ""),
        tutor_user_id=str(tutor_user_id),
        public_url=public_url,
        join_url=join_url,
        title=getattr(workshop, "title", "") or "Workshop",
        description=getattr(workshop, "description", None),
        modules=getattr(workshop, "modules", None) or [],
        thumbnail_url=getattr(workshop, "thumbnail_url", None),
        amount=float(getattr(workshop, "amount", 0) or 0),
        currency=getattr(workshop, "currency", None) or "INR",
        scheduled_at=getattr(workshop, "scheduled_at", None) or datetime.utcnow(),
        duration_minutes=int(getattr(workshop, "duration_minutes", 60) or 60),
        max_participants=int(getattr(workshop, "max_participants", 1) or 1),
        is_active=bool(getattr(workshop, "is_active", True)),
        tutor_name=getattr(workshop, "tutor_name", None),
        tutor_email=getattr(workshop, "tutor_email", None),
        created_at=created_at,
        updated_at=updated_at,
    )


async def _get_tutor_or_403(current_user: User) -> TutorProfile:
    role_value = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role_value != UserRole.TUTOR.value:
        raise HTTPException(status_code=403, detail="Only tutors can manage workshops")
    tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    return tutor


@router.get("/my", response_model=List[WorkshopResponse])
async def get_my_workshops(current_user: User = Depends(get_current_user)):
    tutor = await _get_tutor_or_403(current_user)
    workshops = await Workshop.find(Workshop.tutor_id == str(tutor.id)).sort("-scheduled_at").to_list()
    return [await _to_response(w, current_user=current_user) for w in workshops]


@router.get("/public", response_model=List[WorkshopResponse])
async def get_public_workshops(
    q: Optional[str] = Query(default=None, min_length=1, max_length=140),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=100),
    upcoming_only: bool = Query(default=True),
):
    filters = {"is_active": True}
    now_utc = datetime.utcnow()

    if q and q.strip():
        term = q.strip()
        filters["$or"] = [
            {"title": {"$regex": term, "$options": "i"}},
            {"description": {"$regex": term, "$options": "i"}},
            {"modules": {"$elemMatch": {"$regex": term, "$options": "i"}}},
            {"tutor_name": {"$regex": term, "$options": "i"}},
        ]

    workshops = await Workshop.find(filters).sort("scheduled_at").to_list()
    if upcoming_only:
        workshops = [w for w in workshops if not _is_workshop_expired(w, now_utc)]
    workshops = workshops[skip:skip + limit]

    results: List[WorkshopResponse] = []
    for workshop in workshops:
        try:
            results.append(await _to_response(workshop))
        except Exception:
            logger.exception("Skipping invalid public workshop id=%s", getattr(workshop, "id", "unknown"))
    return results


@router.get("/public/{workshop_id}", response_model=WorkshopResponse)
async def get_public_workshop_detail(workshop_id: str):
    workshop = await Workshop.get(workshop_id)
    if not workshop or not workshop.is_active or _is_workshop_expired(workshop):
        raise HTTPException(status_code=404, detail="Workshop not found")
    return await _to_response(workshop)


@router.post("/my", response_model=WorkshopResponse)
async def create_workshop(payload: WorkshopCreate, current_user: User = Depends(get_current_user)):
    tutor = await _get_tutor_or_403(current_user)

    workshop = Workshop(
        tutor_id=str(tutor.id),
        tutor_user_id=str(current_user.id),
        title=payload.title.strip(),
        description=(payload.description or "").strip() or None,
        modules=[m.strip() for m in (payload.modules or []) if m and m.strip()],
        thumbnail_url=payload.thumbnail_url,
        amount=payload.amount,
        currency=(payload.currency or tutor.currency or "INR").upper(),
        scheduled_at=_normalize_to_utc_naive(payload.scheduled_at),
        duration_minutes=payload.duration_minutes,
        max_participants=payload.max_participants,
        is_active=payload.is_active,
        tutor_name=tutor.full_name,
        tutor_email=tutor.email,
        updated_at=datetime.utcnow(),
    )
    await workshop.insert()
    return await _to_response(workshop, current_user=current_user)


@router.put("/my/{workshop_id}", response_model=WorkshopResponse)
async def update_workshop(workshop_id: str, payload: WorkshopUpdate, current_user: User = Depends(get_current_user)):
    tutor = await _get_tutor_or_403(current_user)
    workshop = await Workshop.get(workshop_id)
    if not workshop or workshop.tutor_id != str(tutor.id):
        raise HTTPException(status_code=404, detail="Workshop not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "title" in update_data and update_data["title"] is not None:
        update_data["title"] = update_data["title"].strip()
    if "description" in update_data and update_data["description"] is not None:
        update_data["description"] = update_data["description"].strip() or None
    if "modules" in update_data and update_data["modules"] is not None:
        update_data["modules"] = [m.strip() for m in update_data["modules"] if m and m.strip()]
    if "currency" in update_data and update_data["currency"] is not None:
        update_data["currency"] = update_data["currency"].upper()
    if "scheduled_at" in update_data and update_data["scheduled_at"] is not None:
        update_data["scheduled_at"] = _normalize_to_utc_naive(update_data["scheduled_at"])

    for field, value in update_data.items():
        setattr(workshop, field, value)
    workshop.updated_at = datetime.utcnow()

    await workshop.save()
    return await _to_response(workshop, current_user=current_user)


@router.delete("/my/{workshop_id}")
async def delete_workshop(workshop_id: str, current_user: User = Depends(get_current_user)):
    tutor = await _get_tutor_or_403(current_user)
    workshop = await Workshop.get(workshop_id)
    if not workshop or workshop.tutor_id != str(tutor.id):
        raise HTTPException(status_code=404, detail="Workshop not found")
    await workshop.delete()
    return {"message": "Workshop deleted successfully"}
