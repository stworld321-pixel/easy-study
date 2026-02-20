from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.booking import BookingStatus, SessionType

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
    scheduled_at: datetime
    duration_minutes: int
    price: float
    currency: str
    status: BookingStatus
    notes: Optional[str] = None
    meeting_link: Optional[str] = None
    google_event_id: Optional[str] = None
    created_at: datetime

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
    created_at: datetime
