from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings

client: AsyncIOMotorClient = None

async def connect_to_mongo():
    global client
    client = AsyncIOMotorClient(settings.MONGODB_URL)

    from app.models.user import User
    from app.models.tutor import TutorProfile, Subject
    from app.models.booking import Booking, Review
    from app.models.availability import TutorAvailability, BlockedDate, TimeSlot
    from app.models.notification import Notification
    from app.models.payment import Payment, PlatformRevenue, StudentTutorRelation
    from app.models.blog import Blog
    from app.models.withdrawal import Withdrawal
    from app.models.material import Material, Assignment, TutorRating
    from app.models.platform_settings import PlatformSettings

    await init_beanie(
        database=client[settings.DATABASE_NAME],
        document_models=[User, TutorProfile, Subject, Booking, Review, TutorAvailability, BlockedDate, TimeSlot, Notification, Payment, PlatformRevenue, StudentTutorRelation, Blog, Withdrawal, Material, Assignment, TutorRating, PlatformSettings]
    )

async def close_mongo_connection():
    global client
    if client:
        client.close()

def get_database():
    return client[settings.DATABASE_NAME]
