"""
Withdrawal Model - For managing tutor withdrawal requests
"""

from beanie import Document, Indexed
from pydantic import Field
from typing import Optional
from datetime import datetime
from enum import Enum


class WithdrawalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"


class PaymentMethod(str, Enum):
    BANK_TRANSFER = "bank_transfer"
    UPI = "upi"
    PAYPAL = "paypal"


class Withdrawal(Document):
    """Withdrawal request model"""

    # Tutor info
    tutor_id: Indexed(str)
    tutor_name: Optional[str] = None
    tutor_email: Optional[str] = None

    # Amount
    amount: float
    currency: str = "INR"

    # Payment details
    payment_method: PaymentMethod = PaymentMethod.BANK_TRANSFER
    payment_details: Optional[str] = None  # Bank account, UPI ID, PayPal email, etc.

    # Status
    status: WithdrawalStatus = WithdrawalStatus.PENDING

    # Admin response
    admin_notes: Optional[str] = None
    processed_by: Optional[str] = None  # Admin user ID
    processed_at: Optional[datetime] = None

    # Transaction reference (for completed withdrawals)
    transaction_id: Optional[str] = None

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "withdrawals"
