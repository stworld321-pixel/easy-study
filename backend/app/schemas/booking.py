from pydantic import BaseModel, Field, PlainSerializer
from typing import Optional
from typing_extensions import Annotated
from datetime import datetime, timezone
from app.models.booking import BookingStatus, SessionType


def _to_utc_iso_z(v: datetime) -> str:
    """Serialize a datetime as a UTC ISO-8601 string ending in 'Z'.
    Naive values are assumed to be UTC (our storage convention)."""
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)
    else:
        v = v.astimezone(timezone.utc)
    return v.isoformat().replace("+00:00", "Z")


UtcDatetime = Annotated[datetime, PlainSerializer(_to_utc_iso_z, return_type=str)]


class BookingCreate(BaseModel):
    tutor_id: str
    subject: str
    session_type: SessionType = SessionType.PRIVATE
    scheduled_at: datetime
    duration_minutes: int = 60
    notes: Optional[str] = None
    currency: str = "INR"  # Currency for payment (INR or USD)

class BookingUpdate(BaseModel):
    status: Optional[BookingStatus] = None
    scheduled_at: Optional[datetime] = None
    notes: Optional[str] = None
    meeting_link: Optional[str] = None
    session_name: Optional[str] = None
    is_workshop: Optional[bool] = None

class BookingResponse(BaseModel):
    id: str
    student_id: str
    tutor_id: str
    student_name: Optional[str] = None
    tutor_name: Optional[str] = None
    student_email: Optional[str] = None
    tutor_email: Optional[str] = None
    subject: str
    session_type: SessionType
    scheduled_at: UtcDatetime
    duration_minutes: int
    price: float
    currency: str
    session_name: Optional[str] = None
    is_workshop: bool = False
    status: BookingStatus
    notes: Optional[str] = None
    meeting_link: Optional[str] = None
    meeting_room_key: Optional[str] = None
    meeting_provider: Optional[str] = None
    meeting_origin: Optional[str] = None
    meeting_link_expires_at: Optional[UtcDatetime] = None
    meeting_link_expired: bool = False
    google_event_id: Optional[str] = None
    created_at: UtcDatetime

class ReviewCreate(BaseModel):
    tutor_id: str
    booking_id: Optional[str] = None
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None

class ReviewResponse(BaseModel):
    id: str
    student_id: str
    tutor_id: str
    student_name: Optional[str] = None
    student_avatar: Optional[str] = None
    rating: int
    comment: Optional[str] = None
    created_at: UtcDatetime
