from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import Dict, List, Optional
from datetime import datetime
import logging
import asyncio
from pydantic import BaseModel
from app.models.material import Material, Assignment, TutorRating
from app.models.user import User
from app.core.config import settings
from app.routes.auth import get_current_user
from app.services.minio_service import minio_service
from app.services.email_service import email_service
from app.services.notification_service import notification_service
from app.models.notification import NotificationType

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
    shared_with_all: bool = True
    student_ids: Optional[List[str]] = None
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
    submission_url: Optional[str] = None
    submission_date: Optional[datetime] = None
    obtained_marks: Optional[int] = None
    feedback: Optional[str] = None
    created_at: datetime


class AssignmentSubmitRequest(BaseModel):
    submission_url: Optional[str] = None


class AssignmentGradeRequest(BaseModel):
    obtained_marks: Optional[int] = None
    feedback: Optional[str] = None


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


def _dispatch_background(coro, context: str) -> None:
    async def _runner():
        try:
            await coro
        except Exception:
            logger.exception("Background task failed (%s)", context)

    asyncio.create_task(_runner())


def _student_tab_link(tab: str) -> str:
    base_url = (settings.FRONTEND_URL or "").rstrip("/")
    return f"{base_url}/student/dashboard?tab={tab}" if base_url else f"/student/dashboard?tab={tab}"


def _tutor_tab_link(tab: str) -> str:
    base_url = (settings.FRONTEND_URL or "").rstrip("/")
    return f"{base_url}/tutor/dashboard?tab={tab}" if base_url else f"/tutor/dashboard?tab={tab}"


async def _get_tutor_profile_and_booked_students(current_user: User):
    from app.models.booking import Booking
    from app.models.tutor import TutorProfile

    tutor_profile = await TutorProfile.find_one({"user_id": str(current_user.id)})
    if not tutor_profile:
        return None, {}

    bookings = await Booking.find({"tutor_id": str(tutor_profile.id)}).to_list()
    student_ids = list(set(b.student_id for b in bookings if b.student_id))

    students: Dict[str, User] = {}
    for sid in student_ids:
        try:
            student = await User.get(sid)
            if student:
                students[str(student.id)] = student
        except Exception:
            continue

    return tutor_profile, students


