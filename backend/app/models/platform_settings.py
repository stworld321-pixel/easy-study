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
