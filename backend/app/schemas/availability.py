from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from app.models.availability import DayOfWeek

class TimeSlotSchema(BaseModel):
    start_time: str  # Format: "HH:MM"
    end_time: str    # Format: "HH:MM"

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

class AvailabilityResponse(BaseModel):
    id: str
    tutor_id: str
    timezone: str
    session_duration: int
    buffer_time: int
    advance_booking_days: int
    min_notice_hours: int
    is_accepting_students: bool
    weekly_schedule: Dict[str, List[TimeSlotSchema]]
    created_at: datetime
    updated_at: datetime

class BlockedDateCreate(BaseModel):
    date: str  # Format: "YYYY-MM-DD"
    reason: Optional[str] = None

class BlockedDateResponse(BaseModel):
    id: str
    tutor_id: str
    date: datetime
    reason: Optional[str]
    created_at: datetime

class BlockedDatesListResponse(BaseModel):
    blocked_dates: List[BlockedDateResponse]
    total: int

class CalendarDayStatus(BaseModel):
    date: str  # Format: "YYYY-MM-DD"
    is_available: bool
    is_blocked: bool
    reason: Optional[str] = None
    slots_count: int = 0

class MonthCalendarResponse(BaseModel):
    year: int
    month: int
    days: List[CalendarDayStatus]
