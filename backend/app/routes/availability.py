from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List
from datetime import datetime, timedelta, timezone, tzinfo
import calendar
from zoneinfo import ZoneInfo
from app.models.user import User
from app.models.tutor import TutorProfile
from app.models.availability import TutorAvailability, BlockedDate
from app.models.booking_slot import BookingSlot
from app.models.booking import Booking, BookingStatus
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
EFFECTIVE_MIN_NOTICE_HOURS = 0

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


def _normalize_time_str(time_value: str) -> str:
    minutes = _parse_minutes(time_value)
    hour = minutes // 60
    minute = minutes % 60
    return f"{hour:02d}:{minute:02d}"


def _normalize_time_str_safe(time_value: str, fallback: str = "00:00") -> str:
    try:
        return _normalize_time_str(time_value)
    except Exception:
        return fallback


def _day_slot_starts(day_slots: list, session_duration: int) -> list[str]:
    starts: list[str] = []
    for slot in day_slots:
        start = _parse_minutes(slot.get("start_time", "00:00"))
        end = _parse_minutes(slot.get("end_time", "00:00"))
        if end <= start:
            continue
        t = start
        while t + session_duration <= end:
            starts.append(f"{t // 60:02d}:{t % 60:02d}")
            t += session_duration
    return sorted(set(starts))


def _slot_end(start_time: str, session_duration: int) -> str:
    start = _parse_minutes(start_time)
    end = start + session_duration
    return f"{(end // 60) % 24:02d}:{end % 60:02d}"


def _to_session_type_value(raw: object) -> str:
    return getattr(raw, "value", str(raw))

