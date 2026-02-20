import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.tutor import TutorProfile, Subject
from app.models.booking import Booking, Review
from datetime import datetime

async def seed_database():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=client[settings.DATABASE_NAME],
        document_models=[User, TutorProfile, Subject, Booking, Review]
    )

    # Clear existing data
    await User.delete_all()
    await TutorProfile.delete_all()
    await Subject.delete_all()
    await Review.delete_all()

    # Create subjects
    subjects_data = [
        {"name": "Mathematics", "category": "Science", "icon": "calculator"},
        {"name": "Physics", "category": "Science", "icon": "atom"},
        {"name": "Chemistry", "category": "Science", "icon": "flask"},
        {"name": "Biology", "category": "Science", "icon": "dna"},
        {"name": "English", "category": "Languages", "icon": "book"},
        {"name": "Spanish", "category": "Languages", "icon": "language"},
        {"name": "French", "category": "Languages", "icon": "language"},
        {"name": "Computer Science", "category": "Technology", "icon": "code"},
        {"name": "Web Development", "category": "Technology", "icon": "globe"},
        {"name": "Python Programming", "category": "Technology", "icon": "terminal"},
        {"name": "Data Science", "category": "Technology", "icon": "chart"},
        {"name": "UI/UX Design", "category": "Design", "icon": "palette"},
    ]

    for s in subjects_data:
        subject = Subject(**s)
        await subject.insert()

    print("Subjects seeded!")

    # Create sample tutors
    tutors_data = [
        {
            "email": "sarah.johnson@example.com",
            "full_name": "Dr. Sarah Johnson",
            "headline": "Expert Mathematics & Physics Tutor | PhD in Applied Mathematics",
            "bio": "With over 10 years of teaching experience, I specialize in making complex mathematical concepts accessible and engaging. My approach focuses on building strong foundations while developing problem-solving skills.",
            "experience_years": 10,
            "education": "PhD in Applied Mathematics - MIT",
            "certifications": ["Certified Math Educator", "AP Physics Certified"],
            "hourly_rate": 75.0,
            "languages": ["English", "Spanish"],
            "subjects": ["Mathematics", "Physics"],
            "country": "United States",
            "city": "Boston",
            "timezone": "EST",
            "rating": 4.9,
            "total_reviews": 156,
            "total_students": 89,
            "total_lessons": 450,
            "is_verified": True,
            "is_featured": True,
        },
        {
            "email": "james.chen@example.com",
            "full_name": "James Chen",
            "headline": "Full-Stack Developer & Programming Instructor",
            "bio": "Former Google engineer with a passion for teaching. I help students master programming from basics to advanced concepts, focusing on practical, real-world applications.",
            "experience_years": 8,
            "education": "MS in Computer Science - Stanford University",
            "certifications": ["AWS Certified", "Google Cloud Professional"],
            "hourly_rate": 85.0,
            "languages": ["English", "Mandarin"],
            "subjects": ["Computer Science", "Web Development", "Python Programming"],
            "country": "United States",
            "city": "San Francisco",
            "timezone": "PST",
            "rating": 4.8,
            "total_reviews": 124,
            "total_students": 67,
            "total_lessons": 380,
            "is_verified": True,
            "is_featured": True,
        },
        {
            "email": "emma.williams@example.com",
            "full_name": "Emma Williams",
            "headline": "IELTS & English Language Specialist",
            "bio": "Native English speaker with expertise in IELTS preparation and academic writing. I've helped hundreds of students achieve their target scores and improve their communication skills.",
            "experience_years": 6,
            "education": "MA in English Literature - Oxford University",
            "certifications": ["CELTA Certified", "IELTS Examiner Training"],
            "hourly_rate": 55.0,
            "languages": ["English", "French"],
            "subjects": ["English", "French"],
            "country": "United Kingdom",
            "city": "London",
            "timezone": "GMT",
            "rating": 4.9,
            "total_reviews": 203,
            "total_students": 145,
            "total_lessons": 620,
            "is_verified": True,
            "is_featured": True,
        },
        {
            "email": "raj.patel@example.com",
            "full_name": "Dr. Raj Patel",
            "headline": "Chemistry & Biology Expert | Medical Entrance Prep",
            "bio": "Medical doctor and experienced educator specializing in chemistry and biology for pre-med students. My teaching combines academic rigor with practical medical applications.",
            "experience_years": 12,
            "education": "MD - Johns Hopkins University",
            "certifications": ["Board Certified", "Science Education Certificate"],
            "hourly_rate": 90.0,
            "languages": ["English", "Hindi"],
            "subjects": ["Chemistry", "Biology"],
            "country": "India",
            "city": "Mumbai",
            "timezone": "IST",
            "rating": 4.7,
            "total_reviews": 98,
            "total_students": 52,
            "total_lessons": 280,
            "is_verified": True,
            "is_featured": True,
        },
        {
            "email": "maria.garcia@example.com",
            "full_name": "Maria Garcia",
            "headline": "Data Science & Machine Learning Instructor",
            "bio": "Data scientist with experience at top tech companies. I teach practical data science skills with hands-on projects and real-world datasets.",
            "experience_years": 5,
            "education": "MS in Data Science - Columbia University",
            "certifications": ["TensorFlow Developer Certificate", "AWS ML Specialty"],
            "hourly_rate": 80.0,
            "languages": ["English", "Spanish"],
            "subjects": ["Data Science", "Python Programming"],
            "country": "Spain",
            "city": "Barcelona",
            "timezone": "CET",
            "rating": 4.8,
            "total_reviews": 87,
            "total_students": 43,
            "total_lessons": 195,
            "is_verified": True,
            "is_featured": True,
        },
        {
            "email": "alex.kim@example.com",
            "full_name": "Alex Kim",
            "headline": "UI/UX Designer & Design Thinking Coach",
            "bio": "Award-winning designer with experience at leading design agencies. I teach design principles, tools, and methodologies that help students build impressive portfolios.",
            "experience_years": 7,
            "education": "BFA in Graphic Design - Rhode Island School of Design",
            "certifications": ["Google UX Design Certificate", "Design Sprint Master"],
            "hourly_rate": 70.0,
            "languages": ["English", "Korean"],
            "subjects": ["UI/UX Design", "Web Development"],
            "country": "South Korea",
            "city": "Seoul",
            "timezone": "KST",
            "rating": 4.9,
            "total_reviews": 65,
            "total_students": 38,
            "total_lessons": 150,
            "is_verified": True,
            "is_featured": True,
        },
    ]

    for t in tutors_data:
        # Create user
        user = User(
            email=t["email"],
            hashed_password=get_password_hash("password123"),
            full_name=t["full_name"],
            role=UserRole.TUTOR,
            is_verified=True,
        )
        await user.insert()

        # Create tutor profile
        tutor_profile = TutorProfile(
            user_id=str(user.id),
            full_name=t["full_name"],
            email=t["email"],
            avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={t['full_name'].replace(' ', '')}",
            headline=t["headline"],
            bio=t["bio"],
            experience_years=t["experience_years"],
            education=t["education"],
            certifications=t["certifications"],
            hourly_rate=t["hourly_rate"],
            languages=t["languages"],
            subjects=t["subjects"],
            country=t["country"],
            city=t["city"],
            timezone=t["timezone"],
            rating=t["rating"],
            total_reviews=t["total_reviews"],
            total_students=t["total_students"],
            total_lessons=t["total_lessons"],
            is_verified=t["is_verified"],
            is_featured=t["is_featured"],
            offers_private=True,
            offers_group=True,
        )
        await tutor_profile.insert()

    print("Tutors seeded!")

    # Create a sample student
    student = User(
        email="student@example.com",
        hashed_password=get_password_hash("password123"),
        full_name="John Student",
        role=UserRole.STUDENT,
    )
    await student.insert()

    print("Sample student created!")
    print("\nSeed data complete!")
    print("\nSample credentials:")
    print("  Student: student@example.com / password123")
    print("  Tutor: sarah.johnson@example.com / password123")

    client.close()

if __name__ == "__main__":
    asyncio.run(seed_database())