@router.get("/materials/students", response_model=List[BookedStudentResponse])
async def get_booked_students(current_user: User = Depends(get_current_user)):
    """Get all students who have booked sessions with this tutor"""
    if current_user.role != "tutor":
        raise HTTPException(status_code=403, detail="Only tutors can access this endpoint")

    _, students = await _get_tutor_profile_and_booked_students(current_user)
    if not students:
        return []

    return [
        BookedStudentResponse(id=sid, name=s.full_name, email=s.email)
        for sid, s in students.items()
    ]


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

    _, booked_students = await _get_tutor_profile_and_booked_students(current_user)
    if not booked_students:
        raise HTTPException(status_code=400, detail="No booked students found. Materials can be shared only with booked students.")

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

    # Parse sharing options (only booked students are eligible)
    is_shared_with_all = shared_with_all.lower() == "true"
    parsed_student_ids = [s.strip() for s in student_ids.split(",") if s.strip()] if student_ids else []
    booked_ids = set(booked_students.keys())

    if is_shared_with_all:
        recipient_ids = list(booked_ids)
    else:
        invalid_ids = [sid for sid in parsed_student_ids if sid not in booked_ids]
        if invalid_ids:
            raise HTTPException(status_code=400, detail="Some selected students are not booked with this tutor.")
        recipient_ids = parsed_student_ids
        if not recipient_ids:
            raise HTTPException(status_code=400, detail="Select at least one booked student.")

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
        student_ids=recipient_ids
    )
    await material.insert()

    # Notify recipients by email (best-effort)
    recipient_emails = [booked_students[sid].email for sid in recipient_ids if sid in booked_students]
    if recipient_emails:
        _dispatch_background(
            email_service.send_bulk_email(
                recipients=recipient_emails,
                subject=f"New Study Material: {title}",
                html_content=email_service._base_template(
                    f"""
                    <h2 style=\"color:#1f2937; margin:0 0 16px;\">New Study Material Shared</h2>
                    <p style=\"color:#4b5563;\">{current_user.full_name} shared a new material for <strong>{subject}</strong>.</p>
                    <p style=\"color:#4b5563;\"><strong>Title:</strong> {title}</p>
                    <p style=\"color:#4b5563;\">{description or ''}</p>
                    <div style=\"text-align:center;\">
                        <a href=\"{_student_tab_link('materials')}\"
                           style=\"display:inline-block; background:#6366f1; color:white; text-decoration:none; padding:12px 20px; border-radius:8px;\">
                           View Materials
                        </a>
                    </div>
                    """
                ),
                plain_content=f"New material shared by {current_user.full_name}: {title}. Open your student dashboard materials tab.",
            ),
            "material_shared_email"
        )

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

    _, booked_students = await _get_tutor_profile_and_booked_students(current_user)
    if not booked_students:
        raise HTTPException(status_code=400, detail="No booked students found. Assignments can be shared only with booked students.")

    booked_ids = set(booked_students.keys())
    requested_ids = data.student_ids or []
    if data.student_id and data.student_id not in requested_ids:
        requested_ids.append(data.student_id)

    if data.shared_with_all:
        recipient_ids = list(booked_ids)
    else:
        invalid_ids = [sid for sid in requested_ids if sid not in booked_ids]
        if invalid_ids:
            raise HTTPException(status_code=400, detail="Some selected students are not booked with this tutor.")
        recipient_ids = requested_ids
        if not recipient_ids:
            raise HTTPException(status_code=400, detail="Select at least one booked student.")

    legacy_student_id = recipient_ids[0] if (len(recipient_ids) == 1) else None
    legacy_student_name = booked_students[legacy_student_id].full_name if legacy_student_id else None

    assignment = Assignment(
        tutor_id=str(current_user.id),
        tutor_name=current_user.full_name,
        title=data.title,
        description=data.description,
        subject=data.subject,
        due_date=data.due_date,
        max_marks=data.max_marks,
        shared_with_all=data.shared_with_all,
        student_ids=recipient_ids,
        student_id=legacy_student_id,
        student_name=legacy_student_name
    )
    await assignment.insert()

    # Notify recipients by email (best-effort)
    recipient_emails = [booked_students[sid].email for sid in recipient_ids if sid in booked_students]
    if recipient_emails:
        due_str = data.due_date.strftime("%B %d, %Y")
        _dispatch_background(
            email_service.send_bulk_email(
                recipients=recipient_emails,
                subject=f"New Assignment: {data.title}",
                html_content=email_service._base_template(
                    f"""
                    <h2 style=\"color:#1f2937; margin:0 0 16px;\">New Assignment Posted</h2>
                    <p style=\"color:#4b5563;\">{current_user.full_name} posted a new assignment for <strong>{data.subject}</strong>.</p>
                    <p style=\"color:#4b5563;\"><strong>Title:</strong> {data.title}</p>
                    <p style=\"color:#4b5563;\"><strong>Due Date:</strong> {due_str}</p>
                    <p style=\"color:#4b5563;\">{data.description or ''}</p>
                    <div style=\"text-align:center;\">
                        <a href=\"{_student_tab_link('materials')}\"
                           style=\"display:inline-block; background:#6366f1; color:white; text-decoration:none; padding:12px 20px; border-radius:8px;\">
                           View Assignments
                        </a>
                    </div>
                    """
                ),
                plain_content=f"New assignment from {current_user.full_name}: {data.title} (due {due_str}). Open your student dashboard.",
            ),
            "assignment_shared_email"
        )

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
        submission_url=assignment.submission_url,
        submission_date=assignment.submission_date,
        obtained_marks=assignment.obtained_marks,
        feedback=assignment.feedback,
        created_at=assignment.created_at
    )


