"""
Upload Routes - Image upload endpoints

Handles image uploads for tutor profiles, avatars, and documents.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from typing import Optional
from app.models.user import User
from app.models.tutor import TutorProfile
from app.routes.auth import get_current_user
from app.services.minio_service import minio_service

router = APIRouter(prefix="/uploads", tags=["Uploads"])


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload user avatar image.
    Replaces existing avatar if one exists.
    """
    # Read file data
    file_data = await file.read()

    if len(file_data) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    # Upload to MinIO
    result = minio_service.upload_image(
        file_data=file_data,
        filename=file.filename or "avatar.jpg",
        folder="avatars"
    )

    if not result:
        raise HTTPException(status_code=500, detail="Failed to upload image")

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    # Delete old avatar if exists
    if current_user.avatar:
        old_object = minio_service.extract_object_name_from_url(current_user.avatar)
        if old_object:
            minio_service.delete_image(old_object)

    # Update user avatar URL
    current_user.avatar = result["url"]
    await current_user.save()

    # Also update tutor profile if user is a tutor
    if current_user.role == "tutor":
        tutor_profile = await TutorProfile.find_one(
            TutorProfile.user_id == str(current_user.id)
        )
        if tutor_profile:
            tutor_profile.avatar = result["url"]
            await tutor_profile.save()

    return {
        "success": True,
        "url": result["url"],
        "message": "Avatar uploaded successfully"
    }


@router.post("/tutor-image")
async def upload_tutor_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload tutor profile image.
    Only tutors can upload tutor images.
    """
    if current_user.role != "tutor":
        raise HTTPException(status_code=403, detail="Only tutors can upload tutor images")

    # Get tutor profile
    tutor_profile = await TutorProfile.find_one(
        TutorProfile.user_id == str(current_user.id)
    )
    if not tutor_profile:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    # Read file data
    file_data = await file.read()

    if len(file_data) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    # Upload to MinIO
    result = minio_service.upload_image(
        file_data=file_data,
        filename=file.filename or "profile.jpg",
        folder="tutor-profiles"
    )

    if not result:
        raise HTTPException(status_code=500, detail="Failed to upload image")

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    # Delete old image if exists
    if tutor_profile.avatar:
        old_object = minio_service.extract_object_name_from_url(tutor_profile.avatar)
        if old_object:
            minio_service.delete_image(old_object)

    # Update tutor profile
    tutor_profile.avatar = result["url"]
    await tutor_profile.save()

    # Also update user avatar
    current_user.avatar = result["url"]
    await current_user.save()

    return {
        "success": True,
        "url": result["url"],
        "message": "Profile image uploaded successfully"
    }


@router.delete("/avatar")
async def delete_avatar(current_user: User = Depends(get_current_user)):
    """Delete user's avatar"""
    if not current_user.avatar:
        raise HTTPException(status_code=404, detail="No avatar to delete")

    # Extract object name and delete from MinIO
    object_name = minio_service.extract_object_name_from_url(current_user.avatar)
    if object_name:
        minio_service.delete_image(object_name)

    # Clear avatar URL
    current_user.avatar = None
    await current_user.save()

    # Also clear from tutor profile if applicable
    if current_user.role == "tutor":
        tutor_profile = await TutorProfile.find_one(
            TutorProfile.user_id == str(current_user.id)
        )
        if tutor_profile:
            tutor_profile.avatar = None
            await tutor_profile.save()

    return {
        "success": True,
        "message": "Avatar deleted successfully"
    }
