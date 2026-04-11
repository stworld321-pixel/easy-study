from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import Response
from typing import Dict, List, Optional
from datetime import datetime, timedelta, timezone, tzinfo
import logging
import asyncio
from zoneinfo import ZoneInfo
from pydantic import BaseModel
from app.models.material import Material, Assignment, TutorRating, CompletionCertificate
from app.models.user import User
from app.models.availability import TutorAvailability
from app.core.config import settings
from app.routes.auth import get_current_user
from app.services.minio_service import minio_service
from app.services.email_service import email_service
from app.services.notification_service import notification_service
from app.services.certificate_service import build_certificate_pdf
from app.models.notification import NotificationType
from app.schemas.booking import UtcDatetime

router = APIRouter()
logger = logging.getLogger(__name__)


def _to_utc_naive(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _safe_zoneinfo(name: Optional[str]) -> tzinfo:
    tz_name = (name or "UTC").strip() or "UTC"
    try:
        return ZoneInfo(tz_name)
    except Exception:
        try:
            return ZoneInfo("UTC")
        except Exception:
            return timezone.utc


def _load_signature_bytes(signature_url: Optional[str]) -> Optional[bytes]:
    if not signature_url:
        return None
    try:
        return minio_service.get_file_bytes(signature_url)
    except Exception:
        return None


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
    created_at: UtcDatetime


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
    due_date: UtcDatetime
    max_marks: int
    student_id: Optional[str] = None
    student_name: Optional[str] = None
    status: str
    submission_url: Optional[str] = None
    submission_date: Optional[UtcDatetime] = None
    obtained_marks: Optional[int] = None
    feedback: Optional[str] = None
    created_at: UtcDatetime


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
    comment: str = ""
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
    session_date: Optional[UtcDatetime] = None
    certificate_url: Optional[str] = None
    created_at: UtcDatetime


class CertificateResponse(BaseModel):
    id: str
    booking_id: str
    subject: str
    session_name: Optional[str] = None
    tutor_name: str
    session_date: UtcDatetime
    certificate_number: str
    file_url: str
    created_at: UtcDatetime


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
        due_date=_to_utc_naive(data.due_date),
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

    booking = None
    resolved_tutor_id = data.tutor_id
    resolved_tutor_name = data.tutor_name
    resolved_subject = data.subject
    resolved_session_date = data.session_date
    if data.booking_id:
        from app.models.booking import Booking
        booking = await Booking.get(data.booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        if booking.student_id != str(current_user.id):
            raise HTTPException(status_code=403, detail="You can only rate your own session")
        if booking.status == "cancelled":
            raise HTTPException(status_code=400, detail="Cannot rate a cancelled session")
        availability = await TutorAvailability.find_one(TutorAvailability.tutor_id == booking.tutor_id)
        tutor_tz = _safe_zoneinfo(getattr(availability, "timezone", None))
        now_local = datetime.now(tutor_tz)

        if booking.scheduled_at.tzinfo is None:
            session_start_local = booking.scheduled_at.replace(tzinfo=tutor_tz)
        else:
            session_start_local = booking.scheduled_at.astimezone(tutor_tz)

        # Guard only truly future-dated sessions. Same-day timezone edge cases should not block rating.
        if booking.status != "completed" and session_start_local.date() > now_local.date():
            raise HTTPException(status_code=400, detail="You can rate only after session date")

        # Auto-complete booking when student submits rating after session start.
        if booking.status == "confirmed" and session_start_local <= now_local:
            booking.status = "completed"
            booking.updated_at = datetime.utcnow()
            await booking.save()
        resolved_tutor_id = booking.tutor_id or resolved_tutor_id
        resolved_tutor_name = booking.tutor_name or resolved_tutor_name
        resolved_subject = booking.subject or resolved_subject
        resolved_session_date = booking.scheduled_at

    # Check if already rated this tutor for this booking
    if data.booking_id:
        existing = await TutorRating.find_one(
            TutorRating.student_id == str(current_user.id),
            TutorRating.booking_id == data.booking_id
        )
        if existing:
            raise HTTPException(status_code=400, detail="You have already rated this session")

    if resolved_session_date is not None:
        resolved_session_date = _to_utc_naive(resolved_session_date)

    rating = TutorRating(
        tutor_id=resolved_tutor_id,
        tutor_name=resolved_tutor_name,
        student_id=str(current_user.id),
        student_name=current_user.full_name,
        booking_id=data.booking_id,
        subject=resolved_subject,
        rating=data.rating,
        comment=(data.comment or "").strip(),
        session_date=resolved_session_date
    )
    await rating.insert()

    certificate_doc: Optional[CompletionCertificate] = None
    certificate_url: Optional[str] = None
    if data.booking_id:
        try:
            is_workshop_booking = bool(
                booking and (
                    getattr(booking, "is_workshop", False)
                    or (booking.session_type == "group" and bool((booking.session_name or "").strip()))
                )
            )
            if not is_workshop_booking:
                existing_certificate = None
            else:
                existing_certificate = await CompletionCertificate.find_one(
                    CompletionCertificate.booking_id == data.booking_id
                )

            if existing_certificate:
                certificate_doc = existing_certificate
                certificate_url = existing_certificate.file_url
            elif is_workshop_booking:
                session_date = booking.scheduled_at if booking else (resolved_session_date or datetime.utcnow())
                certificate_number = f"ZC-{session_date.strftime('%Y%m%d')}-{str(current_user.id)[-6:].upper()}"
                tutor_signature_url = None
                tutor_signature_bytes = None
                cert_tz_name: Optional[str] = None
                if booking and booking.tutor_id:
                    from app.models.tutor import TutorProfile
                    tutor_profile = await TutorProfile.get(booking.tutor_id)
                    if tutor_profile:
                        tutor_signature_url = tutor_profile.signature_image_url
                        tutor_signature_bytes = _load_signature_bytes(tutor_signature_url)
                    tutor_avail = await TutorAvailability.find_one(
                        TutorAvailability.tutor_id == booking.tutor_id
                    )
                    if tutor_avail and (tutor_avail.timezone or "").strip():
                        cert_tz_name = tutor_avail.timezone
                pdf_bytes = build_certificate_pdf(
                    student_name=current_user.full_name,
                    tutor_name=resolved_tutor_name,
                    subject=resolved_subject,
                    session_date=session_date,
                    certificate_number=certificate_number,
                    session_name=(booking.session_name if booking else None),
                    tutor_signature_url=tutor_signature_url,
                    tutor_signature_bytes=tutor_signature_bytes,
                    timezone_name=cert_tz_name,
                )
                file_name = f"completion-certificate-{data.booking_id}.pdf"
                upload_result = minio_service.upload_bytes(
                    file_data=pdf_bytes,
                    filename=file_name,
                    folder=f"certificates/{current_user.id}",
                    content_type="application/pdf",
                )
                if upload_result and upload_result.get("url"):
                    certificate_doc = CompletionCertificate(
                        student_id=str(current_user.id),
                        student_name=current_user.full_name,
                        tutor_id=resolved_tutor_id,
                        tutor_name=resolved_tutor_name,
                        booking_id=data.booking_id,
                        subject=resolved_subject,
                        session_name=(booking.session_name if booking else None),
                        session_date=session_date,
                        certificate_number=certificate_number,
                        file_url=upload_result["url"],
                        file_name=file_name,
                    )
                    await certificate_doc.insert()
                    certificate_url = upload_result["url"]

                    if current_user.email:
                        _dispatch_background(
                            email_service.send_email(
                                to_email=current_user.email,
                                subject="Your Session Completion Certificate is Ready",
                                html_content=email_service._base_template(
                                    f"""
                                    <h2 style=\"color:#1f2937; margin:0 0 16px;\">Certificate Generated</h2>
                                    <p style=\"color:#4b5563;\">Hi {current_user.full_name},</p>
                                    <p style=\"color:#4b5563;\">Thanks for submitting feedback. Your completion certificate is now available.</p>
                                    <p style=\"color:#4b5563;\"><strong>Subject:</strong> {resolved_subject}</p>
                                    <p style=\"color:#4b5563;\"><strong>Tutor:</strong> {resolved_tutor_name}</p>
                                    <p style=\"color:#4b5563;\"><strong>Certificate No:</strong> {certificate_number}</p>
                                    <div style=\"text-align:center;\">
                                        <a href=\"{upload_result['url']}\"
                                           style=\"display:inline-block; background:#2563eb; color:white; text-decoration:none; padding:12px 20px; border-radius:8px;\">
                                           Download Certificate
                                        </a>
                                    </div>
                                    <p style=\"color:#6b7280; font-size:12px; margin-top:14px;\">You can also download this anytime from your Student Dashboard > Feedback.</p>
                                    """
                                ),
                                plain_content=f"Your certificate is ready. Download: {upload_result['url']}",
                            ),
                            "completion_certificate_email",
                        )
        except Exception:
            logger.exception("Failed to generate completion certificate for booking %s", data.booking_id)

    # Update tutor's average rating in their profile
    try:
        from app.models.tutor import TutorProfile
        all_ratings = await TutorRating.find(TutorRating.tutor_id == resolved_tutor_id).to_list()
        if all_ratings:
            avg_rating = sum(r.rating for r in all_ratings) / len(all_ratings)
            tutor_profile = await TutorProfile.get(resolved_tutor_id)
            if tutor_profile:
                tutor_profile.rating = round(avg_rating, 1)
                tutor_profile.total_reviews = len(all_ratings)
                await tutor_profile.save()
    except Exception:
        logger.exception("Failed to update tutor rating for tutor %s", resolved_tutor_id)

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
        certificate_url=certificate_url,
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
            certificate_url=None,
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
            certificate_url=None,
            created_at=r.created_at
        )
        for r in ratings
    ]


