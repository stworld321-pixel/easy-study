"""
Withdrawal Routes - API endpoints for withdrawal management
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.models.withdrawal import Withdrawal, WithdrawalStatus, PaymentMethod
from app.models.payment import Payment, PaymentStatus
from app.models.booking import Booking
from app.models.tutor import TutorProfile
from app.models.user import User
from app.routes.auth import get_current_user
from app.services.email_service import email_service
from app.core.config import settings
from app.schemas.booking import UtcDatetime
import asyncio
import logging

router = APIRouter(prefix="/withdrawals", tags=["Withdrawals"])
logger = logging.getLogger(__name__)


def _dispatch_background(coro, context: str) -> None:
    async def _runner():
        try:
            await coro
        except Exception:
            logger.exception("Background task failed (%s)", context)
    asyncio.create_task(_runner())


# ============================================
# Schemas
# ============================================

class TutorStats(BaseModel):
    """Tutor earnings and session statistics"""
    total_sessions: int
    completed_sessions: int
    pending_sessions: int
    cancelled_sessions: int

    total_earnings: float
    available_balance: float  # Total earnings - pending withdrawals - completed withdrawals
    pending_withdrawals: float
    withdrawn_amount: float

    currency: str

    # This month stats
    monthly_sessions: int
    monthly_earnings: float

    # Withdrawal settings
    minimum_withdrawal_amount: float = 10.0


class WithdrawalRequest(BaseModel):
    """Schema for creating withdrawal request"""
    amount: float
    payment_method: PaymentMethod = PaymentMethod.BANK_TRANSFER
    payment_details: str  # Bank account, UPI ID, etc.


class WithdrawalResponse(BaseModel):
    """Schema for withdrawal response"""
    id: str
    tutor_id: str
    tutor_name: Optional[str]
    tutor_email: Optional[str]
    amount: float
    currency: str
    payment_method: str
    payment_details: Optional[str]
    status: str
    admin_notes: Optional[str]
    transaction_id: Optional[str]
    created_at: UtcDatetime
    processed_at: Optional[UtcDatetime]


class WithdrawalUpdate(BaseModel):
    """Schema for admin updating withdrawal"""
    status: WithdrawalStatus
    admin_notes: Optional[str] = None
    transaction_id: Optional[str] = None


def withdrawal_to_response(w: Withdrawal) -> WithdrawalResponse:
    return WithdrawalResponse(
        id=str(w.id),
        tutor_id=w.tutor_id,
        tutor_name=w.tutor_name,
        tutor_email=w.tutor_email,
        amount=w.amount,
        currency=w.currency,
        payment_method=w.payment_method.value,
        payment_details=w.payment_details,
        status=w.status.value,
        admin_notes=w.admin_notes,
        transaction_id=w.transaction_id,
        created_at=w.created_at,
        processed_at=w.processed_at
    )


# ============================================
# Tutor Routes
# ============================================

@router.get("/stats", response_model=TutorStats)
async def get_tutor_stats(current_user: User = Depends(get_current_user)):
    """Get tutor's earnings and session statistics"""
    if current_user.role != "tutor":
        raise HTTPException(status_code=403, detail="Only tutors can access this")

    # Get TutorProfile for current user
    tutor_profile = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor_profile:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    # Use TutorProfile ID for queries (payments/bookings use TutorProfile ID, not User ID)
    tutor_id = str(tutor_profile.id)
    user_id = str(current_user.id)  # For withdrawals which use User ID

    # Get all bookings for this tutor
    bookings = await Booking.find({"tutor_id": tutor_id}).to_list()

    total_sessions = len(bookings)
    completed_sessions = len([b for b in bookings if b.status == "completed"])
    pending_sessions = len([b for b in bookings if b.status in ["pending", "confirmed"]])
    cancelled_sessions = len([b for b in bookings if b.status == "cancelled"])

    # Get all completed payments for this tutor
    payments = await Payment.find({
        "tutor_id": tutor_id,
        "status": PaymentStatus.COMPLETED
    }).to_list()

    total_earnings = sum(p.tutor_earnings for p in payments)
    currency = payments[0].currency if payments else "INR"

    # Get withdrawal info (withdrawals use User ID, not TutorProfile ID)
    withdrawals = await Withdrawal.find({"tutor_id": user_id}).to_list()

    pending_withdrawals = sum(
        w.amount for w in withdrawals
        if w.status in [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED]
    )
    withdrawn_amount = sum(
        w.amount for w in withdrawals
        if w.status == WithdrawalStatus.COMPLETED
    )

    available_balance = total_earnings - pending_withdrawals - withdrawn_amount

    # This month stats
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)

    monthly_payments = [p for p in payments if p.created_at >= month_start]
    monthly_sessions = len(monthly_payments)
    monthly_earnings = sum(p.tutor_earnings for p in monthly_payments)

    # Get minimum withdrawal amount from platform settings
    from app.models.platform_settings import PlatformSettings
    platform_settings = await PlatformSettings.get_or_create()

    return TutorStats(
        total_sessions=total_sessions,
        completed_sessions=completed_sessions,
        pending_sessions=pending_sessions,
        cancelled_sessions=cancelled_sessions,
        total_earnings=total_earnings,
        available_balance=max(0, available_balance),
        pending_withdrawals=pending_withdrawals,
        withdrawn_amount=withdrawn_amount,
        currency=currency,
        monthly_sessions=monthly_sessions,
        monthly_earnings=monthly_earnings,
        minimum_withdrawal_amount=platform_settings.minimum_withdrawal_amount
    )


