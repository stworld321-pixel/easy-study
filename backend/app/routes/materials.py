from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import List, Optional
from datetime import datetime
import logging
from pydantic import BaseModel
from app.models.material import Material, Assignment, TutorRating
from app.models.user import User
from app.routes.auth import get_current_user
from app.services.minio_service import minio_service

router = APIRouter()
logger = logging.getLogger(__name__)


# ============== SCHEMAS ==============

class MaterialCreate(BaseModel):
    title: str
    description: str
    subject: str


class MaterialResponse(BaseModel):
    id: str
    tutor_id: str
    tutor_name: str
    title: str
    description: str
    subject: str
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    created_at: datetime


class AssignmentCreate(BaseModel):
    title: str
    description: str
    subject: str
    due_date: datetime
    max_marks: int = 100
    student_id: Optional[str] = None


class AssignmentResponse(BaseModel):
    id: str
    tutor_id: str
    tutor_name: str
    title: str
    description: str
    subject: str
    due_date: datetime
    max_marks: int
    student_id: Optional[str] = None
    student_name: Optional[str] = None
    status: str
    obtained_marks: Optional[int] = None
    feedback: Optional[str] = None
    created_at: datetime


class RatingCreate(BaseModel):
    tutor_id: str
    tutor_name: str
    booking_id: Optional[str] = None
    subject: str
    rating: int
    comment: str
    session_date: Optional[datetime] = None


class RatingResponse(BaseModel):
    id: str
    tutor_id: str
    tutor_name: str
    student_id: str
    student_name: str
    subject: str
    rating: int
    comment: str
    session_date: Optional[datetime] = None
    created_at: datetime


# ============== MATERIALS ROUTES ==============

class BookedStudentResponse(BaseModel):
    id: str
    name: str
    email: str


@router.get("/materials/students", response_model=List[BookedStudentResponse])
async def get_booked_students(current_user: User = Depends(get_current_user)):
    """Get all students who have booked sessions with this tutor"""
    if current_user.role != "tutor":
        raise HTTPException(status_code=403, detail="Only tutors can access this endpoint")

    from app.models.booking import Booking
    from app.models.tutor import TutorProfile

    # Get tutor profile to find the tutor_id used in bookings
    tutor_profile = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor_profile:
        return []

    # Get all bookings for this tutor
    bookings = await Booking.find(Booking.tutor_id == str(tutor_profile.id)).to_list()

    # Get unique student IDs
    student_ids = list(set(b.student_id for b in bookings if b.student_id))

    # Get student details
    students = []
    for student_id in student_ids:
        student = await User.get(student_id)
        if student:
            students.append(BookedStudentResponse(
                id=str(student.id),
                name=student.full_name,
                email=student.email
            ))

    return students


@router.post("/materials", response_model=MaterialResponse)
async def create_material(
    title: str = Form(...),
    description: str = Form(""),
    subject: str = Form(...),
    shared_with_all: str = Form("true"),
    student_ids: str = Form(""),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user)
):
    """Create a new material (tutor only)"""
    if current_user.role != "tutor":
        raise HTTPException(status_code=403, detail="Only tutors can create materials")

    file_url = None
    file_name = None
    file_type = None

    if file:
        # Upload to MinIO
        result = await minio_service.upload_file(
            file=file,
            folder=f"materials/{current_user.id}"
        )
        if result:
            file_url = result["url"]
            file_name = file.filename
            file_type = file.content_type

    # Parse shared_with_all and student_ids
    is_shared_with_all = shared_with_all.lower() == "true"
    parsed_student_ids = [s.strip() for s in student_ids.split(",") if s.strip()] if student_ids else []

    material = Material(
        tutor_id=str(current_user.id),
        tutor_name=current_user.full_name,
        title=title,
        description=description,
        subject=subject,
        file_url=file_url,
        file_name=file_name,
        file_type=file_type,
        shared_with_all=is_shared_with_all,
        student_ids=parsed_student_ids
    )
    await material.insert()

    return MaterialResponse(
        id=str(material.id),
        tutor_id=material.tutor_id,
        tutor_name=material.tutor_name,
        title=material.title,
        description=material.description,
        subject=material.subject,
        file_url=material.file_url,
        file_name=material.file_name,
        file_type=material.file_type,
        created_at=material.created_at
    )


