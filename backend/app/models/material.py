from beanie import Document
from pydantic import Field
from typing import Optional, List
from datetime import datetime


class Material(Document):
    """Reading materials uploaded by tutors"""
    tutor_id: str
    tutor_name: str
    title: str
    description: str
    subject: str
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    shared_with_all: bool = True  # If True, shared with all students who booked with tutor
    student_ids: List[str] = Field(default_factory=list)  # Specific student IDs if not shared with all
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "materials"


class Assignment(Document):
    """Assignments created by tutors"""
    tutor_id: str
    tutor_name: str
    title: str
    description: str
    subject: str
    due_date: datetime
    max_marks: int = 100
    student_id: Optional[str] = None  # If assigned to specific student
    student_name: Optional[str] = None
    status: str = "pending"  # pending, submitted, graded
    submission_url: Optional[str] = None
    submission_date: Optional[datetime] = None
    obtained_marks: Optional[int] = None
    feedback: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "assignments"


class TutorRating(Document):
    """Ratings given by students to tutors"""
    tutor_id: str
    tutor_name: str
    student_id: str
    student_name: str
    booking_id: Optional[str] = None
    subject: str
    rating: int  # 1-5
    comment: str
    session_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "tutor_ratings"
