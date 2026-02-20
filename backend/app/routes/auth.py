from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from app.models.user import User, UserRole
from app.models.tutor import TutorProfile
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token
from app.core.security import get_password_hash, verify_password, create_access_token, decode_token
from app.services.email_service import email_service
from datetime import timedelta
from app.core.config import settings
import traceback
import httpx
from typing import Optional

router = APIRouter()
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await User.find_one(User.email == payload.get("sub"))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@router.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    try:
        existing_user = await User.find_one(User.email == user_data.email)
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")

        user = User(
            email=user_data.email,
            hashed_password=get_password_hash(user_data.password),
            full_name=user_data.full_name,
            role=user_data.role,
            phone=user_data.phone
        )
        await user.insert()

        # If registering as tutor, create tutor profile
        if user_data.role == UserRole.TUTOR:
            tutor_profile = TutorProfile(
                user_id=str(user.id),
                full_name=user.full_name,
                email=user.email
            )
            await tutor_profile.insert()

        # Send welcome email
        try:
            await email_service.send_welcome_email(
                to_email=user.email,
                user_name=user.full_name,
                is_tutor=(user_data.role == UserRole.TUTOR)
            )
        except Exception as e:
            print(f"[Email] Failed to send welcome email: {e}")

        access_token = create_access_token(
            data={"sub": user.email},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )

        return Token(
            access_token=access_token,
            user=UserResponse(
                id=str(user.id),
                email=user.email,
                full_name=user.full_name,
                role=user.role,
                phone=user.phone,
                avatar=user.avatar,
                is_active=user.is_active,
                is_verified=user.is_verified,
                created_at=user.created_at
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Registration error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await User.find_one(User.email == credentials.email)
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is disabled")

    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return Token(
        access_token=access_token,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            phone=user.phone,
            avatar=user.avatar,
            is_active=user.is_active,
            is_verified=user.is_verified,
            created_at=user.created_at
        )
    )

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        phone=current_user.phone,
        avatar=current_user.avatar,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at
    )


# Google OAuth Schemas
class GoogleAuthRequest(BaseModel):
    credential: str  # Google ID token
    role: Optional[str] = "student"  # Default role for new users


class GoogleUserInfo(BaseModel):
    email: str
    name: str
    picture: Optional[str] = None
    email_verified: bool = False


async def verify_google_token(credential: str) -> Optional[GoogleUserInfo]:
    """Verify Google ID token and extract user info"""
    try:
        # Verify token with Google
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}"
            )

            if response.status_code != 200:
                print(f"[Google Auth] Token verification failed: {response.text}")
                return None

            data = response.json()

            # Verify the token is for our app
            if data.get("aud") != settings.GOOGLE_CLIENT_ID:
                print(f"[Google Auth] Invalid audience: {data.get('aud')}")
                return None

            return GoogleUserInfo(
                email=data.get("email"),
                name=data.get("name", data.get("email", "").split("@")[0]),
                picture=data.get("picture"),
                email_verified=data.get("email_verified", "false") == "true"
            )
    except Exception as e:
        print(f"[Google Auth] Error verifying token: {e}")
        return None


@router.post("/google", response_model=Token)
async def google_auth(request: GoogleAuthRequest):
    """
    Authenticate with Google OAuth.
    If user exists, log them in.
    If user doesn't exist, create a new account.
    """
    # Verify Google token
    google_user = await verify_google_token(request.credential)
    if not google_user:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    # Check if user exists
    user = await User.find_one(User.email == google_user.email)

    if user:
        # Existing user - log them in
        if not user.is_active:
            raise HTTPException(status_code=401, detail="Account is disabled")

        # Update avatar if not set
        if not user.avatar and google_user.picture:
            user.avatar = google_user.picture
            await user.save()

            # Also update tutor profile if exists
            if user.role == UserRole.TUTOR:
                tutor_profile = await TutorProfile.find_one(TutorProfile.user_id == str(user.id))
                if tutor_profile and not tutor_profile.avatar:
                    tutor_profile.avatar = google_user.picture
                    await tutor_profile.save()
    else:
        # New user - create account
        role = UserRole.TUTOR if request.role == "tutor" else UserRole.STUDENT

        user = User(
            email=google_user.email,
            hashed_password="",  # No password for OAuth users
            full_name=google_user.name,
            role=role,
            avatar=google_user.picture,
            is_verified=google_user.email_verified,
            auth_provider="google"
        )
        await user.insert()

        # If registering as tutor, create tutor profile
        if role == UserRole.TUTOR:
            tutor_profile = TutorProfile(
                user_id=str(user.id),
                full_name=user.full_name,
                email=user.email,
                avatar=google_user.picture
            )
            await tutor_profile.insert()

        # Send welcome email
        try:
            await email_service.send_welcome_email(
                to_email=user.email,
                user_name=user.full_name,
                is_tutor=(role == UserRole.TUTOR)
            )
        except Exception as e:
            print(f"[Email] Failed to send welcome email: {e}")

    # Generate access token
    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return Token(
        access_token=access_token,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            phone=user.phone,
            avatar=user.avatar,
            is_active=user.is_active,
            is_verified=user.is_verified,
            created_at=user.created_at
        )
    )
