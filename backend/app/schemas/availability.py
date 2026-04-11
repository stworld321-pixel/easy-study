from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from app.models.availability import DayOfWeek
from app.schemas.booking import UtcDatetime

class TimeSlotSchema(BaseModel):
    start_time: str  # Format: "HH:MM"
    end_time: str    # Format: "HH:MM"
    is_available: Optional[bool] = None
    booked_count: Optional[int] = None
    capacity: Optional[int] = None
    status: Optional[str] = None

class WeeklyScheduleUpdate(BaseModel):
    monday: List[TimeSlotSchema] = []
    tuesday: List[TimeSlotSchema] = []
    wednesday: List[TimeSlotSchema] = []
    thursday: List[TimeSlotSchema] = []
    friday: List[TimeSlotSchema] = []
    saturday: List[TimeSlotSchema] = []
    sunday: List[TimeSlotSchema] = []

class AvailabilitySettingsUpdate(BaseModel):
    timezone: Optional[str] = None
    session_duration: Optional[int] = None
    buffer_time: Optional[int] = None
    advance_booking_days: Optional[int] = None
    min_notice_hours: Optional[int] = None
    is_accepting_students: Optional[bool] = None
    group_session_capacity: Optional[int] = None

class AvailabilityResponse(BaseModel):
    id: str
    tutor_id: str
    timezone: str
    session_duration: int
    buffer_time: int
    advance_booking_days: int
    min_notice_hours: int
    is_accepting_students: bool
    group_session_capacity: int
    private_weekly_schedule: Dict[str, List[TimeSlotSchema]]
    group_weekly_schedule: Dict[str, List[TimeSlotSchema]]
    # Backward compatibility for existing frontend consumers.
    weekly_schedule: Dict[str, List[TimeSlotSchema]]
    created_at: UtcDatetime
    updated_at: UtcDatetime

class BlockedDateCreate(BaseModel):
    date: str  # Format: "YYYY-MM-DD"
    reason: Optional[str] = None

class BlockedDateResponse(BaseModel):
    id: str
    tutor_id: str
    date: UtcDatetime
    reason: Optional[str]
    created_at: UtcDatetime

class BlockedDatesListResponse(BaseModel):
    blocked_dates: List[BlockedDateResponse]
    total: int

class CalendarDayStatus(BaseModel):
    date: str  # Format: "YYYY-MM-DD"
    is_available: bool
    is_blocked: bool
    reason: Optional[str] = None
    slots_count: int = 0
    time_slots: List[TimeSlotSchema] = Field(default_factory=list)

class MonthCalendarResponse(BaseModel):
    year: int
    month: int
    session_duration: int
    buffer_time: int
    # IANA timezone name that defines the semantic meaning of every HH:MM
    # slot in `days[*].time_slots`. The frontend uses this to convert the
    # user's pick into a UTC ISO string before sending it back.
    tutor_timezone: Optional[str] = None
    days: List[CalendarDayStatus]
