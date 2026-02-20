from fastapi import APIRouter, HTTPException, Depends, Query
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
    # Backfill legacy data into new split schedules.
    if (not availability.private_weekly_schedule) and availability.weekly_schedule:
        availability.private_weekly_schedule = availability.weekly_schedule
    if availability.group_session_capacity < 1:
        availability.group_session_capacity = 1
    return availability


def _get_schedule_by_session_type(availability: TutorAvailability, session_type: str):
    if session_type == "group":
        return availability.group_weekly_schedule
    return availability.private_weekly_schedule or availability.weekly_schedule


def _parse_minutes(time_value: str) -> int:
    try:
        hour, minute = time_value.split(":")
        return (int(hour) * 60) + int(minute)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid time format: {time_value}. Use HH:MM")


def _validate_internal_no_overlap(schedule_dict: dict, label: str) -> None:
    for day, slots in schedule_dict.items():
        normalized = []
        for slot in slots:
            start = _parse_minutes(slot["start_time"])
            end = _parse_minutes(slot["end_time"])
            if end <= start:
                raise HTTPException(
                    status_code=400,
                    detail=f"{label} schedule has invalid slot on {day}: end time must be after start time."
                )
            normalized.append((start, end))
        normalized.sort(key=lambda x: x[0])
        for i in range(1, len(normalized)):
            prev_start, prev_end = normalized[i - 1]
            curr_start, curr_end = normalized[i]
            if curr_start < prev_end:
                raise HTTPException(
                    status_code=400,
                    detail=f"{label} schedule has overlapping slots on {day}."
                )


def _validate_cross_schedule_no_overlap(source_schedule: dict, other_schedule: dict, source_label: str, other_label: str) -> None:
    for day, source_slots in source_schedule.items():
        target_slots = other_schedule.get(day, [])
        if not source_slots or not target_slots:
            continue
        for source_slot in source_slots:
            s_start = _parse_minutes(source_slot["start_time"])
            s_end = _parse_minutes(source_slot["end_time"])
            for target_slot in target_slots:
                t_start = _parse_minutes(target_slot["start_time"])
                t_end = _parse_minutes(target_slot["end_time"])
                if s_start < t_end and t_start < s_end:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"{source_label} and {other_label} schedules overlap on {day}. "
                            "Set group slots outside private slots (before/after)."
                        )
                    )

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
        group_session_capacity=availability.group_session_capacity,
        private_weekly_schedule=availability.private_weekly_schedule or availability.weekly_schedule,
        group_weekly_schedule=availability.group_weekly_schedule,
        weekly_schedule=availability.private_weekly_schedule or availability.weekly_schedule,
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
        group_session_capacity=availability.group_session_capacity,
        private_weekly_schedule=availability.private_weekly_schedule or availability.weekly_schedule,
        group_weekly_schedule=availability.group_weekly_schedule,
        weekly_schedule=availability.private_weekly_schedule or availability.weekly_schedule,
        created_at=availability.created_at,
        updated_at=availability.updated_at
    )

@router.put("/schedule", response_model=AvailabilityResponse)
async def update_weekly_schedule(
    schedule: WeeklyScheduleUpdate,
    session_type: str = Query(default="private", pattern="^(private|group)$"),
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

    _validate_internal_no_overlap(
        schedule_dict,
        "Group" if session_type == "group" else "Private"
    )
    other_schedule = (
        availability.private_weekly_schedule or availability.weekly_schedule
        if session_type == "group"
        else availability.group_weekly_schedule
    ) or {}
    _validate_cross_schedule_no_overlap(
        schedule_dict,
        other_schedule,
        "Group" if session_type == "group" else "Private",
        "Private" if session_type == "group" else "Group",
    )

    if session_type == "group":
        availability.group_weekly_schedule = schedule_dict
    else:
        availability.private_weekly_schedule = schedule_dict
        # Keep legacy field in sync with private schedule.
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
        group_session_capacity=availability.group_session_capacity,
        private_weekly_schedule=availability.private_weekly_schedule or availability.weekly_schedule,
        group_weekly_schedule=availability.group_weekly_schedule,
        weekly_schedule=availability.private_weekly_schedule or availability.weekly_schedule,
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
    session_type: str = Query(default="private", pattern="^(private|group)$"),
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
        session_schedule = _get_schedule_by_session_type(availability, session_type)
        day_slots = session_schedule.get(day_of_week, [])
        slots_count = len(day_slots)
        is_available = slots_count > 0 and not is_blocked

        days.append(CalendarDayStatus(
            date=date_str,
            is_available=is_available,
            is_blocked=is_blocked,
            reason=reason,
            slots_count=slots_count,
            time_slots=day_slots if is_available else []
        ))

    return MonthCalendarResponse(
        year=year,
        month=month,
        session_duration=availability.session_duration,
        buffer_time=availability.buffer_time,
        days=days
    )

@router.get("/public/{tutor_id}/calendar/{year}/{month}")
async def get_tutor_public_calendar(
    tutor_id: str,
    year: int,
    month: int,
    session_type: str = Query(default="private", pattern="^(private|group)$")
):
    """Get public calendar view for a tutor (for students to see available slots)"""
    tutor = await TutorProfile.get(tutor_id)
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found")

    if session_type == "group" and not tutor.offers_group:
        return MonthCalendarResponse(year=year, month=month, session_duration=60, buffer_time=0, days=[])
    if session_type == "private" and not tutor.offers_private:
        return MonthCalendarResponse(year=year, month=month, session_duration=60, buffer_time=0, days=[])

    availability = await TutorAvailability.find_one(TutorAvailability.tutor_id == tutor_id)
    if not availability:
        return MonthCalendarResponse(year=year, month=month, session_duration=60, buffer_time=0, days=[])

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
        session_schedule = _get_schedule_by_session_type(availability, session_type)
        day_slots = session_schedule.get(day_of_week, [])
        slots_count = len(day_slots)
        is_available = slots_count > 0 and not is_blocked and availability.is_accepting_students

        days.append(CalendarDayStatus(
            date=date_str,
            is_available=is_available,
            is_blocked=is_blocked,
            reason=None,  # Don't expose reasons to students
            slots_count=slots_count if is_available else 0,
            time_slots=day_slots if is_available else []
        ))

    return MonthCalendarResponse(
        year=year,
        month=month,
        session_duration=availability.session_duration,
        buffer_time=availability.buffer_time,
        days=days
    )
