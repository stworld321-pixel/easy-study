from beanie import Document, Indexed
from pydantic import Field
from typing import Optional
from datetime import datetime


class Conversation(Document):
    student_id: Indexed(str)
    tutor_id: Indexed(str)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_message_at: Optional[datetime] = None
    last_message_preview: Optional[str] = None

    class Settings:
        name = "conversations"
        indexes = [
            {"key": [("student_id", 1), ("tutor_id", 1)], "unique": True},
        ]


class Message(Document):
    conversation_id: Indexed(str)
    sender_id: Indexed(str)
    sender_role: str
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "messages"