@router.get("/assignments", response_model=List[AssignmentResponse])
async def get_assignments(current_user: User = Depends(get_current_user)):
    """Get assignments - tutors see their own, students see assigned to them"""
    if current_user.role == "tutor":
        assignments = await Assignment.find({"tutor_id": str(current_user.id)}).to_list()
    else:
        student_id = str(current_user.id)
        from app.models.booking import Booking
        from app.models.tutor import TutorProfile
        from beanie.operators import In
        from bson import ObjectId

        bookings = await Booking.find({"student_id": student_id}).to_list()
        tutor_profile_ids = list(set(b.tutor_id for b in bookings if b.tutor_id))

        if not tutor_profile_ids:
            assignments = []
        else:
            profile_object_ids = []
            for pid in tutor_profile_ids:
                try:
                    profile_object_ids.append(ObjectId(pid))
                except Exception:
                    continue

            tutor_profiles = await TutorProfile.find(In(TutorProfile.id, profile_object_ids)).to_list()
            tutor_user_ids = [tp.user_id for tp in tutor_profiles]

            if not tutor_user_ids:
                assignments = []
            else:
                all_assignments = await Assignment.find(In(Assignment.tutor_id, tutor_user_ids)).to_list()
                assignments = [
                    a for a in all_assignments
                    if a.shared_with_all or student_id in (a.student_ids or []) or a.student_id == student_id
                ]

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
            submission_url=a.submission_url,
            submission_date=a.submission_date,
            obtained_marks=a.obtained_marks,
            feedback=a.feedback,
            created_at=a.created_at
        )
        for a in assignments
    ]


