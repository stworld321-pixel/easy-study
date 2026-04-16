from datetime import datetime, timezone
from typing import List, Optional
from types import SimpleNamespace

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.models.tutor import TutorProfile
from app.models.booking import SessionType
from app.models.user import User, UserRole
from app.models.workshop import Workshop
from app.core.config import settings
from app.routes.auth import get_current_user
from app.routes.bookings import _build_jitsi_access_token, _resolve_meeting_domain_and_room, _meeting_jwt_required
from app.schemas.booking import UtcDatetime

router = APIRouter()


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


def _build_tutor_join_url(workshop: Workshop, current_user: User) -> Optional[str]:
    if _meeting_jwt_required() and not ((settings.JITSI_APP_SECRET or "").strip() or (settings.JAAS_PRIVATE_KEY or "").strip()):
        return None

    room_key = f"zc-w-{str(workshop.id)}".lower().replace(" ", "-")
    domain, room_name, meeting_url = _resolve_meeting_domain_and_room(room_key)
    fake_booking = SimpleNamespace(
        id=str(workshop.id),
        tutor_id=workshop.tutor_id,
        student_id="",
        session_type=SessionType.GROUP,
    )
    token = _build_jitsi_access_token(
        room_name=room_name,
        booking=fake_booking,  # duck-typed for JWT payload generation
        user=current_user,
        is_moderator=True,
    )
    if not token:
        return None
    return f"{meeting_url}?jwt={token}"


def _to_response(workshop: Workshop, current_user: Optional[User] = None) -> WorkshopResponse:
    base_url = (settings.FRONTEND_URL or "").rstrip("/")
    public_url = f"{base_url}/workshops/{str(workshop.id)}" if base_url else None
    join_url = _build_tutor_join_url(workshop, current_user) if current_user else None
    return WorkshopResponse(
        id=str(workshop.id),
        tutor_id=workshop.tutor_id,
        tutor_user_id=workshop.tutor_user_id,
        public_url=public_url,
        join_url=join_url,
        title=workshop.title,
        description=workshop.description,
        modules=workshop.modules or [],
        thumbnail_url=workshop.thumbnail_url,
        amount=float(workshop.amount or 0),
        currency=workshop.currency or "INR",
        scheduled_at=workshop.scheduled_at,
        duration_minutes=int(workshop.duration_minutes or 60),
        max_participants=int(workshop.max_participants or 1),
        is_active=bool(workshop.is_active),
        tutor_name=workshop.tutor_name,
        tutor_email=workshop.tutor_email,
        created_at=workshop.created_at,
        updated_at=workshop.updated_at,
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
    return [_to_response(w, current_user=current_user) for w in workshops]


@router.get("/public", response_model=List[WorkshopResponse])
async def get_public_workshops(
    q: Optional[str] = Query(default=None, min_length=1, max_length=140),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=100),
    upcoming_only: bool = Query(default=True),
):
    filters = {"is_active": True}
    if upcoming_only:
        filters["scheduled_at"] = {"$gte": datetime.utcnow()}

    if q and q.strip():
        term = q.strip()
        filters["$or"] = [
            {"title": {"$regex": term, "$options": "i"}},
            {"description": {"$regex": term, "$options": "i"}},
            {"modules": {"$elemMatch": {"$regex": term, "$options": "i"}}},
            {"tutor_name": {"$regex": term, "$options": "i"}},
        ]

    workshops = (
        await Workshop.find(filters)
        .sort("scheduled_at")
        .skip(skip)
        .limit(limit)
        .to_list()
    )
    return [_to_response(w) for w in workshops]


@router.get("/public/{workshop_id}", response_model=WorkshopResponse)
async def get_public_workshop_detail(workshop_id: str):
    workshop = await Workshop.get(workshop_id)
    if not workshop or not workshop.is_active:
        raise HTTPException(status_code=404, detail="Workshop not found")
    return _to_response(workshop)


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
    return _to_response(workshop, current_user=current_user)


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
    return _to_response(workshop, current_user=current_user)


@router.delete("/my/{workshop_id}")
async def delete_workshop(workshop_id: str, current_user: User = Depends(get_current_user)):
    tutor = await _get_tutor_or_403(current_user)
    workshop = await Workshop.get(workshop_id)
    if not workshop or workshop.tutor_id != str(tutor.id):
        raise HTTPException(status_code=404, detail="Workshop not found")
    await workshop.delete()
    return {"message": "Workshop deleted successfully"}
