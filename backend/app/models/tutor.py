from beanie import Document, Indexed, Link
from pydantic import Field
from typing import Optional, List
from datetime import datetime

class Subject(Document):
    name: Indexed(str, unique=True)
    category: Optional[str] = None
    icon: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "subjects"

class TutorProfile(Document):
    user_id: Indexed(str)

    # Professional Info
    headline: Optional[str] = None
    bio: Optional[str] = None
    experience_years: int = 0
    education: Optional[str] = None
    certifications: Optional[List[str]] = []

    # Teaching Details
    hourly_rate: float = 0.0  # Rate for 1-on-1 sessions
    group_hourly_rate: float = 0.0  # Rate for group sessions
    currency: str = "INR"
    languages: List[str] = ["English"]
    teaching_style: Optional[str] = None
    subjects: List[str] = []

    # Location
    country: Optional[str] = None
    city: Optional[str] = None
    timezone: Optional[str] = None

    # Session Types
    offers_private: bool = True
    offers_group: bool = False

    # Stats
    total_students: int = 0
    total_lessons: int = 0
    rating: float = 0.0
    total_reviews: int = 0

    # Status
    is_verified: bool = False
    is_featured: bool = False
    is_available: bool = True

    # User details (denormalized for performance)
    full_name: Optional[str] = None
    email: Optional[str] = None
    avatar: Optional[str] = None

    # Google Calendar integration (tutor-owned OAuth tokens)
    google_calendar_connected: bool = False
    google_calendar_email: Optional[str] = None
    google_access_token: Optional[str] = None
    google_refresh_token: Optional[str] = None
    google_token_uri: Optional[str] = "https://oauth2.googleapis.com/token"
    google_scopes: Optional[List[str]] = None
    google_token_expiry: Optional[datetime] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "tutor_profiles"
