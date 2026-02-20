from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timedelta
import calendar
from app.models.user import User
from app.models.tutor import TutorProfile
from app.models.availability import TutorAvailability, BlockedDate
from app.schemas.availability import (
    WeeklyScheduleUpdate,
    AvailabilitySettingsUpdate,
    AvailabilityResponse,
    BlockedDateCreate,
    BlockedDateResponse,
    BlockedDatesListResponse,
    CalendarDayStatus,
    MonthCalendarResponse,
    TimeSlotSchema
)
from app.routes.auth import get_current_user

router = APIRouter()

async def get_or_create_availability(tutor_id: str) -> TutorAvailability:
    """Get tutor availability or create default one"""
    availability = await TutorAvailability.find_one(TutorAvailability.tutor_id == tutor_id)
    if not availability:
        availability = TutorAvailability(tutor_id=tutor_id)
        await availability.insert()
    return availability

@router.get("/settings", response_model=AvailabilityResponse)
async def get_availability_settings(current_user: User = Depends(get_current_user)):
    """Get current tutor's availability settings"""
    tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    availability = await get_or_create_availability(str(tutor.id))

    return AvailabilityResponse(
        id=str(availability.id),
        tutor_id=availability.tutor_id,
        timezone=availability.timezone,
        session_duration=availability.session_duration,
        buffer_time=availability.buffer_time,
        advance_booking_days=availability.advance_booking_days,
        min_notice_hours=availability.min_notice_hours,
        is_accepting_students=availability.is_accepting_students,
        weekly_schedule=availability.weekly_schedule,
        created_at=availability.created_at,
        updated_at=availability.updated_at
    )