@router.put("/assignments/{assignment_id}/submit", response_model=AssignmentResponse)
async def submit_assignment(
    assignment_id: str,
    payload: AssignmentSubmitRequest,
    current_user: User = Depends(get_current_user)
):
    """Submit an assignment (student only)."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can submit assignments")

    assignment = await Assignment.get(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    student_id = str(current_user.id)

    # Verify this student can access the assignment
    is_recipient = assignment.shared_with_all or student_id in (assignment.student_ids or []) or assignment.student_id == student_id
    if not is_recipient:
        raise HTTPException(status_code=403, detail="You are not assigned to this assignment")

    # For shared_with_all assignments, ensure student actually booked with tutor
    from app.models.booking import Booking
    from app.models.tutor import TutorProfile

    tutor_profile = await TutorProfile.find_one({"user_id": assignment.tutor_id})
    if not tutor_profile:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    booking_exists = await Booking.find_one({
        "student_id": student_id,
        "tutor_id": str(tutor_profile.id),
        "status": {"$ne": "cancelled"},
    })
    if not booking_exists:
        raise HTTPException(status_code=403, detail="Only booked students can submit this assignment")

    assignment.status = "submitted"
    assignment.submission_url = (payload.submission_url or "").strip() or None
    assignment.submission_date = datetime.utcnow()
    assignment.updated_at = datetime.utcnow()
    await assignment.save()

    # Notify tutor by email + notification (best effort)
    try:
        tutor_user = await User.get(assignment.tutor_id)
        if tutor_user and tutor_user.email:
            _dispatch_background(
                email_service.send_email(
                    to_email=tutor_user.email,
                    subject=f"Assignment Submitted: {assignment.title}",
                    html_content=email_service._base_template(
                        f"""
                        <h2 style=\"color:#1f2937; margin:0 0 16px;\">Assignment Submission Received</h2>
                        <p style=\"color:#4b5563;\"><strong>{current_user.full_name}</strong> submitted assignment <strong>{assignment.title}</strong>.</p>
                        <p style=\"color:#4b5563;\"><strong>Subject:</strong> {assignment.subject}</p>
                        <div style=\"text-align:center;\">
                          <a href=\"{_tutor_tab_link('assignments')}\"
                             style=\"display:inline-block; background:#6366f1; color:white; text-decoration:none; padding:12px 20px; border-radius:8px;\">
                             Review Assignment
                          </a>
                        </div>
                        """
                    ),
                    plain_content=f"{current_user.full_name} submitted assignment: {assignment.title}",
                ),
                "assignment_submitted_tutor_email"
            )
    except Exception:
        logger.exception("Failed to send tutor assignment submission email for assignment %s", assignment_id)

    try:
        await notification_service.create_notification(
            user_id=assignment.tutor_id,
            notification_type=NotificationType.SYSTEM,
            title="Assignment Submitted",
            message=f"{current_user.full_name} submitted: {assignment.title}",
            link="/tutor/dashboard?tab=assignments",
            related_id=str(assignment.id),
            actor_id=str(current_user.id),
            actor_name=current_user.full_name,
        )
    except Exception:
        logger.exception("Failed to create tutor assignment submission notification for assignment %s", assignment_id)

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
        submission_url=assignment.submission_url,
        submission_date=assignment.submission_date,
        obtained_marks=assignment.obtained_marks,
        feedback=assignment.feedback,
        created_at=assignment.created_at,
    )


@router.put("/assignments/{assignment_id}/grade", response_model=AssignmentResponse)
async def grade_assignment(
    assignment_id: str,
    payload: AssignmentGradeRequest,
    current_user: User = Depends(get_current_user)
):
    """Grade/update assignment result (tutor only)."""
    if current_user.role != "tutor":
        raise HTTPException(status_code=403, detail="Only tutors can update assignment results")

    assignment = await Assignment.get(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment.tutor_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to update this assignment")

    if payload.obtained_marks is not None:
        if payload.obtained_marks < 0:
            raise HTTPException(status_code=400, detail="Obtained marks cannot be negative")
        if payload.obtained_marks > assignment.max_marks:
            raise HTTPException(status_code=400, detail="Obtained marks cannot exceed max marks")
        assignment.obtained_marks = payload.obtained_marks

    if payload.feedback is not None:
        assignment.feedback = payload.feedback.strip() or None

    assignment.status = "graded"
    assignment.updated_at = datetime.utcnow()
    await assignment.save()

    # Notify targeted students by email + in-app (best effort)
    recipient_ids = assignment.student_ids or ([assignment.student_id] if assignment.student_id else [])
    if assignment.shared_with_all:
        from app.models.booking import Booking
        from app.models.tutor import TutorProfile
        tutor_profile = await TutorProfile.find_one({"user_id": assignment.tutor_id})
        if tutor_profile:
            bookings = await Booking.find({"tutor_id": str(tutor_profile.id), "status": {"$ne": "cancelled"}}).to_list()
            recipient_ids = list({b.student_id for b in bookings if b.student_id})

    recipients: List[User] = []
    for sid in recipient_ids:
        try:
            student = await User.get(sid)
            if student:
                recipients.append(student)
        except Exception:
            continue

    if recipients:
        email_targets = [u.email for u in recipients if u.email]
        if email_targets:
            _dispatch_background(
                email_service.send_bulk_email(
                    recipients=email_targets,
                    subject=f"Assignment Graded: {assignment.title}",
                    html_content=email_service._base_template(
                        f"""
                        <h2 style=\"color:#1f2937; margin:0 0 16px;\">Assignment Result Updated</h2>
                        <p style=\"color:#4b5563;\">Your tutor <strong>{current_user.full_name}</strong> updated result for <strong>{assignment.title}</strong>.</p>
                        <p style=\"color:#4b5563;\"><strong>Marks:</strong> {assignment.obtained_marks if assignment.obtained_marks is not None else 'Not provided'}/{assignment.max_marks}</p>
                        <p style=\"color:#4b5563;\"><strong>Feedback:</strong> {assignment.feedback or 'No feedback provided'}</p>
                        <div style=\"text-align:center;\">
                          <a href=\"{_student_tab_link('materials')}\"
                             style=\"display:inline-block; background:#6366f1; color:white; text-decoration:none; padding:12px 20px; border-radius:8px;\">
                             View Assignment
                          </a>
                        </div>
                        """
                    ),
                    plain_content=f"Assignment graded: {assignment.title}. Marks: {assignment.obtained_marks}/{assignment.max_marks}.",
                ),
                "assignment_graded_student_email"
            )

        for student in recipients:
            try:
                await notification_service.create_notification(
                    user_id=str(student.id),
                    notification_type=NotificationType.SYSTEM,
                    title="Assignment Graded",
                    message=f"{assignment.title} has been graded by {current_user.full_name}",
                    link="/student/dashboard?tab=materials",
                    related_id=str(assignment.id),
                    actor_id=str(current_user.id),
                    actor_name=current_user.full_name,
                )
            except Exception:
                continue

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
        submission_url=assignment.submission_url,
        submission_date=assignment.submission_date,
        obtained_marks=assignment.obtained_marks,
        feedback=assignment.feedback,
        created_at=assignment.created_at,
    )


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
