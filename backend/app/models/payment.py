from beanie import Document, Indexed
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from enum import Enum


class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class FeeType(str, Enum):
    SESSION_COMMISSION = "session_commission"  # 5% per session
    ADMISSION_FEE = "admission_fee"  # 10% for new students


class Payment(Document):
    """Track all payments and platform fees"""
    booking_id: Indexed(str)
    student_id: Indexed(str)
    tutor_id: Indexed(str)

    # Session details
    session_amount: float  # Total session price
    currency: str = "INR"

    # Fee breakdown
    admission_fee: float = 0.0  # 10% for new students (first booking)
    commission_fee: float = 0.0  # 5% platform commission
    total_platform_fee: float = 0.0  # admission_fee + commission_fee
    tutor_earnings: float = 0.0  # session_amount - total_platform_fee

    # Razorpay fields
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None

    # Status
    status: PaymentStatus = PaymentStatus.PENDING
    is_first_booking: bool = False  # Whether this is student's first booking
    payment_method: str = "razorpay"

    # Timestamps
    created_at: datetime = datetime.utcnow()
    completed_at: Optional[datetime] = None

    class Settings:
        name = "payments"


class PlatformRevenue(Document):
    """Track platform revenue summary"""
    date: Indexed(datetime)  # Daily summary

    # Revenue breakdown
    total_session_fees: float = 0.0  # Sum of all session amounts
    total_admission_fees: float = 0.0  # 10% from new students
    total_commission_fees: float = 0.0  # 5% from all sessions
    total_platform_revenue: float = 0.0  # admission + commission
    total_tutor_payouts: float = 0.0  # Amount paid to tutors

    # Counts
    total_bookings: int = 0
    new_student_bookings: int = 0

    created_at: datetime = datetime.utcnow()
    updated_at: datetime = datetime.utcnow()

    class Settings:
        name = "platform_revenue"


class StudentTutorRelation(Document):
    """Track student-tutor relationships to determine first-time bookings"""
    student_id: Indexed(str)
    tutor_id: Indexed(str)
    first_booking_id: str
    first_booking_date: datetime
    total_bookings: int = 1
    total_spent: float = 0.0

    created_at: datetime = datetime.utcnow()
    updated_at: datetime = datetime.utcnow()

    class Settings:
        name = "student_tutor_relations"
        indexes = [
            [("student_id", 1), ("tutor_id", 1)],  # Compound index
        ]


# Pydantic models for API responses
class PaymentResponse(BaseModel):
    id: str
    booking_id: str
    student_id: str
    tutor_id: str
    session_amount: float
    currency: str
    admission_fee: float
    commission_fee: float
    total_platform_fee: float
    tutor_earnings: float
    status: str
    is_first_booking: bool
    created_at: datetime

    class Config:
        from_attributes = True


class RevenueStats(BaseModel):
    """Revenue statistics for admin dashboard"""
    # Overall totals
    total_revenue: float
    total_admission_fees: float
    total_commission_fees: float
    total_tutor_payouts: float

    # Counts
    total_payments: int
    total_new_students: int

    # This month
    monthly_revenue: float
    monthly_admission_fees: float
    monthly_commission_fees: float
    monthly_bookings: int

    # This week
    weekly_revenue: float
    weekly_bookings: int


class TutorEarnings(BaseModel):
    """Tutor earnings breakdown"""
    tutor_id: str
    tutor_name: str
    total_sessions: int
    total_earnings: float
    platform_fees_paid: float
    pending_payout: float
