from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from app.models.user import User, UserRole
from app.models.tutor import TutorProfile
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token
from app.core.security import get_password_hash, verify_password, create_access_token, decode_token
from app.services.email_service import email_service
from datetime import timedelta, datetime
from app.core.config import settings
import traceback
import asyncio
import logging
import httpx
import json
from typing import Optional
from jose import jwt as jose_jwt, JWTError
from pymongo.errors import DuplicateKeyError, PyMongoError
from beanie.exceptions import CollectionWasNotInitialized

router = APIRouter()
security = HTTPBearer()
logger = logging.getLogger(__name__)
_firebase_ready = False
_firebase_init_attempted = False
PASSWORD_SETUP_EXPIRE_MINUTES = 30


def _dispatch_background(coro, context: str) -> None:
    async def _runner():
        try:
            await coro
        except Exception:
            logger.exception("Background task failed (%s)", context)

    asyncio.create_task(_runner())

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await User.find_one({"email": payload.get("sub")})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _create_password_setup_token(email: str, expires_minutes: int = PASSWORD_SETUP_EXPIRE_MINUTES) -> str:
    payload = {
        "sub": email,
        "purpose": "password_setup",
        "exp": datetime.utcnow() + timedelta(minutes=expires_minutes),
    }
    return jose_jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _decode_password_setup_token(token: str) -> Optional[str]:
    try:
        payload = jose_jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("purpose") != "password_setup":
            return None
        return payload.get("sub")
    except JWTError:
        return None


def _init_firebase_admin() -> bool:
    global _firebase_ready, _firebase_init_attempted
    if _firebase_ready:
        return True
    if _firebase_init_attempted:
        return False
    _firebase_init_attempted = True

    try:
        import firebase_admin
        from firebase_admin import credentials

        try:
            firebase_admin.get_app()
            _firebase_ready = True
            return True
        except ValueError:
            pass

        cred = None
        if settings.FIREBASE_SERVICE_ACCOUNT_FILE:
            cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_FILE)
        elif settings.FIREBASE_SERVICE_ACCOUNT_JSON:
            cred = credentials.Certificate(json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON))

        options = {}
        if settings.FIREBASE_PROJECT_ID:
            options["projectId"] = settings.FIREBASE_PROJECT_ID

        if cred:
            firebase_admin.initialize_app(cred, options if options else None)
        else:
            # Try default credentials if available.
            firebase_admin.initialize_app(options=options if options else None)

        _firebase_ready = True
        return True
    except Exception as e:
        logger.warning("Firebase admin init failed: %s", e)
        return False


def _verify_firebase_token_sync(credential: str) -> Optional["GoogleUserInfo"]:
    try:
        if not _init_firebase_admin():
            return None
        from firebase_admin import auth as firebase_auth
        decoded = firebase_auth.verify_id_token(credential, check_revoked=False)
        email = decoded.get("email")
        if not email:
            return None
        return GoogleUserInfo(
            email=email,
            name=decoded.get("name", email.split("@")[0]),
            picture=decoded.get("picture"),
            email_verified=bool(decoded.get("email_verified", False))
        )
    except Exception:
        return None

