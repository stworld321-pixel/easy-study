from datetime import datetime
from enum import Enum

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
