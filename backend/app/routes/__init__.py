from fastapi import APIRouter
from app.routes import auth, tutors, bookings, subjects, availability, admin, notifications, payments, blog, withdrawals, uploads, materials, google_calendar

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(tutors.router, prefix="/tutors", tags=["Tutors"])
api_router.include_router(bookings.router, prefix="/bookings", tags=["Bookings"])
api_router.include_router(subjects.router, prefix="/subjects", tags=["Subjects"])
api_router.include_router(availability.router, prefix="/availability", tags=["Availability"])
api_router.include_router(admin.router, tags=["Admin"])
api_router.include_router(notifications.router, tags=["Notifications"])
api_router.include_router(payments.router, tags=["Payments"])
api_router.include_router(blog.router, tags=["Blogs"])
api_router.include_router(withdrawals.router, tags=["Withdrawals"])
api_router.include_router(uploads.router, tags=["Uploads"])
api_router.include_router(materials.router, tags=["Materials & Ratings"])
api_router.include_router(google_calendar.router, tags=["Google Calendar"])
