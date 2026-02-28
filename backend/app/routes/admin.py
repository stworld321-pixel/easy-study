"""
Admin Routes - Manage users, tutors, and bookings
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timedelta
from app.models.user import User, UserRole
from app.models.tutor import TutorProfile
from app.models.booking import Booking, BookingStatus
from app.models.payment import Payment, PaymentStatus
from app.models.platform_settings import PlatformSettings
from app.routes.auth import get_current_user
from app.services.notification_service import notification_service
from app.services.payment_service import payment_service
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["Admin"])


# --- Schemas ---
class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    phone: Optional[str] = None
    is_active: bool
    is_verified: bool
    created_at: datetime

class TutorResponse(BaseModel):
    id: str
    user_id: str
    email: str
    full_name: str
    headline: Optional[str] = None
    subjects: List[str] = []
    hourly_rate: float = 0
    is_verified: bool = False
    is_active: bool = True  # Maps to is_available in model
    total_sessions: int = 0  # Maps to total_lessons in model
    rating: float = 0
    created_at: datetime

class BookingResponse(BaseModel):
    id: str
    student_id: str
    student_name: str
    student_email: str
    tutor_id: str
    tutor_name: str
    tutor_email: str
    subject: str
    scheduled_at: datetime
    duration_minutes: int
    status: str
    price: float
    meeting_link: Optional[str] = None
    created_at: datetime

class DashboardStats(BaseModel):
    total_users: int
    total_students: int
    total_tutors: int
    total_bookings: int
    pending_bookings: int
    confirmed_bookings: int
    completed_bookings: int
    cancelled_bookings: int
    revenue_total: float
    revenue_this_month: float
    new_users_this_week: int
    new_bookings_this_week: int

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    role: Optional[str] = None


# --- Helper: Admin Check ---
async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    # Handle both string and enum role
    role = current_user.role.value if hasattr(current_user.role, 'value') else current_user.role
    if role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# --- Dashboard Stats ---
@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(admin: User = Depends(get_admin_user)):
    """Get overall dashboard statistics"""
    try:
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Count users
        total_users = await User.count()
        total_students = await User.find(User.role == UserRole.STUDENT).count()
        total_tutors = await User.find(User.role == UserRole.TUTOR).count()

        # Count bookings
        total_bookings = await Booking.count()
        pending_bookings = await Booking.find(Booking.status == BookingStatus.PENDING).count()
        confirmed_bookings = await Booking.find(Booking.status == BookingStatus.CONFIRMED).count()
        completed_bookings = await Booking.find(Booking.status == BookingStatus.COMPLETED).count()
        cancelled_bookings = await Booking.find(Booking.status == BookingStatus.CANCELLED).count()

        # Revenue calculations
        paid_bookings = await Booking.find(
            {"status": {"$in": [BookingStatus.CONFIRMED.value, BookingStatus.COMPLETED.value]}}
        ).to_list()
        revenue_total = sum(b.price for b in paid_bookings)

        month_bookings = [b for b in paid_bookings if b.created_at >= month_start]
        revenue_this_month = sum(b.price for b in month_bookings)

        # New this week
        new_users_this_week = await User.find(User.created_at >= week_ago).count()
        new_bookings_this_week = await Booking.find(Booking.created_at >= week_ago).count()

        return DashboardStats(
            total_users=total_users,
            total_students=total_students,
            total_tutors=total_tutors,
            total_bookings=total_bookings,
            pending_bookings=pending_bookings,
            confirmed_bookings=confirmed_bookings,
            completed_bookings=completed_bookings,
            cancelled_bookings=cancelled_bookings,
            revenue_total=revenue_total,
            revenue_this_month=revenue_this_month,
            new_users_this_week=new_users_this_week,
            new_bookings_this_week=new_bookings_this_week
        )
    except Exception as e:
        print(f"Error in get_dashboard_stats: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# --- User Management ---
@router.get("/users", response_model=List[UserResponse])
async def get_all_users(
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_admin_user)
):
    """Get all users with optional filters"""
    query = User.find()

    if role:
        query = User.find(User.role == role)
    if is_active is not None:
        query = query.find(User.is_active == is_active)

    users = await query.skip(skip).limit(limit).to_list()

    # Filter by search if provided
    if search:
        search_lower = search.lower()
        users = [u for u in users if search_lower in u.full_name.lower() or search_lower in u.email.lower()]

    return [
        UserResponse(
            id=str(u.id),
            email=u.email,
            full_name=u.full_name,
            role=u.role.value if hasattr(u.role, 'value') else u.role,
            phone=u.phone,
            is_active=u.is_active,
            is_verified=u.is_verified,
            created_at=u.created_at
        ) for u in users
    ]


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, admin: User = Depends(get_admin_user)):
    """Get a specific user by ID"""
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role.value if hasattr(user.role, 'value') else user.role,
        phone=user.phone,
        is_active=user.is_active,
        is_verified=user.is_verified,
        created_at=user.created_at
    )


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, data: UserUpdate, admin: User = Depends(get_admin_user)):
    """Update a user's details"""
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.is_verified is not None:
        user.is_verified = data.is_verified
    if data.role is not None:
        user.role = UserRole(data.role)

    user.updated_at = datetime.utcnow()
    await user.save()

    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role.value if hasattr(user.role, 'value') else user.role,
        phone=user.phone,
        is_active=user.is_active,
        is_verified=user.is_verified,
        created_at=user.created_at
    )


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: User = Depends(get_admin_user)):
    """Delete a user"""
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Don't allow deleting yourself
    if str(user.id) == str(admin.id):
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    await user.delete()
    return {"message": "User deleted successfully"}


