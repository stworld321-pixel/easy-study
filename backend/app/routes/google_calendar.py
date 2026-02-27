from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.core.config import settings
from app.models.tutor import TutorProfile
from app.models.user import User
from app.routes.auth import get_current_user

router = APIRouter(prefix="/google-calendar", tags=["Google Calendar"])

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]


class GoogleCalendarStatusResponse(BaseModel):
    connected: bool
    email: Optional[str] = None


class GoogleCalendarConnectResponse(BaseModel):
    auth_url: str


def _oauth_client_config() -> dict:
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="Google OAuth is not configured on the server")

    return {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }


def _calendar_callback_url(request: Request) -> str:
    explicit = (settings.GOOGLE_REDIRECT_URI or "").strip()
    if explicit:
        return explicit
    base = (settings.BACKEND_BASE_URL or "").rstrip("/")
    if base:
        return f"{base}/api/google-calendar/callback"
    return str(request.url_for("google_calendar_callback"))


def _state_token(user_id: str, frontend_redirect: str) -> str:
    payload = {
        "sub": user_id,
        "frontend_redirect": frontend_redirect,
        "exp": datetime.utcnow() + timedelta(minutes=15),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _decode_state(state: str) -> dict:
    try:
        return jwt.decode(state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as e:
        raise HTTPException(status_code=400, detail="Invalid OAuth state") from e


async def _get_tutor_profile_for_user(current_user: User) -> TutorProfile:
    role = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role != "tutor":
        raise HTTPException(status_code=403, detail="Only tutors can access Google Calendar settings")

    tutor = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")
    return tutor


@router.get("/status", response_model=GoogleCalendarStatusResponse)
async def google_calendar_status(current_user: User = Depends(get_current_user)):
    tutor = await _get_tutor_profile_for_user(current_user)
    return GoogleCalendarStatusResponse(
        connected=bool(tutor.google_calendar_connected),
        email=tutor.google_calendar_email,
    )


@router.get("/connect", response_model=GoogleCalendarConnectResponse)
async def google_calendar_connect(
    request: Request,
    frontend_redirect: str = Query(default=f"{settings.FRONTEND_URL}/tutor/dashboard?tab=calendar"),
    current_user: User = Depends(get_current_user),
):
    await _get_tutor_profile_for_user(current_user)

    client_config = _oauth_client_config()
    state = _state_token(str(current_user.id), frontend_redirect)

    redirect_uri = _calendar_callback_url(request)
    flow = Flow.from_client_config(client_config, scopes=SCOPES, state=state)
    flow.redirect_uri = redirect_uri

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return GoogleCalendarConnectResponse(auth_url=auth_url)


@router.get("/callback", name="google_calendar_callback")
async def google_calendar_callback(
    request: Request,
    state: str,
    code: Optional[str] = None,
    error: Optional[str] = None,
):
    payload = _decode_state(state)
    user_id = payload.get("sub")
    frontend_redirect = payload.get("frontend_redirect") or f"{settings.FRONTEND_URL}/tutor/dashboard?tab=calendar"

    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid callback state payload")

    if error:
        query = urlencode({"google_calendar": "error", "reason": error})
        sep = "&" if "?" in frontend_redirect else "?"
        return RedirectResponse(url=f"{frontend_redirect}{sep}{query}")

    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    tutor = await TutorProfile.find_one(TutorProfile.user_id == user_id)
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    client_config = _oauth_client_config()
    redirect_uri = _calendar_callback_url(request)
    flow = Flow.from_client_config(client_config, scopes=SCOPES, state=state)
    flow.redirect_uri = redirect_uri
    flow.fetch_token(code=code)
    creds = flow.credentials

    google_email = None
    try:
        oauth_service = build("oauth2", "v2", credentials=creds)
        user_info = oauth_service.userinfo().get().execute()
        google_email = user_info.get("email")
    except Exception:
        google_email = None

    tutor.google_calendar_connected = True
    tutor.google_calendar_email = google_email
    tutor.google_access_token = creds.token
    tutor.google_refresh_token = creds.refresh_token or tutor.google_refresh_token
    tutor.google_token_uri = creds.token_uri
    tutor.google_scopes = list(creds.scopes) if creds.scopes else SCOPES
    tutor.google_token_expiry = creds.expiry
    tutor.updated_at = datetime.utcnow()
    await tutor.save()

    query = urlencode({"google_calendar": "connected"})
    sep = "&" if "?" in frontend_redirect else "?"
    return RedirectResponse(url=f"{frontend_redirect}{sep}{query}")


@router.delete("/disconnect")
async def google_calendar_disconnect(current_user: User = Depends(get_current_user)):
    tutor = await _get_tutor_profile_for_user(current_user)

    # Clear stored OAuth credentials for this tutor
    tutor.google_calendar_connected = False
    tutor.google_calendar_email = None
    tutor.google_access_token = None
    tutor.google_refresh_token = None
    tutor.google_token_expiry = None
    tutor.google_scopes = None
    tutor.updated_at = datetime.utcnow()
    await tutor.save()

    return {"success": True, "message": "Google Calendar disconnected"}
