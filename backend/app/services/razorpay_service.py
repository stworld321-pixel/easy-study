"""
Razorpay Payment Integration Service
"""

import razorpay
import hmac
import hashlib
from typing import Optional, Dict, Any
from app.core.config import settings
from app.models.payment import Payment, PaymentStatus
from datetime import datetime


class RazorpayService:
    """Service for handling Razorpay payments"""

    def __init__(self):
        self.client = razorpay.Client(
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
        )
        self.key_id = settings.RAZORPAY_KEY_ID

    def create_order(
        self,
        amount: float,
        currency: str = "INR",
        receipt: str = None,
        notes: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """
        Create a Razorpay order

        Args:
            amount: Amount in the smallest currency unit (paise for INR)
            currency: Currency code (INR, USD, etc.)
            receipt: Unique receipt ID
            notes: Additional notes

        Returns:
            Razorpay order object
        """
        # Convert amount to paise (smallest unit) - Razorpay expects amount in paise
        amount_in_paise = int(amount * 100)

        order_data = {
            "amount": amount_in_paise,
            "currency": currency,
            "receipt": receipt or f"order_{datetime.utcnow().timestamp()}",
            "notes": notes or {}
        }

        try:
            order = self.client.order.create(data=order_data)
            return {
                "success": True,
                "order_id": order["id"],
                "amount": order["amount"],
                "currency": order["currency"],
                "key_id": self.key_id
            }
        except Exception as e:
            print(f"[Razorpay] Failed to create order: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def verify_payment(
        self,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str
    ) -> bool:
        """
        Verify Razorpay payment signature

        Args:
            razorpay_order_id: Razorpay order ID
            razorpay_payment_id: Razorpay payment ID
            razorpay_signature: Razorpay signature

        Returns:
            True if signature is valid, False otherwise
        """
        try:
            # Generate signature
            message = f"{razorpay_order_id}|{razorpay_payment_id}"
            generated_signature = hmac.new(
                settings.RAZORPAY_KEY_SECRET.encode(),
                message.encode(),
                hashlib.sha256
            ).hexdigest()

            # Verify signature
            return hmac.compare_digest(generated_signature, razorpay_signature)
        except Exception as e:
            print(f"[Razorpay] Signature verification failed: {e}")
            return False

    def fetch_payment(self, payment_id: str) -> Optional[Dict[str, Any]]:
        """Fetch payment details from Razorpay"""
        try:
            payment = self.client.payment.fetch(payment_id)
            return payment
        except Exception as e:
            print(f"[Razorpay] Failed to fetch payment: {e}")
            return None

    def capture_payment(self, payment_id: str, amount: int) -> Optional[Dict[str, Any]]:
        """Capture an authorized payment"""
        try:
            payment = self.client.payment.capture(payment_id, amount)
            return payment
        except Exception as e:
            print(f"[Razorpay] Failed to capture payment: {e}")
            return None

    def refund_payment(
        self,
        payment_id: str,
        amount: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Refund a payment

        Args:
            payment_id: Razorpay payment ID
            amount: Amount to refund in paise (None for full refund)
        """
        try:
            refund_data = {}
            if amount:
                refund_data["amount"] = amount

            refund = self.client.payment.refund(payment_id, refund_data)
            return refund
        except Exception as e:
            print(f"[Razorpay] Failed to refund payment: {e}")
            return None


# Singleton instance
razorpay_service = RazorpayService()
