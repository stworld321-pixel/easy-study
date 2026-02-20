from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
import logging
from datetime import datetime
from app.models.tutor import TutorProfile
from app.models.user import User, UserRole
from app.models.booking import Review
from app.schemas.tutor import TutorProfileCreate, TutorProfileUpdate, TutorProfileResponse
from app.schemas.booking import ReviewResponse
from app.routes.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("", response_model=List[TutorProfileResponse])
async def get_tutors(
    subject: Optional[str] = None,
    country: Optional[str] = None,
    min_rate: Optional[float] = None,
    max_rate: Optional[float] = None,
    session_type: Optional[str] = None,
    language: Optional[str] = None,
    sort_by: Optional[str] = "newest",
    skip: int = 0,
    limit: int = 20
):
    try:
        # Don't filter by is_available to show all tutors
        query = {}

        if subject:
            query["subjects"] = {"$in": [subject]}
        if country:
            query["country"] = country
        if min_rate is not None:
            query["hourly_rate"] = {"$gte": min_rate}
        if max_rate is not None:
            query.setdefault("hourly_rate", {})["$lte"] = max_rate
        if session_type == "private":
            query["offers_private"] = True
        elif session_type == "group":
            query["offers_group"] = True
        if language:
            query["languages"] = {"$in": [language]}

        # Sort options
        sort_field = "-created_at"
        if sort_by == "oldest":
            sort_field = "created_at"
        elif sort_by == "rating":
            sort_field = "-rating"
        elif sort_by == "price_low":
            sort_field = "hourly_rate"
        elif sort_by == "price_high":
            sort_field = "-hourly_rate"

        tutors = await TutorProfile.find(query).sort(sort_field).skip(skip).limit(limit).to_list()

        results: List[TutorProfileResponse] = []
        for t in tutors:
            try:
                results.append(
                    TutorProfileResponse(
                        id=str(t.id),
                        user_id=str(t.user_id),
                        full_name=t.full_name or "Unknown",
                        email=t.email or "",
                        avatar=t.avatar,
                        headline=t.headline,
                        bio=t.bio,
                        experience_years=int(t.experience_years or 0),
                        education=t.education,
                        certifications=t.certifications or [],
                        hourly_rate=float(t.hourly_rate or 0),
                        currency=t.currency or "INR",
                        languages=t.languages or [],
                        teaching_style=t.teaching_style,
                        subjects=t.subjects or [],
                        country=t.country,
                        city=t.city,
                        timezone=t.timezone,
                        offers_private=t.offers_private if t.offers_private is not None else True,
                        offers_group=t.offers_group if t.offers_group is not None else False,
                        total_students=int(t.total_students or 0),
                        total_lessons=int(t.total_lessons or 0),
                        rating=float(t.rating or 0),
                        total_reviews=int(t.total_reviews or 0),
                        is_verified=t.is_verified if t.is_verified is not None else False,
                        is_featured=t.is_featured if t.is_featured is not None else False,
                        is_available=t.is_available if t.is_available is not None else True,
                        created_at=t.created_at or datetime.utcnow()
                    )
                )
            except Exception:
                logger.exception("Skipping invalid tutor record id=%s", getattr(t, "id", "unknown"))

        return results
    except Exception:
        logger.exception("Failed to fetch tutors")
        raise HTTPException(status_code=500, detail="Failed to fetch tutors")

@router.get("/featured", response_model=List[TutorProfileResponse])
async def get_featured_tutors(limit: int = 6):
    tutors = await TutorProfile.find(
        {"is_featured": True, "is_available": True}
    ).sort("-rating").limit(limit).to_list()

    return [
        TutorProfileResponse(
            id=str(t.id),
            user_id=t.user_id,
            full_name=t.full_name,
            email=t.email,
            avatar=t.avatar,
            headline=t.headline,
            bio=t.bio,
            experience_years=t.experience_years,
            education=t.education,
            certifications=t.certifications,
            hourly_rate=t.hourly_rate,
            currency=t.currency,
            languages=t.languages,
            teaching_style=t.teaching_style,
            subjects=t.subjects,
            country=t.country,
            city=t.city,
            timezone=t.timezone,
            offers_private=t.offers_private,
            offers_group=t.offers_group,
            total_students=t.total_students,
            total_lessons=t.total_lessons,
            rating=t.rating,
            total_reviews=t.total_reviews,
            is_verified=t.is_verified,
            is_featured=t.is_featured,
            is_available=t.is_available,
            created_at=t.created_at
        )
        for t in tutors
    ]