@router.post("", response_model=WithdrawalResponse)
async def request_withdrawal(
    request: WithdrawalRequest,
    current_user: User = Depends(get_current_user)
):
    """Request a withdrawal"""
    if current_user.role != "tutor":
        raise HTTPException(status_code=403, detail="Only tutors can request withdrawals")

    # Get TutorProfile for current user
    tutor_profile = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor_profile:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    tutor_id = str(tutor_profile.id)  # For payment queries
    user_id = str(current_user.id)  # For withdrawal storage/queries

    # Calculate available balance (payments use TutorProfile ID)
    payments = await Payment.find({
        "tutor_id": tutor_id,
        "status": PaymentStatus.COMPLETED
    }).to_list()
    total_earnings = sum(p.tutor_earnings for p in payments)

    # Withdrawals use User ID
    withdrawals = await Withdrawal.find({"tutor_id": user_id}).to_list()
    pending_withdrawals = sum(
        w.amount for w in withdrawals
        if w.status in [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED]
    )
    withdrawn_amount = sum(
        w.amount for w in withdrawals
        if w.status == WithdrawalStatus.COMPLETED
    )

    available_balance = total_earnings - pending_withdrawals - withdrawn_amount

    # Get minimum withdrawal amount from platform settings
    from app.models.platform_settings import PlatformSettings
    platform_settings = await PlatformSettings.get_or_create()
    min_amount = platform_settings.minimum_withdrawal_amount

    # Validate amount
    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    if request.amount < min_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum withdrawal amount is {min_amount:.2f}"
        )

    if request.amount > available_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Available: {available_balance:.2f}"
        )

    # Create withdrawal request (store User ID)
    withdrawal = Withdrawal(
        tutor_id=user_id,
        tutor_name=current_user.full_name,
        tutor_email=current_user.email,
        amount=request.amount,
        currency=payments[0].currency if payments else "INR",
        payment_method=request.payment_method,
        payment_details=request.payment_details,
        status=WithdrawalStatus.PENDING
    )

    await withdrawal.insert()

    # Tutor: withdrawal request acknowledgement
    if current_user.email:
        _dispatch_background(
            email_service.send_withdrawal_request_received_email(
                to_email=current_user.email,
                tutor_name=current_user.full_name or "Tutor",
                amount=withdrawal.amount,
                currency=withdrawal.currency,
                payment_method=withdrawal.payment_method.value,
            ),
            "withdrawal_request_received_email"
        )

    # Admin(s): new payout request alert
    try:
        admin_users = await User.find({"role": "admin", "is_active": True}).to_list()
        for admin in admin_users:
            if not admin.email:
                continue
            _dispatch_background(
                email_service.send_email(
                    to_email=admin.email,
                    subject="New Tutor Withdrawal Request",
                    html_content=email_service._base_template(
                        f"""
                        <h2 style=\"color:#1f2937; margin:0 0 16px;\">New Withdrawal Request</h2>
                        <p style=\"color:#4b5563;\">Tutor <strong>{current_user.full_name}</strong> requested payout.</p>
                        <p style=\"color:#4b5563;\"><strong>Amount:</strong> {withdrawal.currency} {withdrawal.amount:.2f}</p>
                        <p style=\"color:#4b5563;\"><strong>Method:</strong> {withdrawal.payment_method.value}</p>
                        <a href=\"{settings.FRONTEND_URL}/admin/dashboard?tab=withdrawals\" style=\"color:#2563eb;\">Open Admin Dashboard</a>
                        """
                    ),
                    plain_content=f"New withdrawal request from {current_user.full_name}: {withdrawal.currency} {withdrawal.amount:.2f}",
                ),
                "withdrawal_request_admin_alert"
            )
    except Exception:
        logger.exception("Failed to dispatch admin withdrawal alerts for request %s", withdrawal.id)

    return withdrawal_to_response(withdrawal)