@router.put("/settings", response_model=AvailabilityResponse)
async def update_availability_settings(
    settings: AvailabilitySettingsUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update availability settings"""
    tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    availability = await get_or_create_availability(str(tutor.id))

    update_data = settings.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(availability, key, value)

    availability.updated_at = datetime.utcnow()
    await availability.save()

    return AvailabilityResponse(
        id=str(availability.id),
        tutor_id=availability.tutor_id,
        timezone=availability.timezone,
        session_duration=availability.session_duration,
        buffer_time=availability.buffer_time,
        advance_booking_days=availability.advance_booking_days,
        min_notice_hours=availability.min_notice_hours,
        is_accepting_students=availability.is_accepting_students,
        weekly_schedule=availability.weekly_schedule,
        created_at=availability.created_at,
        updated_at=availability.updated_at
    )

@router.put("/schedule", response_model=AvailabilityResponse)
async def update_weekly_schedule(
    schedule: WeeklyScheduleUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update weekly availability schedule"""
    tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    availability = await get_or_create_availability(str(tutor.id))

    # Convert schedule to dict format
    schedule_dict = {
        "monday": [slot.model_dump() for slot in schedule.monday],
        "tuesday": [slot.model_dump() for slot in schedule.tuesday],
        "wednesday": [slot.model_dump() for slot in schedule.wednesday],
        "thursday": [slot.model_dump() for slot in schedule.thursday],
        "friday": [slot.model_dump() for slot in schedule.friday],
        "saturday": [slot.model_dump() for slot in schedule.saturday],
        "sunday": [slot.model_dump() for slot in schedule.sunday],
    }

    availability.weekly_schedule = schedule_dict
    availability.updated_at = datetime.utcnow()
    await availability.save()

    return AvailabilityResponse(
        id=str(availability.id),
        tutor_id=availability.tutor_id,
        timezone=availability.timezone,
        session_duration=availability.session_duration,
        buffer_time=availability.buffer_time,
        advance_booking_days=availability.advance_booking_days,
        min_notice_hours=availability.min_notice_hours,
        is_accepting_students=availability.is_accepting_students,
        weekly_schedule=availability.weekly_schedule,
        created_at=availability.created_at,
        updated_at=availability.updated_at
    )

@router.post("/blocked-dates", response_model=BlockedDateResponse)
async def add_blocked_date(
    blocked_date: BlockedDateCreate,
    current_user: User = Depends(get_current_user)
):
    """Add a blocked date (leave/holiday)"""
    tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    # Parse the date string to datetime
    try:
        date_obj = datetime.strptime(blocked_date.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Check if date already blocked
    existing = await BlockedDate.find_one(
        BlockedDate.tutor_id == str(tutor.id),
        BlockedDate.date == date_obj
    )
    if existing:
        raise HTTPException(status_code=400, detail="This date is already blocked")

    new_blocked = BlockedDate(
        tutor_id=str(tutor.id),
        date=date_obj,
        reason=blocked_date.reason
    )
    await new_blocked.insert()

    return BlockedDateResponse(
        id=str(new_blocked.id),
        tutor_id=new_blocked.tutor_id,
        date=new_blocked.date,
        reason=new_blocked.reason,
        created_at=new_blocked.created_at
    )

@router.delete("/blocked-dates/{date_id}")
async def remove_blocked_date(
    date_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove a blocked date"""
    tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    blocked = await BlockedDate.get(date_id)
    if not blocked or blocked.tutor_id != str(tutor.id):
        raise HTTPException(status_code=404, detail="Blocked date not found")

    await blocked.delete()
    return {"message": "Blocked date removed successfully"}

@router.get("/blocked-dates", response_model=BlockedDatesListResponse)
async def get_blocked_dates(
    current_user: User = Depends(get_current_user)
):
    """Get all blocked dates for current tutor"""
    tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    blocked_dates = await BlockedDate.find(
        BlockedDate.tutor_id == str(tutor.id)
    ).sort(+BlockedDate.date).to_list()

    return BlockedDatesListResponse(
        blocked_dates=[
            BlockedDateResponse(
                id=str(bd.id),
                tutor_id=bd.tutor_id,
                date=bd.date,
                reason=bd.reason,
                created_at=bd.created_at
            ) for bd in blocked_dates
        ],
        total=len(blocked_dates)
    )

@router.get("/calendar/{year}/{month}", response_model=MonthCalendarResponse)
async def get_month_calendar(
    year: int,
    month: int,
    current_user: User = Depends(get_current_user)
):
    """Get calendar view for a specific month"""
    tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    availability = await get_or_create_availability(str(tutor.id))

    # Get blocked dates for the month
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)

    blocked_dates = await BlockedDate.find(
        BlockedDate.tutor_id == str(tutor.id),
        BlockedDate.date >= start_date,
        BlockedDate.date < end_date
    ).to_list()

    blocked_dict = {bd.date.strftime("%Y-%m-%d"): bd.reason for bd in blocked_dates}

    # Generate calendar days
    days = []
    num_days = calendar.monthrange(year, month)[1]
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

    for day in range(1, num_days + 1):
        date_obj = datetime(year, month, day)
        date_str = date_obj.strftime("%Y-%m-%d")
        day_of_week = day_names[date_obj.weekday()]

        # Check if blocked
        is_blocked = date_str in blocked_dict
        reason = blocked_dict.get(date_str)

        # Check if has availability slots for this day
        day_slots = availability.weekly_schedule.get(day_of_week, [])
        slots_count = len(day_slots)
        is_available = slots_count > 0 and not is_blocked

        days.append(CalendarDayStatus(
            date=date_str,
            is_available=is_available,
            is_blocked=is_blocked,
            reason=reason,
            slots_count=slots_count
        ))

    return MonthCalendarResponse(
        year=year,
        month=month,
        days=days
    )

@router.get("/public/{tutor_id}/calendar/{year}/{month}")
async def get_tutor_public_calendar(
    tutor_id: str,
    year: int,
    month: int
):
    """Get public calendar view for a tutor (for students to see available slots)"""
    tutor = await TutorProfile.get(tutor_id)
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found")

    availability = await TutorAvailability.find_one(TutorAvailability.tutor_id == tutor_id)
    if not availability:
        return MonthCalendarResponse(year=year, month=month, days=[])

    # Get blocked dates for the month
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)

    blocked_dates = await BlockedDate.find(
        BlockedDate.tutor_id == tutor_id,
        BlockedDate.date >= start_date,
        BlockedDate.date < end_date
    ).to_list()

    blocked_set = {bd.date.strftime("%Y-%m-%d") for bd in blocked_dates}

    # Generate calendar days
    days = []
    num_days = calendar.monthrange(year, month)[1]
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    today = datetime.now().date()

    for day in range(1, num_days + 1):
        date_obj = datetime(year, month, day)
        date_str = date_obj.strftime("%Y-%m-%d")
        day_of_week = day_names[date_obj.weekday()]

        # Check if blocked or in the past
        is_blocked = date_str in blocked_set or date_obj.date() < today

        # Check if has availability slots for this day
        day_slots = availability.weekly_schedule.get(day_of_week, [])
        slots_count = len(day_slots)
        is_available = slots_count > 0 and not is_blocked and availability.is_accepting_students

        days.append(CalendarDayStatus(
            date=date_str,
            is_available=is_available,
            is_blocked=is_blocked,
            reason=None,  # Don't expose reasons to students
            slots_count=slots_count if is_available else 0
        ))

    return MonthCalendarResponse(
        year=year,
        month=month,
        days=days
    )