def _get_tutor_timezone(availability: TutorAvailability) -> tzinfo:
    timezone_name = (availability.timezone or "UTC").strip() or "UTC"
    try:
        return ZoneInfo(timezone_name)
    except Exception:
        try:
            return ZoneInfo("UTC")
        except Exception:
            return timezone.utc


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
        "monday": [{"start_time": _normalize_time_str(slot.start_time), "end_time": _normalize_time_str(slot.end_time)} for slot in schedule.monday],
        "tuesday": [{"start_time": _normalize_time_str(slot.start_time), "end_time": _normalize_time_str(slot.end_time)} for slot in schedule.tuesday],
        "wednesday": [{"start_time": _normalize_time_str(slot.start_time), "end_time": _normalize_time_str(slot.end_time)} for slot in schedule.wednesday],
        "thursday": [{"start_time": _normalize_time_str(slot.start_time), "end_time": _normalize_time_str(slot.end_time)} for slot in schedule.thursday],
        "friday": [{"start_time": _normalize_time_str(slot.start_time), "end_time": _normalize_time_str(slot.end_time)} for slot in schedule.friday],
        "saturday": [{"start_time": _normalize_time_str(slot.start_time), "end_time": _normalize_time_str(slot.end_time)} for slot in schedule.saturday],
        "sunday": [{"start_time": _normalize_time_str(slot.start_time), "end_time": _normalize_time_str(slot.end_time)} for slot in schedule.sunday],
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
        normalized_day_slots = [
            {
                "start_time": _normalize_time_str_safe(slot.get("start_time", "00:00"), "00:00"),
                "end_time": _normalize_time_str_safe(slot.get("end_time", "00:00"), "00:00"),
            }
            for slot in day_slots
        ]
        slots_count = len(normalized_day_slots)
        is_available = slots_count > 0 and not is_blocked

        days.append(CalendarDayStatus(
            date=date_str,
            is_available=is_available,
            is_blocked=is_blocked,
            reason=reason,
            slots_count=slots_count,
            time_slots=normalized_day_slots if is_available else []
        ))

    return MonthCalendarResponse(
        year=year,
        month=month,
        session_duration=availability.session_duration,
        buffer_time=availability.buffer_time,
        tutor_timezone=availability.timezone,
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

    availability = await TutorAvailability.find_one(TutorAvailability.tutor_id == tutor_id)
    if not availability:
        return MonthCalendarResponse(year=year, month=month, session_duration=60, buffer_time=0, days=[])

    if session_type == "private" and not tutor.offers_private:
        return MonthCalendarResponse(year=year, month=month, session_duration=60, buffer_time=0, days=[])
    if session_type == "group":
        has_group_slots = any(
            isinstance(slots, list) and len(slots) > 0
            for slots in (availability.group_weekly_schedule or {}).values()
        )
        # Backward compatibility: allow group calendars when schedule exists,
        # even if offers_group flag was not toggled in profile.
        if not tutor.offers_group and not has_group_slots:
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

    # Booking-slot occupancy for this month (source of truth for capacity/full state)
    slot_docs = await BookingSlot.find({
        "tutor_id": tutor_id,
        "scheduled_at": {"$gte": start_date, "$lt": end_date},
    }).to_list()
    slot_index = {
        f"{slot.scheduled_at.strftime('%Y-%m-%d')}|{slot.scheduled_at.strftime('%H:%M')}": slot
        for slot in slot_docs
    }

    # Legacy fallback for historical rows without booking_slots
    active_bookings = await Booking.find({
        "tutor_id": tutor_id,
        "scheduled_at": {"$gte": start_date, "$lt": end_date},
        "status": {"$in": [BookingStatus.PENDING.value, BookingStatus.CONFIRMED.value]},
    }).to_list()
    legacy_counts: dict[str, int] = {}
    legacy_types: dict[str, set[str]] = {}
    for b in active_bookings:
        key = f"{b.scheduled_at.strftime('%Y-%m-%d')}|{b.scheduled_at.strftime('%H:%M')}"
        legacy_counts[key] = legacy_counts.get(key, 0) + 1
        legacy_types.setdefault(key, set()).add(_to_session_type_value(b.session_type))

    # Generate calendar days
    days = []
    num_days = calendar.monthrange(year, month)[1]
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    tutor_tz = _get_tutor_timezone(availability)
    tutor_now = datetime.now(tutor_tz)
    today = tutor_now.date()

    for day in range(1, num_days + 1):
        date_obj = datetime(year, month, day)
        date_str = date_obj.strftime("%Y-%m-%d")
        day_of_week = day_names[date_obj.weekday()]

        # Check if blocked or in the past
        is_blocked = date_str in blocked_set or date_obj.date() < today

        # Build real booking slots for this day
        session_schedule = _get_schedule_by_session_type(availability, session_type)
        day_slots = session_schedule.get(day_of_week, [])
        slot_starts = _day_slot_starts(day_slots, availability.session_duration)
        min_notice_cutoff = tutor_now + timedelta(hours=EFFECTIVE_MIN_NOTICE_HOURS)

        normalized_day_slots = []
        available_count = 0

        for start_time in slot_starts:
            hour, minute = map(int, start_time.split(":"))
            slot_dt = datetime(year, month, day, hour, minute, tzinfo=tutor_tz)
            key = f"{date_str}|{start_time}"
            slot_doc = slot_index.get(key)

            capacity = 1 if session_type == "private" else max(1, int(availability.group_session_capacity or 1))
            booked_count = 0
            status = "open"
            is_slot_available = True

            if slot_dt.date() < min_notice_cutoff.date():
                is_slot_available = False
                status = "past"

            if slot_doc:
                doc_type = _to_session_type_value(slot_doc.session_type)
                if doc_type != session_type:
                    booked_count = max(slot_doc.booked_count, 1)
                    capacity = max(slot_doc.capacity, 1)
                    is_slot_available = False
                    status = "booked_other_type"
                else:
                    booked_count = max(slot_doc.booked_count, 0)
                    capacity = max(slot_doc.capacity, capacity)
                    if booked_count >= capacity:
                        is_slot_available = False
                        status = "full"
            else:
                legacy_count = legacy_counts.get(key, 0)
                legacy_type_set = legacy_types.get(key, set())
                if legacy_type_set and session_type not in legacy_type_set:
                    booked_count = legacy_count
                    is_slot_available = False
                    status = "booked_other_type"
                elif legacy_count > 0:
                    booked_count = legacy_count
                    if session_type == "private" and legacy_count >= 1:
                        is_slot_available = False
                        status = "full"
                    elif session_type == "group" and legacy_count >= capacity:
                        is_slot_available = False
                        status = "full"

            if is_blocked or not availability.is_accepting_students:
                is_slot_available = False
                if status == "open":
                    status = "blocked"

            if is_slot_available:
                available_count += 1

            normalized_day_slots.append({
                "start_time": start_time,
                "end_time": _slot_end(start_time, availability.session_duration),
                "is_available": is_slot_available,
                "booked_count": booked_count,
                "capacity": capacity,
                "status": status,
            })

        total_slots = len(normalized_day_slots)
        is_available = available_count > 0 and not is_blocked and availability.is_accepting_students

        days.append(CalendarDayStatus(
            date=date_str,
            is_available=is_available,
            is_blocked=is_blocked,
            reason=None,  # Don't expose reasons to students
            # Expose only bookable slot count to the student UI.
            slots_count=available_count if is_available else 0,
            time_slots=normalized_day_slots
        ))

    return MonthCalendarResponse(
        year=year,
        month=month,
        session_duration=availability.session_duration,
        buffer_time=availability.buffer_time,
        tutor_timezone=availability.timezone,
        days=days
    )
