from datetime import datetime, timedelta
from typing import Optional
from app.models.payment import Payment, PaymentStatus, StudentTutorRelation, RevenueStats
from app.models.booking import Booking
from app.models.platform_settings import PlatformSettings


# Default rates (used when platform settings doc is not available)
DEFAULT_COMMISSION_RATE = 0.05
DEFAULT_STUDENT_PLATFORM_FEE_RATE = 0.0


class PaymentService:
    """Service for handling payments and fee calculations"""

    @staticmethod
    async def is_first_booking(student_id: str, tutor_id: str) -> bool:
        """Check if this is the student's first booking with this tutor"""
        relation = await StudentTutorRelation.find_one(
            StudentTutorRelation.student_id == student_id,
            StudentTutorRelation.tutor_id == tutor_id
        )
        return relation is None

    @staticmethod
    async def get_platform_rates() -> tuple[float, float]:
        settings = await PlatformSettings.get_or_create()
        commission = settings.tutor_commission_rate
        student_fee = settings.student_platform_fee_rate
        return max(0.0, float(commission)), max(0.0, float(student_fee))

    @staticmethod
    async def calculate_fees(session_amount: float, is_first_booking: bool) -> dict:
        """Calculate fee and payout breakdown for a booking."""
        commission_rate, student_platform_fee_rate = await PaymentService.get_platform_rates()
        commission_fee = round(session_amount * commission_rate, 2)
        student_platform_fee = round(session_amount * student_platform_fee_rate, 2)
        total_platform_fee = round(commission_fee + student_platform_fee, 2)
        tutor_earnings = round(session_amount - commission_fee, 2)
        charge_amount = round(session_amount + student_platform_fee, 2)

        return {
            "session_amount": session_amount,
            "commission_fee": commission_fee,
            # Keep admission_fee populated for backward compatibility in admin UI/reports.
            "admission_fee": student_platform_fee,
            "student_platform_fee": student_platform_fee,
            "total_platform_fee": total_platform_fee,
            "tutor_earnings": tutor_earnings,
            "charge_amount": charge_amount,
            "tutor_commission_rate": commission_rate,
            "student_platform_fee_rate": student_platform_fee_rate,
            "is_first_booking": is_first_booking,
        }

    @staticmethod
    async def create_payment(
        booking_id: str,
        student_id: str,
        tutor_id: str,
        session_amount: float,
        currency: str = "USD"
    ) -> Payment:
        """Create a payment record for a booking"""
        # Check if first booking
        is_first = await PaymentService.is_first_booking(student_id, tutor_id)

        # Calculate fees
        fees = await PaymentService.calculate_fees(session_amount, is_first)

        # Create payment record
        payment = Payment(
            booking_id=booking_id,
            student_id=student_id,
            tutor_id=tutor_id,
            session_amount=session_amount,
            currency=currency,
            admission_fee=fees["admission_fee"],
            commission_fee=fees["commission_fee"],
            student_platform_fee=fees["student_platform_fee"],
            total_platform_fee=fees["total_platform_fee"],
            tutor_earnings=fees["tutor_earnings"],
            charge_amount=fees["charge_amount"],
            tutor_commission_rate=fees["tutor_commission_rate"],
            student_platform_fee_rate=fees["student_platform_fee_rate"],
            is_first_booking=is_first,
            status=PaymentStatus.PENDING
        )
        await payment.insert()

        # If first booking, create/update student-tutor relation
        if is_first:
            relation = StudentTutorRelation(
                student_id=student_id,
                tutor_id=tutor_id,
                first_booking_id=booking_id,
                first_booking_date=datetime.utcnow(),
                total_bookings=1,
                total_spent=session_amount
            )
            await relation.insert()
        else:
            # Update existing relation
            relation = await StudentTutorRelation.find_one(
                StudentTutorRelation.student_id == student_id,
                StudentTutorRelation.tutor_id == tutor_id
            )
            if relation:
                relation.total_bookings += 1
                relation.total_spent += session_amount
                relation.updated_at = datetime.utcnow()
                await relation.save()

        return payment

    @staticmethod
    async def complete_payment(payment_id: str) -> Optional[Payment]:
        """Mark payment as completed"""
        payment = await Payment.get(payment_id)
        if payment:
            payment.status = PaymentStatus.COMPLETED
            payment.completed_at = datetime.utcnow()
            await payment.save()
        return payment

    @staticmethod
    async def get_payment_by_booking(booking_id: str) -> Optional[Payment]:
        """Get payment for a specific booking"""
        return await Payment.find_one(Payment.booking_id == booking_id)

    @staticmethod
    async def get_revenue_stats() -> RevenueStats:
        """Get platform revenue statistics for admin dashboard"""
        now = datetime.utcnow()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        start_of_week = now - timedelta(days=now.weekday())
        start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)

        # Get all completed payments
        all_payments = await Payment.find(
            Payment.status == PaymentStatus.COMPLETED
        ).to_list()

        # Calculate totals
        total_revenue = sum(p.total_platform_fee for p in all_payments)
        total_admission_fees = sum(p.admission_fee for p in all_payments)
        total_commission_fees = sum(p.commission_fee for p in all_payments)
        total_tutor_payouts = sum(p.tutor_earnings for p in all_payments)
        total_new_students = len([p for p in all_payments if p.is_first_booking])

        # Monthly stats
        monthly_payments = [p for p in all_payments if p.created_at >= start_of_month]
        monthly_revenue = sum(p.total_platform_fee for p in monthly_payments)
        monthly_admission_fees = sum(p.admission_fee for p in monthly_payments)
        monthly_commission_fees = sum(p.commission_fee for p in monthly_payments)

        # Weekly stats
        weekly_payments = [p for p in all_payments if p.created_at >= start_of_week]
        weekly_revenue = sum(p.total_platform_fee for p in weekly_payments)

        return RevenueStats(
            total_revenue=round(total_revenue, 2),
            total_admission_fees=round(total_admission_fees, 2),
            total_commission_fees=round(total_commission_fees, 2),
            total_tutor_payouts=round(total_tutor_payouts, 2),
            total_payments=len(all_payments),
            total_new_students=total_new_students,
            monthly_revenue=round(monthly_revenue, 2),
            monthly_admission_fees=round(monthly_admission_fees, 2),
            monthly_commission_fees=round(monthly_commission_fees, 2),
            monthly_bookings=len(monthly_payments),
            weekly_revenue=round(weekly_revenue, 2),
            weekly_bookings=len(weekly_payments)
        )

    @staticmethod
    async def get_tutor_earnings(tutor_id: str) -> dict:
        """Get earnings breakdown for a specific tutor"""
        payments = await Payment.find(
            Payment.tutor_id == tutor_id,
            Payment.status == PaymentStatus.COMPLETED
        ).to_list()

        total_sessions = len(payments)
        total_earnings = sum(p.tutor_earnings for p in payments)
        platform_fees_paid = sum(p.total_platform_fee for p in payments)

        # Get pending payments
        pending_payments = await Payment.find(
            Payment.tutor_id == tutor_id,
            Payment.status == PaymentStatus.PENDING
        ).to_list()
        pending_earnings = sum(p.tutor_earnings for p in pending_payments)

        return {
            "tutor_id": tutor_id,
            "total_sessions": total_sessions,
            "total_earnings": round(total_earnings, 2),
            "platform_fees_paid": round(platform_fees_paid, 2),
            "pending_earnings": round(pending_earnings, 2)
        }

    @staticmethod
    async def get_all_payments(
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> list:
        """Get all payments with optional filtering"""
        query = {}
        if status:
            query["status"] = status

        payments = await Payment.find(query).skip(skip).limit(limit).sort("-created_at").to_list()
        return payments

    @staticmethod
    async def get_payment_breakdown(payment_id: str) -> Optional[dict]:
        """Get detailed breakdown of a payment"""
        payment = await Payment.get(payment_id)
        if not payment:
            return None

        return {
            "id": str(payment.id),
            "booking_id": payment.booking_id,
            "session_amount": payment.session_amount,
            "currency": payment.currency,
            "fees": {
                "commission_fee": {
                    "amount": payment.commission_fee,
                    "rate": f"{payment.tutor_commission_rate * 100}%",
                    "description": "Tutor commission"
                },
                "admission_fee": {
                    "amount": payment.admission_fee,
                    "rate": f"{payment.student_platform_fee_rate * 100}%",
                    "description": "Student platform fee"
                }
            },
            "total_platform_fee": payment.total_platform_fee,
            "tutor_earnings": payment.tutor_earnings,
            "charge_amount": payment.charge_amount or payment.session_amount,
            "is_first_booking": payment.is_first_booking,
            "status": payment.status
        }


# Singleton instance
payment_service = PaymentService()
