from beanie import Document, Indexed
from pydantic import Field
from typing import List, Optional
from datetime import datetime


class Workshop(Document):
    tutor_id: Indexed(str)
    tutor_user_id: Indexed(str)

    title: str
    description: Optional[str] = None
    modules: List[str] = Field(default_factory=list)
    thumbnail_url: Optional[str] = None

    amount: float = 0.0
    currency: str = "INR"
    scheduled_at: datetime
    duration_minutes: int = 60
    max_participants: int = 50

    is_active: bool = True

    tutor_name: Optional[str] = None
    tutor_email: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "workshops"