# NOTE: These profile routes MUST come BEFORE /{tutor_id} route to avoid conflicts
@router.get("/profile/me", response_model=TutorProfileResponse)
async def get_my_tutor_profile(current_user: User = Depends(get_current_user)):
    """Get the current tutor's own profile"""
    if current_user.role != UserRole.TUTOR:
        raise HTTPException(status_code=403, detail="Only tutors can access this endpoint")

    tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    return TutorProfileResponse(
        id=str(tutor.id),
        user_id=tutor.user_id,
        full_name=tutor.full_name,
        email=tutor.email,
        avatar=tutor.avatar,
        headline=tutor.headline,
        bio=tutor.bio,
        experience_years=tutor.experience_years,
        education=tutor.education,
        certifications=tutor.certifications,
        hourly_rate=tutor.hourly_rate,
        currency=tutor.currency,
        languages=tutor.languages,
        teaching_style=tutor.teaching_style,
        subjects=tutor.subjects,
        country=tutor.country,
        city=tutor.city,
        timezone=tutor.timezone,
        offers_private=tutor.offers_private,
        offers_group=tutor.offers_group,
        total_students=tutor.total_students,
        total_lessons=tutor.total_lessons,
        rating=tutor.rating,
        total_reviews=tutor.total_reviews,
        is_verified=tutor.is_verified,
        is_featured=tutor.is_featured,
        is_available=tutor.is_available,
        created_at=tutor.created_at
    )

@router.put("/profile", response_model=TutorProfileResponse)
async def update_tutor_profile(
    profile_data: TutorProfileUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update the current tutor's profile"""
    if current_user.role != UserRole.TUTOR:
        raise HTTPException(status_code=403, detail="Only tutors can update their profile")

    tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    update_data = profile_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tutor, field, value)

    await tutor.save()

    return TutorProfileResponse(
        id=str(tutor.id),
        user_id=tutor.user_id,
        full_name=tutor.full_name,
        email=tutor.email,
        avatar=tutor.avatar,
        headline=tutor.headline,
        bio=tutor.bio,
        experience_years=tutor.experience_years,
        education=tutor.education,
        certifications=tutor.certifications,
        hourly_rate=tutor.hourly_rate,
        currency=tutor.currency,
        languages=tutor.languages,
        teaching_style=tutor.teaching_style,
        subjects=tutor.subjects,
        country=tutor.country,
        city=tutor.city,
        timezone=tutor.timezone,
        offers_private=tutor.offers_private,
        offers_group=tutor.offers_group,
        total_students=tutor.total_students,
        total_lessons=tutor.total_lessons,
        rating=tutor.rating,
        total_reviews=tutor.total_reviews,
        is_verified=tutor.is_verified,
        is_featured=tutor.is_featured,
        is_available=tutor.is_available,
        created_at=tutor.created_at
    )

@router.get("/{tutor_id}", response_model=TutorProfileResponse)
async def get_tutor(tutor_id: str):
    tutor = await TutorProfile.get(tutor_id)
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found")

    return TutorProfileResponse(
        id=str(tutor.id),
        user_id=tutor.user_id,
        full_name=tutor.full_name,
        email=tutor.email,
        avatar=tutor.avatar,
        headline=tutor.headline,
        bio=tutor.bio,
        experience_years=tutor.experience_years,
        education=tutor.education,
        certifications=tutor.certifications,
        hourly_rate=tutor.hourly_rate,
        currency=tutor.currency,
        languages=tutor.languages,
        teaching_style=tutor.teaching_style,
        subjects=tutor.subjects,
        country=tutor.country,
        city=tutor.city,
        timezone=tutor.timezone,
        offers_private=tutor.offers_private,
        offers_group=tutor.offers_group,
        total_students=tutor.total_students,
        total_lessons=tutor.total_lessons,
        rating=tutor.rating,
        total_reviews=tutor.total_reviews,
        is_verified=tutor.is_verified,
        is_featured=tutor.is_featured,
        is_available=tutor.is_available,
        created_at=tutor.created_at
    )

@router.get("/{tutor_id}/reviews", response_model=List[ReviewResponse])
async def get_tutor_reviews(tutor_id: str, skip: int = 0, limit: int = 10):
    reviews = await Review.find(
        Review.tutor_id == tutor_id
    ).sort("-created_at").skip(skip).limit(limit).to_list()

    return [
        ReviewResponse(
            id=str(r.id),
            student_id=r.student_id,
            tutor_id=r.tutor_id,
            student_name=r.student_name,
            student_avatar=r.student_avatar,
            rating=r.rating,
            comment=r.comment,
            created_at=r.created_at
        )
        for r in reviews
    ]
