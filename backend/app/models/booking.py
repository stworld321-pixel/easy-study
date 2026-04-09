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
    session_name: Optional[str] = None
    is_workshop: bool = False

    status: BookingStatus = BookingStatus.PENDING
    payment_status: str = "pending"  # pending, paid, refunded

    # Cancellation tracking — populated whenever a booking is cancelled so the
    # admin panel can show who cancelled and decide on refunds.
    cancelled_by_role: Optional[str] = None  # student | tutor | admin
    cancelled_by_id: Optional[str] = None
    cancelled_by_name: Optional[str] = None
    cancelled_at: Optional[datetime] = None

    # Refund workflow (only meaningful when payment_status was "paid" at time of cancel).
    # None = no refund needed; "pending" = awaiting admin action; "completed" = admin marked refunded.
    refund_status: Optional[str] = None
    refunded_at: Optional[datetime] = None
    refund_reference: Optional[str] = None  # bank/UPI/Razorpay reference id from admin
    refund_notes: Optional[str] = None
    notes: Optional[str] = None
    meeting_link: Optional[str] = None
    meeting_room_key: Optional[str] = None
    meeting_provider: Optional[str] = None  # jitsi | google_meet
    meeting_origin: Optional[str] = None    # lms_embedded | tutor_google_calendar | shared_group_event | tutor_manual
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
