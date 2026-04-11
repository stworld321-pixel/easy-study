from datetime import datetime
from enum import Enum
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.booking import SessionType


class SlotStatus(str, Enum):
    OPEN = "open"
    FULL = "full"


class BookingSlot(Document):
    tutor_id: Indexed(str)
    scheduled_at: datetime
    duration_minutes: int = 60
    session_type: SessionType
    capacity: int = 1
    booked_count: int = 0
    status: SlotStatus = SlotStatus.OPEN
    # One-way latch flipped the first time the tutor opens the meeting
    # room for this slot. Students are blocked from joining until this
    # is set, which guarantees the tutor is always the first joiner —
    # otherwise (on meet.jit.si and similar deployments that don't
    # enforce our JWT moderator claim) whoever walks in first silently
    # becomes the room admin. Stored on the slot so group/workshop
    # sessions share a single latch across all participant bookings.
    tutor_joined_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "booking_slots"
        indexes = [
            IndexModel(
                [
                    ("tutor_id", ASCENDING),
                    ("scheduled_at", ASCENDING),
                    ("duration_minutes", ASCENDING),
                ],
                unique=True,
            )
        ]
