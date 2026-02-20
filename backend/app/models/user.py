from beanie import Document, Indexed
from pydantic import EmailStr, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    STUDENT = "student"
    TUTOR = "tutor"
    ADMIN = "admin"

class User(Document):
    email: Indexed(EmailStr, unique=True)
    hashed_password: str
    full_name: str
    role: UserRole = UserRole.STUDENT
    phone: Optional[str] = None
    avatar: Optional[str] = None
    is_active: bool = True
    is_verified: bool = False
    auth_provider: str = "local"  # "local", "google"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "full_name": "John Doe",
                "role": "student"
            }
        }
