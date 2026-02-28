"""
Payment Routes - Razorpay Integration
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import logging
from app.models.user import User
from app.models.booking import Booking
from app.models.payment import Payment, PaymentStatus
from app.models.platform_settings import PlatformSettings
from app.routes.auth import get_current_user
from app.services.razorpay_service import razorpay_service
from app.services.payment_service import payment_service
from app.core.config import settings

router = APIRouter(prefix="/payments", tags=["Payments"])
logger = logging.getLogger(__name__)
MIN_ORDER_AMOUNT = 1.0


# --- Schemas ---
class CreateOrderRequest(BaseModel):
    booking_id: str


class CreateOrderResponse(BaseModel):
    success: bool
    order_id: Optional[str] = None
    amount: Optional[int] = None
    currency: Optional[str] = None
    key_id: Optional[str] = None
    payment_id: Optional[str] = None
    error: Optional[str] = None


class VerifyPaymentRequest(BaseModel):
    booking_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class PaymentDetailsResponse(BaseModel):
    id: str
    booking_id: str
    session_amount: float
    currency: str
    admission_fee: float
    commission_fee: float
    total_platform_fee: float
    tutor_earnings: float
    status: str
    is_first_booking: bool
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    created_at: datetime


@router.post("/create-order", response_model=CreateOrderResponse)
async def create_razorpay_order(
    request: CreateOrderRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Create a Razorpay order for a booking.
    This should be called before initiating the payment.
    """
    # Get the booking
    booking = await Booking.get(request.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Verify the user owns this booking
    if booking.student_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get or create payment record
    payment = await payment_service.get_payment_by_booking(request.booking_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    # If payment already completed, return error
    if payment.status == PaymentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Payment already completed")

    charge_amount = payment.charge_amount if payment.charge_amount and payment.charge_amount > 0 else payment.session_amount

    # Guard before hitting Razorpay API.
    if charge_amount < MIN_ORDER_AMOUNT:
        return CreateOrderResponse(
            success=False,
            error=(
                f"Order amount ({payment.currency} {charge_amount:.2f}) is below minimum allowed "
                f"({payment.currency} {MIN_ORDER_AMOUNT:.2f})."
            )
        )

    # Create Razorpay order
    order_result = razorpay_service.create_order(
        amount=charge_amount,
        currency=payment.currency,
        receipt=f"booking_{request.booking_id}",
        notes={
            "booking_id": request.booking_id,
            "student_id": str(current_user.id),
            "student_email": current_user.email
        }
    )

    if not order_result["success"]:
        return CreateOrderResponse(
            success=False,
            error=order_result.get("error", "Failed to create order")
        )

    # Update payment with Razorpay order ID
    payment.razorpay_order_id = order_result["order_id"]
    await payment.save()

    return CreateOrderResponse(
        success=True,
        order_id=order_result["order_id"],
        amount=order_result["amount"],
        currency=order_result["currency"],
        key_id=order_result["key_id"],
        payment_id=str(payment.id)
    )


@router.post("/verify")
async def verify_razorpay_payment(
    request: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Verify Razorpay payment after successful payment.
    This completes the payment and confirms the booking.
    """
    # Get the booking
    booking = await Booking.get(request.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Verify the user owns this booking
    if booking.student_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get payment record
    payment = await payment_service.get_payment_by_booking(request.booking_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    # Verify the order ID matches
    if payment.razorpay_order_id != request.razorpay_order_id:
        raise HTTPException(status_code=400, detail="Order ID mismatch")

    # Verify signature
    is_valid = razorpay_service.verify_payment(
        request.razorpay_order_id,
        request.razorpay_payment_id,
        request.razorpay_signature
    )

    if not is_valid:
        payment.status = PaymentStatus.FAILED
        await payment.save()
        raise HTTPException(status_code=400, detail="Payment verification failed")

    # Update payment record
    payment.razorpay_payment_id = request.razorpay_payment_id
    payment.razorpay_signature = request.razorpay_signature
    payment.status = PaymentStatus.COMPLETED
    payment.completed_at = datetime.utcnow()
    await payment.save()

    # Update booking status to indicate payment received
    booking.payment_status = "paid"
    await booking.save()

    return {
        "success": True,
        "message": "Payment verified successfully",
        "payment_id": str(payment.id),
        "booking_id": request.booking_id
    }


@router.get("/booking/{booking_id}", response_model=PaymentDetailsResponse)
async def get_payment_details(
    booking_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get payment details for a booking"""
    # Get the booking
    booking = await Booking.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Verify authorization
    if booking.student_id != str(current_user.id) and booking.tutor_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get payment record
    payment = await payment_service.get_payment_by_booking(booking_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    return PaymentDetailsResponse(
        id=str(payment.id),
        booking_id=payment.booking_id,
        session_amount=payment.session_amount,
        currency=payment.currency,
        admission_fee=payment.admission_fee,
        commission_fee=payment.commission_fee,
        total_platform_fee=payment.total_platform_fee,
        tutor_earnings=payment.tutor_earnings,
        status=payment.status.value if hasattr(payment.status, 'value') else payment.status,
        is_first_booking=payment.is_first_booking,
        razorpay_order_id=payment.razorpay_order_id,
        razorpay_payment_id=payment.razorpay_payment_id,
        created_at=payment.created_at
    )


@router.get("/my-payments")
async def get_my_payments(current_user: User = Depends(get_current_user)):
    """Get all payments for the current user"""
    payments = await Payment.find(
        Payment.student_id == str(current_user.id)
    ).sort("-created_at").to_list()

    return [
        {
            "id": str(p.id),
            "booking_id": p.booking_id,
            "session_amount": p.session_amount,
            "currency": p.currency,
            "total_platform_fee": p.total_platform_fee,
            "status": p.status.value if hasattr(p.status, 'value') else p.status,
            "created_at": p.created_at
        }
        for p in payments
    ]


@router.get("/config")
async def get_razorpay_config():
    """Get Razorpay public configuration"""
    platform_settings = await PlatformSettings.get_or_create()
    return {
        "key_id": settings.RAZORPAY_KEY_ID,
        "currency": "INR",
        "name": "Zeal Catalyst",
        "description": "Tutoring Platform",
        "student_platform_fee_rate": platform_settings.student_platform_fee_rate
    }
