from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
import certifi

client: AsyncIOMotorClient = None

async def connect_to_mongo():
    global client
    mongo_url = settings.MONGODB_URL
    # Use certifi CA bundle for Atlas TLS; do not force TLS for local mongodb:// URLs.
    if mongo_url.startswith("mongodb+srv://"):
        temp_client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where())
    else:
        temp_client = AsyncIOMotorClient(mongo_url)

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
        database=temp_client[settings.DATABASE_NAME],
        document_models=[User, TutorProfile, Subject, Booking, Review, TutorAvailability, BlockedDate, TimeSlot, Notification, Payment, PlatformRevenue, StudentTutorRelation, Blog, Withdrawal, Material, Assignment, TutorRating, PlatformSettings]
    )

    # Only publish global client after successful Beanie initialization.
    client = temp_client

async def close_mongo_connection():
    global client
    if client:
        client.close()
        client = None

def get_database():
    if client is None:
        raise RuntimeError("Database client is not initialized")
    return client[settings.DATABASE_NAME]