@router.get("/certificates/my", response_model=List[CertificateResponse])
async def get_my_certificates(current_user: User = Depends(get_current_user)):
    """Get completion certificates for current student."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can view certificates")

    certificates = await CompletionCertificate.find(
        CompletionCertificate.student_id == str(current_user.id)
    ).sort(-CompletionCertificate.created_at).to_list()

    return [
        CertificateResponse(
            id=str(c.id),
            booking_id=c.booking_id,
            subject=c.subject,
            session_name=c.session_name,
            tutor_name=c.tutor_name,
            session_date=c.session_date,
            certificate_number=c.certificate_number,
            file_url=c.file_url,
            created_at=c.created_at,
        )
        for c in certificates
    ]


@router.post("/certificates/{certificate_id}/regenerate", response_model=CertificateResponse)
async def regenerate_certificate(certificate_id: str, current_user: User = Depends(get_current_user)):
    """Regenerate an existing certificate using the latest template."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can regenerate certificates")

    certificate = await CompletionCertificate.get(certificate_id)
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")

    if certificate.student_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to regenerate this certificate")

    try:
        tutor_signature_url = None
        tutor_signature_bytes = None
        regen_tz_name: Optional[str] = None
        if certificate.tutor_id:
            from app.models.tutor import TutorProfile
            tutor_profile = await TutorProfile.get(certificate.tutor_id)
            if tutor_profile:
                tutor_signature_url = tutor_profile.signature_image_url
                tutor_signature_bytes = _load_signature_bytes(tutor_signature_url)
            tutor_avail = await TutorAvailability.find_one(
                TutorAvailability.tutor_id == certificate.tutor_id
            )
            if tutor_avail and (tutor_avail.timezone or "").strip():
                regen_tz_name = tutor_avail.timezone
        pdf_bytes = build_certificate_pdf(
            student_name=certificate.student_name,
            tutor_name=certificate.tutor_name,
            subject=certificate.subject,
            session_date=certificate.session_date,
            certificate_number=certificate.certificate_number,
            session_name=certificate.session_name,
            tutor_signature_url=tutor_signature_url,
            tutor_signature_bytes=tutor_signature_bytes,
            timezone_name=regen_tz_name,
        )

        file_name = f"completion-certificate-{certificate.booking_id}-v2.pdf"
        upload_result = minio_service.upload_bytes(
            file_data=pdf_bytes,
            filename=file_name,
            folder=f"certificates/{current_user.id}",
            content_type="application/pdf",
        )
        if not upload_result or not upload_result.get("url"):
            raise HTTPException(status_code=500, detail="Failed to upload regenerated certificate")

        certificate.file_url = upload_result["url"]
        certificate.file_name = file_name
        await certificate.save()

        return CertificateResponse(
            id=str(certificate.id),
            booking_id=certificate.booking_id,
            subject=certificate.subject,
            session_name=certificate.session_name,
            tutor_name=certificate.tutor_name,
            session_date=certificate.session_date,
            certificate_number=certificate.certificate_number,
            file_url=certificate.file_url,
            created_at=certificate.created_at,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to regenerate certificate %s", certificate_id)
        raise HTTPException(status_code=500, detail="Failed to regenerate certificate")


@router.get("/certificates/preview/tutor")
async def preview_certificate_for_tutor(
    student_name: str = Query(default="STUDENT NAME"),
    subject: str = Query(default="GENERAL SESSION"),
    session_name: Optional[str] = Query(default=None),
    session_date: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
):
    """Generate a live certificate preview for tutors (PDF, not persisted)."""
    if current_user.role != "tutor":
        raise HTTPException(status_code=403, detail="Only tutors can preview certificates")

    from app.models.tutor import TutorProfile
    tutor_profile = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor_profile:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    safe_student_name = (student_name or "").strip() or "STUDENT NAME"
    safe_subject = (subject or "").strip() or "GENERAL SESSION"
    safe_session_name = (session_name or "").strip() or None

    parsed_session_date = datetime.utcnow()
    if session_date:
        try:
            parsed_session_date = datetime.fromisoformat(session_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid session_date format. Use YYYY-MM-DD")

    certificate_number = f"PREVIEW-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

    preview_tz_name: Optional[str] = None
    preview_avail = await TutorAvailability.find_one(
        TutorAvailability.tutor_id == str(tutor_profile.id)
    )
    if preview_avail and (preview_avail.timezone or "").strip():
        preview_tz_name = preview_avail.timezone

    pdf_bytes = build_certificate_pdf(
        student_name=safe_student_name,
        tutor_name=(tutor_profile.full_name or current_user.full_name or "TUTOR"),
        subject=safe_subject,
        session_date=parsed_session_date,
        certificate_number=certificate_number,
        session_name=safe_session_name,
        tutor_signature_url=tutor_profile.signature_image_url,
        tutor_signature_bytes=_load_signature_bytes(tutor_profile.signature_image_url),
        timezone_name=preview_tz_name,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=certificate-preview.pdf"},
    )