# --- Tutor Management ---
@router.get("/tutors", response_model=List[TutorResponse])
async def get_all_tutors(
    is_verified: Optional[bool] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_admin_user)
):
    """Get all tutor profiles"""
    try:
        # Get all tutors first
        tutors = await TutorProfile.find_all().skip(skip).limit(limit).to_list()

        result = []
        for t in tutors:
            # Filter by verification status
            if is_verified is not None and t.is_verified != is_verified:
                continue
            # Filter by active status (is_available in model)
            if is_active is not None and t.is_available != is_active:
                continue

            # Get tutor name and email from denormalized fields or user
            tutor_name = t.full_name or "Unknown"
            tutor_email = t.email or ""

            # Apply search filter
            if search:
                search_lower = search.lower()
                if search_lower not in tutor_name.lower() and search_lower not in tutor_email.lower():
                    continue

            result.append(TutorResponse(
                id=str(t.id),
                user_id=str(t.user_id),
                email=tutor_email,
                full_name=tutor_name,
                headline=t.headline,
                subjects=t.subjects or [],
                hourly_rate=t.hourly_rate or 0,
                is_verified=t.is_verified,
                is_active=t.is_available,  # Map is_available to is_active
                total_sessions=t.total_lessons,  # Map total_lessons to total_sessions
                rating=t.rating or 0,
                created_at=t.created_at
            ))

        return result
    except Exception as e:
        print(f"Error in get_all_tutors: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/tutors/{tutor_id}/verify")
async def verify_tutor(tutor_id: str, admin: User = Depends(get_admin_user)):
    """Verify a tutor"""
    tutor = await TutorProfile.get(tutor_id)
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found")

    tutor.is_verified = True
    tutor.updated_at = datetime.utcnow()
    await tutor.save()

    # Send notification to tutor
    try:
        await notification_service.notify_tutor_verified(tutor_user_id=tutor.user_id)
    except Exception as e:
        print(f"Failed to send verification notification: {e}")

    return {"message": "Tutor verified successfully"}


@router.put("/tutors/{tutor_id}/suspend")
async def suspend_tutor(tutor_id: str, admin: User = Depends(get_admin_user)):
    """Suspend a tutor"""
    tutor = await TutorProfile.get(tutor_id)
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found")

    tutor.is_available = False
    tutor.updated_at = datetime.utcnow()
    await tutor.save()

    # Send notification to tutor
    try:
        await notification_service.notify_tutor_suspended(tutor_user_id=tutor.user_id)
    except Exception as e:
        print(f"Failed to send suspension notification: {e}")

    return {"message": "Tutor suspended successfully"}


@router.put("/tutors/{tutor_id}/activate")
async def activate_tutor(tutor_id: str, admin: User = Depends(get_admin_user)):
    """Activate a suspended tutor"""
    tutor = await TutorProfile.get(tutor_id)
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found")

    tutor.is_available = True
    tutor.updated_at = datetime.utcnow()
    await tutor.save()

    return {"message": "Tutor activated successfully"}


# --- Booking Management ---
@router.get("/bookings", response_model=List[BookingResponse])
async def get_all_bookings(
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_admin_user)
):
    """Get all bookings"""
    query = Booking.find()

    if status:
        query = query.find(Booking.status == status)

    bookings = await query.sort(-Booking.created_at).skip(skip).limit(limit).to_list()

    result = []
    for b in bookings:
        student = await User.get(b.student_id)
        tutor_profile = await TutorProfile.get(b.tutor_id)
        tutor_user = await User.get(tutor_profile.user_id) if tutor_profile else None

        if search:
            search_lower = search.lower()
            student_match = student and (search_lower in student.full_name.lower() or search_lower in student.email.lower())
            tutor_match = tutor_user and (search_lower in tutor_user.full_name.lower() or search_lower in tutor_user.email.lower())
            if not student_match and not tutor_match:
                continue

        result.append(BookingResponse(
            id=str(b.id),
            student_id=str(b.student_id),
            student_name=student.full_name if student else "Unknown",
            student_email=student.email if student else "",
            tutor_id=str(b.tutor_id),
            tutor_name=tutor_user.full_name if tutor_user else "Unknown",
            tutor_email=tutor_user.email if tutor_user else "",
            subject=b.subject,
            scheduled_at=b.scheduled_at,
            duration_minutes=b.duration_minutes,
            status=b.status,
            price=b.price,
            meeting_link=b.meeting_link,
            created_at=b.created_at
        ))

    return result