@router.get("/my-requests", response_model=List[WithdrawalResponse])
async def get_my_withdrawals(current_user: User = Depends(get_current_user)):
    """Get tutor's withdrawal requests"""
    if current_user.role != "tutor":
        raise HTTPException(status_code=403, detail="Only tutors can access this")

    withdrawals = await Withdrawal.find(
        {"tutor_id": str(current_user.id)}
    ).sort("-created_at").to_list()

    return [withdrawal_to_response(w) for w in withdrawals]


# ============================================
# Admin Routes
# ============================================

@router.get("/admin/all", response_model=List[WithdrawalResponse])
async def get_all_withdrawals(
    status: Optional[WithdrawalStatus] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all withdrawal requests (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    query = {}
    if status:
        query["status"] = status

    withdrawals = await Withdrawal.find(query).sort("-created_at").to_list()
    return [withdrawal_to_response(w) for w in withdrawals]


@router.get("/admin/pending-count")
async def get_pending_count(current_user: User = Depends(get_current_user)):
    """Get count of pending withdrawal requests"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    count = await Withdrawal.find({"status": WithdrawalStatus.PENDING}).count()
    return {"pending_count": count}


@router.put("/admin/{withdrawal_id}", response_model=WithdrawalResponse)
async def update_withdrawal(
    withdrawal_id: str,
    update: WithdrawalUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update withdrawal status (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    withdrawal = await Withdrawal.get(withdrawal_id)
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")

    withdrawal.status = update.status
    withdrawal.admin_notes = update.admin_notes
    withdrawal.processed_by = str(current_user.id)
    withdrawal.processed_at = datetime.utcnow()
    withdrawal.updated_at = datetime.utcnow()

    if update.transaction_id:
        withdrawal.transaction_id = update.transaction_id

    await withdrawal.save()

    # Tutor: status update email after admin action (approved/rejected/completed)
    if withdrawal.tutor_email:
        _dispatch_background(
            email_service.send_withdrawal_status_email(
                to_email=withdrawal.tutor_email,
                tutor_name=withdrawal.tutor_name or "Tutor",
                amount=withdrawal.amount,
                currency=withdrawal.currency,
                status=withdrawal.status.value if hasattr(withdrawal.status, "value") else str(withdrawal.status),
                admin_notes=withdrawal.admin_notes,
                transaction_id=withdrawal.transaction_id,
            ),
            "withdrawal_status_email"
        )

    return withdrawal_to_response(withdrawal)


@router.get("/admin/stats")
async def get_withdrawal_stats(current_user: User = Depends(get_current_user)):
    """Get withdrawal statistics (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    pending = await Withdrawal.find({"status": WithdrawalStatus.PENDING}).to_list()
    approved = await Withdrawal.find({"status": WithdrawalStatus.APPROVED}).to_list()
    completed = await Withdrawal.find({"status": WithdrawalStatus.COMPLETED}).to_list()
    rejected = await Withdrawal.find({"status": WithdrawalStatus.REJECTED}).to_list()

    return {
        "pending_count": len(pending),
        "pending_amount": sum(w.amount for w in pending),
        "approved_count": len(approved),
        "approved_amount": sum(w.amount for w in approved),
        "completed_count": len(completed),
        "completed_amount": sum(w.amount for w in completed),
        "rejected_count": len(rejected),
        "rejected_amount": sum(w.amount for w in rejected),
        "total_requests": len(pending) + len(approved) + len(completed) + len(rejected)
    }
