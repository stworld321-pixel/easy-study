"""
Platform Settings Model - Configurable platform-wide settings
"""

from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import Field


class PlatformSettings(Document):
    """Singleton document for platform-wide settings"""
    minimum_withdrawal_amount: float = 10.0
    # Fractional rates (e.g., 0.10 = 10%)
    tutor_commission_rate: float = 0.05
    student_platform_fee_rate: float = 0.0
    # Display currency for admin reporting
    display_currency: str = "INR"
    # Manual conversion rate: 1 INR = X USD
    inr_to_usd_rate: float = 0.012
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: Optional[str] = None

    class Settings:
        name = "platform_settings"

    @classmethod
    async def get_or_create(cls) -> "PlatformSettings":
        """Get the platform settings (creates default if none exist)"""
        settings = await cls.find_one()
        if not settings:
            settings = cls()
            await settings.insert()
        return settings
