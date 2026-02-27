from datetime import datetime, timedelta, timezone
from typing import Any, Optional
import uuid
import logging

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.models.tutor import TutorProfile

GOOGLE_CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.events"]
logger = logging.getLogger(__name__)


class TutorGoogleCalendarService:
    @staticmethod
    def _credentials_from_tutor(tutor: TutorProfile) -> Optional[Credentials]:
        if not tutor.google_access_token:
            return None

        return Credentials(
            token=tutor.google_access_token,
            refresh_token=tutor.google_refresh_token,
            token_uri=tutor.google_token_uri or "https://oauth2.googleapis.com/token",
            scopes=tutor.google_scopes or GOOGLE_CALENDAR_SCOPES,
            expiry=tutor.google_token_expiry,
        )

    @staticmethod
    async def _refresh_if_needed(tutor: TutorProfile, creds: Credentials) -> Credentials:
        # Refresh whenever token is invalid/expired and refresh token exists.
        if (not creds.valid or creds.expired) and creds.refresh_token:
            creds.refresh(Request())
            tutor.google_access_token = creds.token
            tutor.google_refresh_token = creds.refresh_token or tutor.google_refresh_token
            tutor.google_scopes = list(creds.scopes) if creds.scopes else tutor.google_scopes
            tutor.google_token_uri = creds.token_uri or tutor.google_token_uri
            tutor.google_token_expiry = creds.expiry
            await tutor.save()
        return creds

    @staticmethod
    async def create_meet_event_for_tutor(
        tutor: TutorProfile,
        title: str,
        description: str,
        start_time: datetime,
        duration_minutes: int = 60,
        tutor_email: Optional[str] = None,
        student_email: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Create a Google Calendar event + Meet link using the tutor's own OAuth tokens.
        Returns a fallback payload when not connected or on API failure.
        """
        end_time = start_time + timedelta(minutes=duration_minutes)
        fallback = {
            "event_id": None,
            "meet_link": None,
            "html_link": None,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "status": "pending_meet_link",
        }

        if not tutor.google_calendar_connected:
            return fallback

        creds = TutorGoogleCalendarService._credentials_from_tutor(tutor)
        if not creds:
            return fallback

        try:
            creds = await TutorGoogleCalendarService._refresh_if_needed(tutor, creds)
            service = build("calendar", "v3", credentials=creds)

            attendees = []
            if tutor_email:
                attendees.append({"email": tutor_email})
            if student_email:
                attendees.append({"email": student_email})

            event = {
                "summary": title,
                "description": description,
                "start": {
                    "dateTime": start_time.astimezone(timezone.utc).isoformat(),
                    "timeZone": "UTC",
                },
                "end": {
                    "dateTime": end_time.astimezone(timezone.utc).isoformat(),
                    "timeZone": "UTC",
                },
                "attendees": attendees,
                "conferenceData": {
                    "createRequest": {
                        "requestId": str(uuid.uuid4()),
                        "conferenceSolutionKey": {"type": "hangoutsMeet"},
                    }
                },
            }

            created_event = service.events().insert(
                calendarId="primary",
                body=event,
                conferenceDataVersion=1,
                sendUpdates="all",
            ).execute()

            meet_link = None
            conference_data = created_event.get("conferenceData", {})
            for entry in conference_data.get("entryPoints", []):
                if entry.get("entryPointType") == "video":
                    meet_link = entry.get("uri")
                    break

            return {
                "event_id": created_event.get("id"),
                "meet_link": meet_link,
                "html_link": created_event.get("htmlLink"),
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "status": "created",
            }
        except HttpError:
            logger.exception("Google Calendar API error while creating meet event for tutor %s", tutor.id)
            return fallback
        except Exception:
            logger.exception("Unexpected error while creating meet event for tutor %s", tutor.id)
            return fallback

    @staticmethod
    async def add_attendee_to_event_for_tutor(
        tutor: TutorProfile,
        event_id: str,
        attendee_email: str,
    ) -> dict[str, Any]:
        """
        Add an attendee to an existing tutor-owned Google Calendar event.
        Returns event details (including Meet link) on success, or fallback payload on failure.
        """
        fallback = {
            "event_id": event_id,
            "meet_link": None,
            "html_link": None,
            "status": "pending_meet_link",
        }

        if not tutor.google_calendar_connected:
            return fallback

        creds = TutorGoogleCalendarService._credentials_from_tutor(tutor)
        if not creds:
            return fallback

        try:
            creds = await TutorGoogleCalendarService._refresh_if_needed(tutor, creds)
            service = build("calendar", "v3", credentials=creds)

            event = service.events().get(calendarId="primary", eventId=event_id).execute()
            attendees = event.get("attendees", [])
            attendee_email_normalized = attendee_email.strip().lower()

            existing = {a.get("email", "").strip().lower() for a in attendees}
            if attendee_email_normalized and attendee_email_normalized not in existing:
                attendees.append({"email": attendee_email_normalized})
                event["attendees"] = attendees
                event = service.events().update(
                    calendarId="primary",
                    eventId=event_id,
                    body=event,
                    sendUpdates="all",
                ).execute()

            meet_link = None
            conference_data = event.get("conferenceData", {})
            for entry in conference_data.get("entryPoints", []):
                if entry.get("entryPointType") == "video":
                    meet_link = entry.get("uri")
                    break

            return {
                "event_id": event.get("id"),
                "meet_link": meet_link,
                "html_link": event.get("htmlLink"),
                "status": "updated",
            }
        except HttpError:
            logger.exception("Google Calendar API error while adding attendee for tutor %s", tutor.id)
            return fallback
        except Exception:
            logger.exception("Unexpected error while adding attendee for tutor %s", tutor.id)
            return fallback


tutor_google_calendar_service = TutorGoogleCalendarService()
