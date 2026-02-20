"""
Google Meet Integration Service

This service creates Google Calendar events with Google Meet video conferencing.
It uses Google Calendar API with OAuth 2.0 for authentication.

Setup Requirements:
1. Create a Google Cloud Project at https://console.cloud.google.com
2. Enable Google Calendar API
3. Create OAuth 2.0 credentials (Desktop app) and download the JSON file
4. Set GOOGLE_CLIENT_SECRET_FILE in .env to the path of the JSON file
5. Run the app once - it will open a browser for you to authorize
"""

import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import uuid
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from app.core.config import settings

# Scopes required for Calendar API with Meet
SCOPES = ['https://www.googleapis.com/auth/calendar.events']

# Token file to store user's access and refresh tokens
# Use /etc/easystudy/google_creds/ for production (survives CI/CD deploys)
# Falls back to backend directory for local development
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROD_TOKEN_FILE = '/etc/easystudy/google_creds/token.json'
LOCAL_TOKEN_FILE = os.path.join(BACKEND_DIR, 'token.json')
TOKEN_FILE = PROD_TOKEN_FILE if os.path.exists(PROD_TOKEN_FILE) else LOCAL_TOKEN_FILE


class GoogleMeetService:
    def __init__(self):
        self.service = None
        self._initialized = False

    def _ensure_initialized(self):
        """Lazy initialization - only initialize when first needed"""
        if self._initialized:
            return
        self._initialized = True
        self._initialize_service()

    def _initialize_service(self):
        """Initialize the Google Calendar service with OAuth credentials"""
        print(f"[GoogleMeet] Initializing service...")
        print(f"[GoogleMeet] TOKEN_FILE path: {TOKEN_FILE}")
        print(f"[GoogleMeet] CLIENT_SECRET_FILE: {settings.GOOGLE_CLIENT_SECRET_FILE}")

        if not settings.GOOGLE_CLIENT_SECRET_FILE:
            print("[GoogleMeet] Warning: GOOGLE_CLIENT_SECRET_FILE not configured. Meet links will not be generated.")
            return

        if not os.path.exists(settings.GOOGLE_CLIENT_SECRET_FILE):
            print(f"[GoogleMeet] Warning: Client secret file not found at {settings.GOOGLE_CLIENT_SECRET_FILE}")
            return

        try:
            creds = None

            # Check if we have saved tokens
            print(f"[GoogleMeet] Checking for token file at: {TOKEN_FILE}")
            print(f"[GoogleMeet] Token file exists: {os.path.exists(TOKEN_FILE)}")

            if os.path.exists(TOKEN_FILE):
                creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
                print(f"[GoogleMeet] Loaded credentials from token file")

            # If no valid credentials, let user login
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    # Refresh expired token
                    print("Refreshing expired Google token...")
                    creds.refresh(Request())
                    # Save the refreshed token
                    with open(TOKEN_FILE, 'w') as token:
                        token.write(creds.to_json())
                    print("Token refreshed and saved successfully")
                else:
                    # Need to authorize - this opens a browser
                    print("\n" + "="*60)
                    print("GOOGLE AUTHORIZATION REQUIRED")
                    print("A browser window will open for you to authorize the app.")
                    print("="*60 + "\n")

                    flow = InstalledAppFlow.from_client_secrets_file(
                        settings.GOOGLE_CLIENT_SECRET_FILE, SCOPES
                    )
                    creds = flow.run_local_server(port=8080)

                # Save credentials for next time
                with open(TOKEN_FILE, 'w') as token:
                    token.write(creds.to_json())
                print("Google authorization successful! Token saved.")

            self.service = build('calendar', 'v3', credentials=creds)
            print("Google Calendar service initialized successfully")

        except Exception as e:
            print(f"Failed to initialize Google Calendar service: {e}")
            self.service = None

    def create_meet_event(
        self,
        title: str,
        description: str,
        start_time: datetime,
        duration_minutes: int = 60,
        attendees: list = None,
        tutor_email: str = None,
        student_email: str = None
    ) -> Optional[Dict[str, Any]]:
        """
        Create a Google Calendar event with Google Meet link

        Args:
            title: Event title (e.g., "Math Tutoring Session")
            description: Event description
            start_time: Session start time
            duration_minutes: Session duration in minutes
            attendees: List of attendee email addresses
            tutor_email: Tutor's email address
            student_email: Student's email address

        Returns:
            Dictionary with event details including Meet link, or None if failed
        """
        self._ensure_initialized()
        if not self.service:
            return self._generate_fallback_response(title, start_time, duration_minutes)

        try:
            end_time = start_time + timedelta(minutes=duration_minutes)

            # Build attendees list
            event_attendees = []
            if tutor_email:
                event_attendees.append({'email': tutor_email})
            if student_email:
                event_attendees.append({'email': student_email})
            if attendees:
                event_attendees.extend([{'email': email} for email in attendees])

            # Create event with Google Meet conferencing
            event = {
                'summary': title,
                'description': description,
                'start': {
                    'dateTime': start_time.isoformat(),
                    'timeZone': 'UTC',
                },
                'end': {
                    'dateTime': end_time.isoformat(),
                    'timeZone': 'UTC',
                },
                'attendees': event_attendees if event_attendees else [],
                'conferenceData': {
                    'createRequest': {
                        'requestId': str(uuid.uuid4()),
                        'conferenceSolutionKey': {
                            'type': 'hangoutsMeet'
                        }
                    }
                },
                'reminders': {
                    'useDefault': False,
                    'overrides': [
                        {'method': 'email', 'minutes': 60},
                        {'method': 'popup', 'minutes': 15},
                    ],
                },
            }

            # Create the event with conference data
            created_event = self.service.events().insert(
                calendarId='primary',
                body=event,
                conferenceDataVersion=1,
                sendUpdates='all'
            ).execute()

            # Extract Meet link from conference data
            meet_link = None
            if 'conferenceData' in created_event:
                entry_points = created_event['conferenceData'].get('entryPoints', [])
                for entry in entry_points:
                    if entry.get('entryPointType') == 'video':
                        meet_link = entry.get('uri')
                        break

            print(f"Created Meet event: {created_event.get('id')} with link: {meet_link}")

            return {
                'event_id': created_event.get('id'),
                'meet_link': meet_link,
                'html_link': created_event.get('htmlLink'),
                'start_time': start_time.isoformat(),
                'end_time': end_time.isoformat(),
                'status': 'created'
            }

        except HttpError as e:
            print(f"Google Calendar API error: {e}")
            return self._generate_fallback_response(title, start_time, duration_minutes)
        except Exception as e:
            print(f"Error creating Meet event: {e}")
            return self._generate_fallback_response(title, start_time, duration_minutes)

    def _generate_fallback_response(
        self,
        title: str,
        start_time: datetime,
        duration_minutes: int
    ) -> Dict[str, Any]:
        """Generate a fallback response when Google API is not available"""
        end_time = start_time + timedelta(minutes=duration_minutes)
        return {
            'event_id': None,
            'meet_link': None,
            'html_link': None,
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat(),
            'status': 'pending_meet_link'
        }

    def cancel_event(self, event_id: str) -> bool:
        """Cancel/delete a calendar event"""
        self._ensure_initialized()
        if not self.service or not event_id:
            return False

        try:
            self.service.events().delete(
                calendarId='primary',
                eventId=event_id,
                sendUpdates='all'
            ).execute()
            return True
        except Exception as e:
            print(f"Error cancelling event: {e}")
            return False


# Singleton instance
google_meet_service = GoogleMeetService()
