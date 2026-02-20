from fastapi import APIRouter, HTTPException
from typing import List
from app.models.tutor import Subject
from app.schemas.tutor import SubjectCreate, SubjectResponse

router = APIRouter()

@router.get("", response_model=List[SubjectResponse])
async def get_subjects():
    subjects = await Subject.find_all().to_list()
    return [
        SubjectResponse(
            id=str(s.id),
            name=s.name,
            category=s.category,
            icon=s.icon
        )
        for s in subjects
    ]

@router.post("", response_model=SubjectResponse)
async def create_subject(subject_data: SubjectCreate):
    existing = await Subject.find_one(Subject.name == subject_data.name)
    if existing:
        raise HTTPException(status_code=400, detail="Subject already exists")

    subject = Subject(
        name=subject_data.name,
        category=subject_data.category,
        icon=subject_data.icon
    )
    await subject.insert()

    return SubjectResponse(
        id=str(subject.id),
        name=subject.name,
        category=subject.category,
        icon=subject.icon
    )

@router.get("/categories")
async def get_subject_categories():
    subjects = await Subject.find_all().to_list()
    categories = {}
    for s in subjects:
        cat = s.category or "Other"
        if cat not in categories:
            categories[cat] = []
        categories[cat].append({
            "id": str(s.id),
            "name": s.name,
            "icon": s.icon
        })
    return categories