@router.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    try:
        existing_user = await User.find_one({"email": user_data.email})
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
            _dispatch_background(
                email_service.send_welcome_email(
                    to_email=user.email,
                    user_name=user.full_name,
                    is_tutor=(user_data.role == UserRole.TUTOR)
                ),
                "register_welcome_email"
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
    except DuplicateKeyError:
        # Handles race-condition/DB-level unique index conflicts on email.
        raise HTTPException(status_code=400, detail="Email already registered")
    except CollectionWasNotInitialized:
        raise HTTPException(status_code=503, detail="Database unavailable. Beanie models are not initialized.")
    except PyMongoError:
        raise HTTPException(status_code=503, detail="Database unavailable. Check MongoDB connection.")
    except Exception as e:
        print(f"Registration error: {str(e)}")
        print(traceback.format_exc())
        error_text = str(e).strip().lower()
        if "duplicate key" in error_text and "email" in error_text:
            raise HTTPException(status_code=400, detail="Email already registered")
        if "valid email" in error_text:
            raise HTTPException(status_code=400, detail="Please enter a valid email address")
        if settings.DEBUG:
            raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Registration failed. Please try again.")

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await User.find_one({"email": credentials.email})
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


class PasswordSetupRequest(BaseModel):
    email: str


class PasswordSetupConfirmRequest(BaseModel):
    token: str
    password: str


async def verify_google_token(credential: str) -> Optional[GoogleUserInfo]:
    """Verify Google ID token and extract user info"""
    # 1) Firebase ID token flow (Google via Firebase Auth)
    firebase_user = await asyncio.to_thread(_verify_firebase_token_sync, credential)
    if firebase_user:
        return firebase_user

    # 2) Firebase REST verify fallback (works without service-account JSON)
    if settings.FIREBASE_WEB_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={settings.FIREBASE_WEB_API_KEY}",
                    json={"idToken": credential},
                )
                if response.status_code == 200:
                    data = response.json() or {}
                    users = data.get("users") or []
                    if users:
                        u = users[0]
                        email = u.get("email")
                        if email:
                            return GoogleUserInfo(
                                email=email,
                                name=u.get("displayName") or email.split("@")[0],
                                picture=u.get("photoUrl"),
                                email_verified=bool(u.get("emailVerified", False)),
                            )
                else:
                    logger.warning("Firebase REST token verify failed: %s", response.text)
        except Exception as e:
            logger.warning("Firebase REST verify error: %s", e)

    # 3) Legacy Google ID token flow (tokeninfo endpoint)
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
            if settings.GOOGLE_CLIENT_ID and data.get("aud") != settings.GOOGLE_CLIENT_ID:
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
    user = await User.find_one({"email": google_user.email})

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
                tutor_profile = await TutorProfile.find_one({"user_id": str(user.id)})
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
            _dispatch_background(
                email_service.send_welcome_email(
                    to_email=user.email,
                    user_name=user.full_name,
                    is_tutor=(role == UserRole.TUTOR)
                ),
                "google_register_welcome_email"
            )
        except Exception as e:
            print(f"[Email] Failed to send welcome email: {e}")

        # Google sign-up userக்கு immediate password setup link send பண்ணு
        # so same account can login via email/password too.
        try:
            setup_token = _create_password_setup_token(user.email)
            setup_link = f"{settings.FRONTEND_URL.rstrip('/')}/set-password?token={setup_token}"
            _dispatch_background(
                email_service.send_password_setup_email(
                    to_email=user.email,
                    user_name=user.full_name or "User",
                    setup_link=setup_link,
                    expires_minutes=PASSWORD_SETUP_EXPIRE_MINUTES,
                ),
                "google_register_password_setup_email"
            )
        except Exception as e:
            logger.exception("Failed to send password setup email for Google sign-up %s", user.email)

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


@router.post("/password/setup/request")
@router.post("/password/reset/request")
async def request_password_setup(data: PasswordSetupRequest):
    email = data.email.strip().lower()
    # Generic response to avoid account enumeration
    response = {"message": "If the account exists, a password setup link has been sent."}

    user = await User.find_one({"email": email})
    if not user or not user.is_active:
        return response

    token = _create_password_setup_token(user.email)
    setup_link = f"{settings.FRONTEND_URL.rstrip('/')}/set-password?token={token}"
    sent = await email_service.send_password_setup_email(
        to_email=user.email,
        user_name=user.full_name or "User",
        setup_link=setup_link,
        expires_minutes=PASSWORD_SETUP_EXPIRE_MINUTES,
    )
    if not sent:
        logger.error("Password reset email failed for %s", user.email)
        raise HTTPException(
            status_code=502,
            detail="Failed to send password reset email. Check SMTP host, port, username, password, and sender address."
        )
    return response


@router.post("/password/setup/confirm")
@router.post("/password/reset/confirm")
async def confirm_password_setup(data: PasswordSetupConfirmRequest):
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    email = _decode_password_setup_token(data.token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    user = await User.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    user.hashed_password = get_password_hash(data.password)
    user.updated_at = datetime.utcnow()
    await user.save()

    return {"message": "Password set successfully. You can now login with email and password."}
