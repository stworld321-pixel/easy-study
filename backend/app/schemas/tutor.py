from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class SubjectCreate(BaseModel):
    name: str
    category: Optional[str] = None
    icon: Optional[str] = None

class SubjectResponse(BaseModel):
    id: str
    name: str
    category: Optional[str] = None
    icon: Optional[str] = None

class TutorProfileCreate(BaseModel):
    headline: Optional[str] = None
    bio: Optional[str] = None
    experience_years: int = 0
    education: Optional[str] = None
    certifications: Optional[List[str]] = []
    hourly_rate: float = 0.0
    currency: str = "USD"
    languages: List[str] = ["English"]
    teaching_style: Optional[str] = None
    subjects: List[str] = []
    country: Optional[str] = None
    city: Optional[str] = None
    timezone: Optional[str] = None
    offers_private: bool = True
    offers_group: bool = False

class TutorProfileUpdate(BaseModel):
    headline: Optional[str] = None
    bio: Optional[str] = None
    experience_years: Optional[int] = None
    education: Optional[str] = None
    certifications: Optional[List[str]] = None
    hourly_rate: Optional[float] = None
    currency: Optional[str] = None
    languages: Optional[List[str]] = None
    teaching_style: Optional[str] = None
    subjects: Optional[List[str]] = None
    country: Optional[str] = None
    city: Optional[str] = None
    timezone: Optional[str] = None
    offers_private: Optional[bool] = None
    offers_group: Optional[bool] = None
    is_available: Optional[bool] = None

class TutorProfileResponse(BaseModel):
    id: str
    user_id: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    avatar: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    experience_years: int
    education: Optional[str] = None
    certifications: Optional[List[str]] = []
    hourly_rate: float
    currency: str
    languages: List[str]
    teaching_style: Optional[str] = None
    subjects: List[str]
    country: Optional[str] = None
    city: Optional[str] = None
    timezone: Optional[str] = None
    offers_private: bool
    offers_group: bool
    total_students: int
    total_lessons: int
    rating: float
    total_reviews: int
    is_verified: bool
    is_featured: bool
    is_available: bool
    created_at: datetime
