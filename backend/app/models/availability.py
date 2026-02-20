from beanie import Document, Indexed
from pydantic import Field
from typing import Optional, List
from datetime import datetime, date, time
from enum import Enum

class DayOfWeek(str, Enum):
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"

class TimeSlot(Document):
    """Individual time slot for a tutor's availability"""
    tutor_id: Indexed(str)
    day_of_week: DayOfWeek
    start_time: str  # Format: "HH:MM" (24-hour)
    end_time: str    # Format: "HH:MM" (24-hour)
    is_available: bool = True

    class Settings:
        name = "time_slots"

class BlockedDate(Document):
    """Specific dates when tutor is not available (leave/holiday)"""
    tutor_id: Indexed(str)
    date: datetime
    reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "blocked_dates"

class TutorAvailability(Document):
    """Overall availability settings for a tutor"""
    tutor_id: Indexed(str, unique=True)
    timezone: str = "UTC"
    session_duration: int = 60  # Default 60 minutes
    buffer_time: int = 15  # Buffer between sessions in minutes
    advance_booking_days: int = 30  # How far in advance can book
    min_notice_hours: int = 24  # Minimum notice for booking
    is_accepting_students: bool = True
    weekly_schedule: dict = Field(default_factory=lambda: {
        "monday": [],
        "tuesday": [],
        "wednesday": [],
        "thursday": [],
        "friday": [],
        "saturday": [],
        "sunday": []
    })
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "tutor_availability"
