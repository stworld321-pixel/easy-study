"""
Script to create an admin user using the proper Beanie model
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
import bcrypt
from datetime import datetime, timezone

# Import models
import sys
sys.path.insert(0, '.')
from app.models.user import User, UserRole
from app.core.config import settings

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt - same as the app."""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

async def create_admin():
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]

    # Initialize Beanie with the User model
    await init_beanie(database=db, document_models=[User])

    # Admin credentials
    admin_email = "admin@zealcatalyst.com"
    admin_password = "admin123"
    admin_name = "Admin User"

    # Check if admin already exists
    existing = await User.find_one(User.email == admin_email)
    if existing:
        print(f"Admin user already exists: {admin_email}")
        # Update password and role
        existing.hashed_password = get_password_hash(admin_password)
        existing.role = UserRole.ADMIN
        existing.is_active = True
        existing.is_verified = True
        await existing.save()
        print("Updated admin password and role")
        client.close()
        return

    # Create admin user using the model
    admin_user = User(
        email=admin_email,
        hashed_password=get_password_hash(admin_password),
        full_name=admin_name,
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True
    )
    await admin_user.insert()

    print(f"Admin user created successfully!")
    print(f"Email: {admin_email}")
    print(f"Password: {admin_password}")
    print(f"ID: {admin_user.id}")

    client.close()

if __name__ == "__main__":
    asyncio.run(create_admin())
