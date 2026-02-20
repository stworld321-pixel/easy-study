from beanie import Document, Indexed
from pydantic import Field
from typing import Optional
from datetime import datetime
from enum import Enum

class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class SessionType(str, Enum):
    PRIVATE = "private"
    GROUP = "group"

class Booking(Document):
    student_id: Indexed(str)
    tutor_id: Indexed(str)

    subject: str
    session_type: SessionType = SessionType.PRIVATE
    scheduled_at: datetime
    duration_minutes: int = 60

    price: float
    currency: str = "INR"

    status: BookingStatus = BookingStatus.PENDING
    payment_status: str = "pending"  # pending, paid, refunded
    notes: Optional[str] = None
    meeting_link: Optional[str] = None
    google_event_id: Optional[str] = None  # Google Calendar event ID

    # Denormalized data
    student_name: Optional[str] = None
    tutor_name: Optional[str] = None
    student_email: Optional[str] = None
    tutor_email: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "bookings"

class Review(Document):
    student_id: Indexed(str)
    tutor_id: Indexed(str)
    booking_id: Optional[str] = None

    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None

    # Denormalized
    student_name: Optional[str] = None
    student_avatar: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "reviews"