@router.get("/materials", response_model=List[MaterialResponse])
async def get_materials(current_user: User = Depends(get_current_user)):
    """Get materials - tutors see their own, students see only materials shared with them"""
    if current_user.role == "tutor":
        materials = await Material.find(Material.tutor_id == str(current_user.id)).to_list()
    else:
        # Get tutors the student has booked sessions with
        from app.models.booking import Booking
        bookings = await Booking.find(Booking.student_id == str(current_user.id)).to_list()
        tutor_profile_ids = list(set(b.tutor_id for b in bookings if b.tutor_id))

        if tutor_profile_ids:
            # Get tutor user IDs from tutor profiles
            from app.models.tutor import TutorProfile
            from beanie.operators import In

            # Convert string IDs to ObjectId for proper lookup
            from bson import ObjectId
            profile_object_ids = []
            for pid in tutor_profile_ids:
                try:
                    profile_object_ids.append(ObjectId(pid))
                except:
                    pass

            tutor_profiles = await TutorProfile.find(In(TutorProfile.id, profile_object_ids)).to_list()

            tutor_user_ids = [tp.user_id for tp in tutor_profiles]

            # Get all materials from tutors the student has booked with
            if tutor_user_ids:
                all_materials = await Material.find(In(Material.tutor_id, tutor_user_ids)).to_list()
            else:
                all_materials = []

            # Filter materials: only show if shared_with_all=True OR student is in student_ids
            student_id = str(current_user.id)
            materials = [
                m for m in all_materials
                if m.shared_with_all or student_id in m.student_ids
            ]
        else:
            materials = []

    return [
        MaterialResponse(
            id=str(m.id),
            tutor_id=m.tutor_id,
            tutor_name=m.tutor_name,
            title=m.title,
            description=m.description,
            subject=m.subject,
            file_url=m.file_url,
            file_name=m.file_name,
            file_type=m.file_type,
            created_at=m.created_at
        )
        for m in materials
    ]