@router.put("/bookings/{booking_id}/status")
async def update_booking_status(
    booking_id: str,
    status: str = Query(..., regex="^(pending|confirmed|completed|cancelled)$"),
    admin: User = Depends(get_admin_user)
):
    """Update booking status"""
    booking = await Booking.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking.status = status
    booking.updated_at = datetime.utcnow()
    await booking.save()

    return {"message": f"Booking status updated to {status}"}


@router.delete("/bookings/{booking_id}")
async def delete_booking(booking_id: str, admin: User = Depends(get_admin_user)):
    """Delete a booking"""
    booking = await Booking.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    await booking.delete()
    return {"message": "Booking deleted successfully"}


# --- Revenue Management ---
class RevenueStatsResponse(BaseModel):
    total_revenue: float
    total_admission_fees: float
    total_commission_fees: float
    total_tutor_payouts: float
    total_payments: int
    total_new_students: int
    monthly_revenue: float
    monthly_admission_fees: float
    monthly_commission_fees: float
    monthly_bookings: int
    weekly_revenue: float
    weekly_bookings: int
    commission_rate: float
    student_platform_fee_rate: float
    admission_rate: float


class PaymentResponse(BaseModel):
    id: str
    booking_id: str
    student_id: str
    student_name: Optional[str] = None
    tutor_id: str
    tutor_name: Optional[str] = None
    session_amount: float
    currency: str
    admission_fee: float
    commission_fee: float
    total_platform_fee: float
    tutor_earnings: float
    status: str
    is_first_booking: bool
    created_at: datetime
    completed_at: Optional[datetime] = None


class TutorEarningsResponse(BaseModel):
    tutor_id: str
    tutor_name: str
    email: str
    total_sessions: int
    total_earnings: float
    platform_fees_paid: float
    pending_earnings: float


@router.get("/revenue/stats", response_model=RevenueStatsResponse)
async def get_revenue_stats(admin: User = Depends(get_admin_user)):
    """Get platform revenue statistics"""
    try:
        settings = await PlatformSettings.get_or_create()
        stats = await payment_service.get_revenue_stats()
        return RevenueStatsResponse(
            total_revenue=stats.total_revenue,
            total_admission_fees=stats.total_admission_fees,
            total_commission_fees=stats.total_commission_fees,
            total_tutor_payouts=stats.total_tutor_payouts,
            total_payments=stats.total_payments,
            total_new_students=stats.total_new_students,
            monthly_revenue=stats.monthly_revenue,
            monthly_admission_fees=stats.monthly_admission_fees,
            monthly_commission_fees=stats.monthly_commission_fees,
            monthly_bookings=stats.monthly_bookings,
            weekly_revenue=stats.weekly_revenue,
            weekly_bookings=stats.weekly_bookings,
            commission_rate=settings.tutor_commission_rate * 100,
            student_platform_fee_rate=settings.student_platform_fee_rate * 100,
            # Backward-compatible field name used by current frontend cards.
            admission_rate=settings.student_platform_fee_rate * 100
        )
    except Exception as e:
        print(f"Error getting revenue stats: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/revenue/payments", response_model=List[PaymentResponse])
async def get_all_payments(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_admin_user)
):
    """Get all payment records"""
    try:
        payments = await payment_service.get_all_payments(status=status, skip=skip, limit=limit)

        result = []
        for p in payments:
            # Get student and tutor names
            student = await User.get(p.student_id)
            tutor = await TutorProfile.get(p.tutor_id)

            result.append(PaymentResponse(
                id=str(p.id),
                booking_id=p.booking_id,
                student_id=p.student_id,
                student_name=student.full_name if student else "Unknown",
                tutor_id=p.tutor_id,
                tutor_name=tutor.full_name if tutor else "Unknown",
                session_amount=p.session_amount,
                currency=p.currency,
                admission_fee=p.admission_fee,
                commission_fee=p.commission_fee,
                total_platform_fee=p.total_platform_fee,
                tutor_earnings=p.tutor_earnings,
                status=p.status.value if hasattr(p.status, 'value') else p.status,
                is_first_booking=p.is_first_booking,
                created_at=p.created_at,
                completed_at=p.completed_at
            ))

        return result
    except Exception as e:
        print(f"Error getting payments: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/revenue/payments/{payment_id}")
