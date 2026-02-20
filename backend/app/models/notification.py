"""
Notification Model for real-time notifications
"""

from beanie import Document, Indexed
from pydantic import Field
from typing import Optional, Literal
from datetime import datetime
from enum import Enum


class NotificationType(str, Enum):
    BOOKING_NEW = "booking_new"           # New booking request (for tutor)
    BOOKING_CONFIRMED = "booking_confirmed"  # Booking confirmed (for student)
    BOOKING_CANCELLED = "booking_cancelled"  # Booking cancelled
    BOOKING_REMINDER = "booking_reminder"    # Session reminder
    TUTOR_VERIFIED = "tutor_verified"        # Tutor verification approved
    TUTOR_SUSPENDED = "tutor_suspended"      # Tutor suspended
    REVIEW_RECEIVED = "review_received"      # New review received (for tutor)
    SYSTEM = "system"                        # System announcements


class Notification(Document):
    user_id: Indexed(str)  # Recipient user ID
    type: NotificationType
    title: str
    message: str
    link: Optional[str] = None  # Optional redirect URL

    # Related entity IDs for context
    related_id: Optional[str] = None  # booking_id, tutor_id, etc.

    # Metadata
    is_read: bool = False
    is_seen: bool = False  # For badge count (seen but not necessarily read)

    # Actor info (who triggered the notification)
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    actor_avatar: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    read_at: Optional[datetime] = None

    class Settings:
        name = "notifications"
        indexes = [
            "user_id",
            "is_read",
            "created_at",
        ]