@router.delete("/materials/{material_id}")
async def delete_material(material_id: str, current_user: User = Depends(get_current_user)):
    """Delete a material (tutor only, own materials)"""
    material = await Material.get(material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    if material.tutor_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to delete this material")

    # Delete file from MinIO if exists
    if material.file_url:
        try:
            await minio_service.delete_file(material.file_url)
        except:
            pass

    await material.delete()
    return {"message": "Material deleted successfully"}


# ============== ASSIGNMENTS ROUTES ==============

@router.post("/assignments", response_model=AssignmentResponse)
async def create_assignment(
    data: AssignmentCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new assignment (tutor only)"""
    if current_user.role != "tutor":
        raise HTTPException(status_code=403, detail="Only tutors can create assignments")

    assignment = Assignment(
        tutor_id=str(current_user.id),
        tutor_name=current_user.full_name,
        title=data.title,
        description=data.description,
        subject=data.subject,
        due_date=data.due_date,
        max_marks=data.max_marks,
        student_id=data.student_id
    )
    await assignment.insert()

    return AssignmentResponse(
        id=str(assignment.id),
        tutor_id=assignment.tutor_id,
        tutor_name=assignment.tutor_name,
        title=assignment.title,
        description=assignment.description,
        subject=assignment.subject,
        due_date=assignment.due_date,
        max_marks=assignment.max_marks,
        student_id=assignment.student_id,
        student_name=assignment.student_name,
        status=assignment.status,
        obtained_marks=assignment.obtained_marks,
        feedback=assignment.feedback,
        created_at=assignment.created_at
    )


@router.get("/assignments", response_model=List[AssignmentResponse])
async def get_assignments(current_user: User = Depends(get_current_user)):
    """Get assignments - tutors see their own, students see assigned to them"""
    if current_user.role == "tutor":
        assignments = await Assignment.find(Assignment.tutor_id == str(current_user.id)).to_list()
    else:
        student_id = str(current_user.id)
        assignments = await Assignment.find(
            {"$or": [{"student_id": student_id}, {"student_id": None}]}
        ).to_list()

    return [
        AssignmentResponse(
            id=str(a.id),
            tutor_id=a.tutor_id,
            tutor_name=a.tutor_name,
            title=a.title,
            description=a.description,
            subject=a.subject,
            due_date=a.due_date,
            max_marks=a.max_marks,
            student_id=a.student_id,
            student_name=a.student_name,
            status=a.status,
            obtained_marks=a.obtained_marks,
            feedback=a.feedback,
            created_at=a.created_at
        )
        for a in assignments
    ]


@router.delete("/assignments/{assignment_id}")
async def delete_assignment(assignment_id: str, current_user: User = Depends(get_current_user)):
    """Delete an assignment (tutor only)"""
    assignment = await Assignment.get(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment.tutor_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to delete this assignment")

    await assignment.delete()
    return {"message": "Assignment deleted successfully"}


# ============== RATINGS ROUTES ==============

@router.post("/ratings", response_model=RatingResponse)
async def create_rating(
    data: RatingCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a rating for a tutor (student only)"""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can rate tutors")

    # Check if already rated this tutor for this booking
    if data.booking_id:
        existing = await TutorRating.find_one(
            TutorRating.student_id == str(current_user.id),
            TutorRating.booking_id == data.booking_id
        )
        if existing:
            raise HTTPException(status_code=400, detail="You have already rated this session")

    rating = TutorRating(
        tutor_id=data.tutor_id,
        tutor_name=data.tutor_name,
        student_id=str(current_user.id),
        student_name=current_user.full_name,
        booking_id=data.booking_id,
        subject=data.subject,
        rating=data.rating,
        comment=data.comment,
        session_date=data.session_date
    )
    await rating.insert()

    # Update tutor's average rating in their profile
    try:
        from app.models.tutor import TutorProfile
        all_ratings = await TutorRating.find(TutorRating.tutor_id == data.tutor_id).to_list()
        if all_ratings:
            avg_rating = sum(r.rating for r in all_ratings) / len(all_ratings)
            tutor_profile = await TutorProfile.get(data.tutor_id)
            if tutor_profile:
                tutor_profile.rating = round(avg_rating, 1)
                tutor_profile.total_reviews = len(all_ratings)
                await tutor_profile.save()
    except Exception:
        logger.exception("Failed to update tutor rating for tutor %s", data.tutor_id)

    return RatingResponse(
        id=str(rating.id),
        tutor_id=rating.tutor_id,
        tutor_name=rating.tutor_name,
        student_id=rating.student_id,
        student_name=rating.student_name,
        subject=rating.subject,
        rating=rating.rating,
        comment=rating.comment,
        session_date=rating.session_date,
        created_at=rating.created_at
    )


@router.get("/ratings/my", response_model=List[RatingResponse])
async def get_my_ratings(current_user: User = Depends(get_current_user)):
    """Get ratings - students see ratings they gave, tutors see ratings they received"""
    if current_user.role == "student":
        ratings = await TutorRating.find(TutorRating.student_id == str(current_user.id)).to_list()
    else:
        # For tutors, we need to get the TutorProfile ID first
        from app.models.tutor import TutorProfile
        tutor_profile = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
        if tutor_profile:
            ratings = await TutorRating.find(TutorRating.tutor_id == str(tutor_profile.id)).to_list()
        else:
            ratings = []

    return [
        RatingResponse(
            id=str(r.id),
            tutor_id=r.tutor_id,
            tutor_name=r.tutor_name,
            student_id=r.student_id,
            student_name=r.student_name,
            subject=r.subject,
            rating=r.rating,
            comment=r.comment,
            session_date=r.session_date,
            created_at=r.created_at
        )
        for r in ratings
    ]


@router.get("/ratings/tutor/{tutor_id}", response_model=List[RatingResponse])
async def get_tutor_ratings(tutor_id: str):
    """Get all ratings for a specific tutor (public)"""
    ratings = await TutorRating.find(TutorRating.tutor_id == tutor_id).to_list()

    return [
        RatingResponse(
            id=str(r.id),
            tutor_id=r.tutor_id,
            tutor_name=r.tutor_name,
            student_id=r.student_id,
            student_name=r.student_name,
            subject=r.subject,
            rating=r.rating,
            comment=r.comment,
            session_date=r.session_date,
            created_at=r.created_at
        )
        for r in ratings
    ]