async def get_payment_breakdown(payment_id: str, admin: User = Depends(get_admin_user)):
    """Get detailed breakdown of a payment"""
    breakdown = await payment_service.get_payment_breakdown(payment_id)
    if not breakdown:
        raise HTTPException(status_code=404, detail="Payment not found")
    return breakdown


@router.get("/revenue/tutor-earnings", response_model=List[TutorEarningsResponse])
async def get_all_tutor_earnings(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_admin_user)
):
    """Get earnings breakdown for all tutors"""
    try:
        tutors = await TutorProfile.find_all().skip(skip).limit(limit).to_list()

        result = []
        for tutor in tutors:
            earnings = await payment_service.get_tutor_earnings(str(tutor.id))
            result.append(TutorEarningsResponse(
                tutor_id=str(tutor.id),
                tutor_name=tutor.full_name or "Unknown",
                email=tutor.email or "",
                total_sessions=earnings["total_sessions"],
                total_earnings=earnings["total_earnings"],
                platform_fees_paid=earnings["platform_fees_paid"],
                pending_earnings=earnings["pending_earnings"]
            ))

        return result
    except Exception as e:
        print(f"Error getting tutor earnings: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/revenue/tutor-earnings/{tutor_id}")
async def get_tutor_earnings(tutor_id: str, admin: User = Depends(get_admin_user)):
    """Get earnings breakdown for a specific tutor"""
    tutor = await TutorProfile.get(tutor_id)
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found")

    earnings = await payment_service.get_tutor_earnings(tutor_id)
    return {
        "tutor_id": tutor_id,
        "tutor_name": tutor.full_name,
        "email": tutor.email,
        **earnings
    }


# --- Platform Settings ---

class PlatformSettingsResponse(BaseModel):
    minimum_withdrawal_amount: float
    tutor_commission_rate: float
    student_platform_fee_rate: float
    display_currency: str
    inr_to_usd_rate: float

class PlatformSettingsUpdate(BaseModel):
    minimum_withdrawal_amount: Optional[float] = None
    tutor_commission_rate: Optional[float] = None
    student_platform_fee_rate: Optional[float] = None
    display_currency: Optional[str] = None
    inr_to_usd_rate: Optional[float] = None


@router.get("/settings", response_model=PlatformSettingsResponse)
async def get_platform_settings(admin: User = Depends(get_admin_user)):
    """Get platform settings"""
    settings = await PlatformSettings.get_or_create()
    return PlatformSettingsResponse(
        minimum_withdrawal_amount=settings.minimum_withdrawal_amount,
        tutor_commission_rate=settings.tutor_commission_rate,
        student_platform_fee_rate=settings.student_platform_fee_rate,
        display_currency=settings.display_currency,
        inr_to_usd_rate=settings.inr_to_usd_rate
    )


@router.put("/settings", response_model=PlatformSettingsResponse)
async def update_platform_settings(data: PlatformSettingsUpdate, admin: User = Depends(get_admin_user)):
    """Update platform settings"""
    settings = await PlatformSettings.get_or_create()

    if data.minimum_withdrawal_amount is not None:
        if data.minimum_withdrawal_amount < 0:
            raise HTTPException(status_code=400, detail="Minimum withdrawal amount cannot be negative")
        settings.minimum_withdrawal_amount = data.minimum_withdrawal_amount
    if data.tutor_commission_rate is not None:
        if data.tutor_commission_rate < 0 or data.tutor_commission_rate > 1:
            raise HTTPException(status_code=400, detail="Tutor commission rate must be between 0 and 1")
        settings.tutor_commission_rate = data.tutor_commission_rate
    if data.student_platform_fee_rate is not None:
        if data.student_platform_fee_rate < 0 or data.student_platform_fee_rate > 1:
            raise HTTPException(status_code=400, detail="Student platform fee rate must be between 0 and 1")
        settings.student_platform_fee_rate = data.student_platform_fee_rate
    if data.display_currency is not None:
        currency = data.display_currency.upper()
        if currency not in {"INR", "USD"}:
            raise HTTPException(status_code=400, detail="Display currency must be INR or USD")
        settings.display_currency = currency
    if data.inr_to_usd_rate is not None:
        if data.inr_to_usd_rate <= 0:
            raise HTTPException(status_code=400, detail="INR to USD rate must be greater than 0")
        settings.inr_to_usd_rate = data.inr_to_usd_rate

    settings.updated_at = datetime.utcnow()
    settings.updated_by = str(admin.id)
    await settings.save()

    return PlatformSettingsResponse(
        minimum_withdrawal_amount=settings.minimum_withdrawal_amount,
        tutor_commission_rate=settings.tutor_commission_rate,
        student_platform_fee_rate=settings.student_platform_fee_rate,
        display_currency=settings.display_currency,
        inr_to_usd_rate=settings.inr_to_usd_rate
    )
