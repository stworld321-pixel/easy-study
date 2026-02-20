"""
Email Service - SMTP email sending for notifications
"""

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List
from datetime import datetime
import asyncio
from app.core.config import settings


class EmailService:
    """Service for sending emails via SMTP."""

    def __init__(self):
        self.host = settings.MAIL_HOST
        self.port = settings.MAIL_PORT
        self.username = settings.MAIL_USERNAME
        self.password = settings.MAIL_PASSWORD
        self.from_address = settings.MAIL_FROM_ADDRESS
        self.from_name = settings.MAIL_FROM_NAME
        self.use_ssl = settings.MAIL_USE_SSL

    def _create_message(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        plain_content: Optional[str] = None
    ) -> MIMEMultipart:
        """Create a MIME message with HTML and optional plain text."""
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{self.from_name} <{self.from_address}>"
        message["To"] = to_email

        # Add plain text version
        if plain_content:
            part1 = MIMEText(plain_content, "plain")
            message.attach(part1)

        # Add HTML version
        part2 = MIMEText(html_content, "html")
        message.attach(part2)

        return message

    def _send_sync(self, to_email: str, subject: str, html_content: str, plain_content: Optional[str] = None) -> bool:
        """Synchronous email sending."""
        try:
            message = self._create_message(to_email, subject, html_content, plain_content)

            # Create SSL context
            context = ssl.create_default_context()

            if self.use_ssl:
                # Use SSL (port 465)
                with smtplib.SMTP_SSL(self.host, self.port, context=context) as server:
                    server.login(self.username, self.password)
                    server.sendmail(self.from_address, to_email, message.as_string())
            else:
                # Use STARTTLS (port 587)
                with smtplib.SMTP(self.host, self.port) as server:
                    server.starttls(context=context)
                    server.login(self.username, self.password)
                    server.sendmail(self.from_address, to_email, message.as_string())

            print(f"[Email] Sent to {to_email}: {subject}")
            return True

        except Exception as e:
            print(f"[Email] Failed to send to {to_email}: {e}")
            return False

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        plain_content: Optional[str] = None
    ) -> bool:
        """Send an email asynchronously."""
        # Run sync email sending in a thread pool
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self._send_sync,
            to_email,
            subject,
            html_content,
            plain_content
        )

    async def send_bulk_email(
        self,
        recipients: List[str],
        subject: str,
        html_content: str,
        plain_content: Optional[str] = None
    ) -> dict:
        """Send the same email to multiple recipients."""
        results = {"success": [], "failed": []}

        for email in recipients:
            success = await self.send_email(email, subject, html_content, plain_content)
            if success:
                results["success"].append(email)
            else:
                results["failed"].append(email)

        return results

    # ==================== Email Templates ====================

    def _base_template(self, content: str) -> str:
        """Wrap content in base email template."""
        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zeal Catalyst</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Zeal Catalyst</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Your Learning Journey Starts Here</p>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            {content}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #6b7280; font-size: 12px; margin: 0;">
                                &copy; {datetime.now().year} Zeal Catalyst. All rights reserved.
                            </p>
                            <p style="color: #9ca3af; font-size: 11px; margin: 8px 0 0;">
                                You received this email because you have an account with Zeal Catalyst.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

    async def send_booking_notification(
        self,
        to_email: str,
        recipient_name: str,
        other_party_name: str,
        subject_name: str,
        scheduled_at: datetime,
        is_new_booking: bool = True,
        is_for_tutor: bool = True
    ) -> bool:
        """Send booking notification email."""
        formatted_date = scheduled_at.strftime("%B %d, %Y")
        formatted_time = scheduled_at.strftime("%I:%M %p")

        if is_new_booking:
            if is_for_tutor:
                title = "New Booking Request"
                message = f"{other_party_name} has requested a tutoring session with you."
                action_text = "View Booking"
            else:
                title = "Booking Submitted"
                message = f"Your booking request with {other_party_name} has been submitted."
                action_text = "View Bookings"
        else:
            title = "Booking Confirmed"
            message = f"Your {subject_name} session with {other_party_name} has been confirmed!"
            action_text = "View Details"

        content = f"""
            <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">{title}</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Hi {recipient_name},
            </p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                {message}
            </p>
            <div style="background-color: #f3f4f6; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
                <table style="width: 100%;">
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Subject:</td>
                        <td style="color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">{subject_name}</td>
                    </tr>
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Date:</td>
                        <td style="color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">{formatted_date}</td>
                    </tr>
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Time:</td>
                        <td style="color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">{formatted_time}</td>
                    </tr>
                </table>
            </div>
            <div style="text-align: center;">
                <a href="{settings.FRONTEND_URL}/{'tutor' if is_for_tutor else 'student'}/dashboard"
                   style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    {action_text}
                </a>
            </div>
        """

        plain_text = f"""
Hi {recipient_name},

{message}

Subject: {subject_name}
Date: {formatted_date}
Time: {formatted_time}

Log in to your dashboard to view more details.

Best regards,
Zeal Catalyst Team
"""

        return await self.send_email(
            to_email=to_email,
            subject=f"Zeal Catalyst - {title}",
            html_content=self._base_template(content),
            plain_content=plain_text
        )

    async def send_booking_confirmed_email(
        self,
        to_email: str,
        student_name: str,
        tutor_name: str,
        subject_name: str,
        scheduled_at: datetime,
        meeting_link: Optional[str] = None
    ) -> bool:
        """Send booking confirmation email to student."""
        formatted_date = scheduled_at.strftime("%B %d, %Y")
        formatted_time = scheduled_at.strftime("%I:%M %p")

        meeting_section = ""
        if meeting_link:
            meeting_section = f"""
            <tr>
                <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Meeting Link:</td>
                <td style="color: #6366f1; font-size: 14px; font-weight: 600; text-align: right;">
                    <a href="{meeting_link}" style="color: #6366f1;">Join Meeting</a>
                </td>
            </tr>
            """

        content = f"""
            <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">Booking Confirmed!</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Hi {student_name},
            </p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Great news! Your tutoring session has been confirmed by {tutor_name}.
            </p>
            <div style="background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
                <div style="text-align: center; margin-bottom: 16px;">
                    <span style="background-color: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">CONFIRMED</span>
                </div>
                <table style="width: 100%;">
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Subject:</td>
                        <td style="color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">{subject_name}</td>
                    </tr>
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Tutor:</td>
                        <td style="color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">{tutor_name}</td>
                    </tr>
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Date:</td>
                        <td style="color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">{formatted_date}</td>
                    </tr>
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Time:</td>
                        <td style="color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">{formatted_time}</td>
                    </tr>
                    {meeting_section}
                </table>
            </div>
            <div style="text-align: center;">
                <a href="{settings.FRONTEND_URL}/student/dashboard"
                   style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    View My Bookings
                </a>
            </div>
        """

        plain_text = f"""
Hi {student_name},

Great news! Your tutoring session has been confirmed by {tutor_name}.

Session Details:
- Subject: {subject_name}
- Tutor: {tutor_name}
- Date: {formatted_date}
- Time: {formatted_time}
{f'- Meeting Link: {meeting_link}' if meeting_link else ''}

Log in to your dashboard to view more details.

Best regards,
Zeal Catalyst Team
"""

        return await self.send_email(
            to_email=to_email,
            subject=f"Zeal Catalyst - Booking Confirmed with {tutor_name}",
            html_content=self._base_template(content),
            plain_content=plain_text
        )

    async def send_booking_cancelled_email(
        self,
        to_email: str,
        recipient_name: str,
        cancelled_by: str,
        subject_name: str,
        scheduled_at: datetime
    ) -> bool:
        """Send booking cancellation email."""
        formatted_date = scheduled_at.strftime("%B %d, %Y")
        formatted_time = scheduled_at.strftime("%I:%M %p")

        content = f"""
            <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">Booking Cancelled</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Hi {recipient_name},
            </p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Unfortunately, your scheduled session has been cancelled by {cancelled_by}.
            </p>
            <div style="background-color: #fef2f2; border: 1px solid #ef4444; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
                <div style="text-align: center; margin-bottom: 16px;">
                    <span style="background-color: #ef4444; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">CANCELLED</span>
                </div>
                <table style="width: 100%;">
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Subject:</td>
                        <td style="color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">{subject_name}</td>
                    </tr>
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Was scheduled for:</td>
                        <td style="color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">{formatted_date} at {formatted_time}</td>
                    </tr>
                </table>
            </div>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                You can book another session with a different time or tutor from our platform.
            </p>
            <div style="text-align: center;">
                <a href="{settings.FRONTEND_URL}/find-tutors"
                   style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Find Tutors
                </a>
            </div>
        """

        plain_text = f"""
Hi {recipient_name},

Unfortunately, your scheduled session has been cancelled by {cancelled_by}.

Session Details:
- Subject: {subject_name}
- Was scheduled for: {formatted_date} at {formatted_time}

You can book another session with a different time or tutor from our platform.

Best regards,
Zeal Catalyst Team
"""

        return await self.send_email(
            to_email=to_email,
            subject=f"Zeal Catalyst - Booking Cancelled",
            html_content=self._base_template(content),
            plain_content=plain_text
        )

    async def send_tutor_verified_email(
        self,
        to_email: str,
        tutor_name: str
    ) -> bool:
        """Send tutor verification approval email."""
        content = f"""
            <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">Congratulations! You're Verified!</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Hi {tutor_name},
            </p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Great news! Your tutor profile has been verified by our team. You can now start receiving booking requests from students.
            </p>
            <div style="background-color: #ecfdf5; border-radius: 12px; padding: 24px; margin: 0 0 24px; text-align: center;">
                <div style="width: 64px; height: 64px; background-color: #10b981; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                    <span style="color: white; font-size: 32px;">✓</span>
                </div>
                <h3 style="color: #059669; margin: 0; font-size: 20px;">Profile Verified</h3>
            </div>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                Here are some tips to get started:
            </p>
            <ul style="color: #4b5563; font-size: 14px; line-height: 1.8; margin: 0 0 24px; padding-left: 20px;">
                <li>Complete your profile with a professional photo</li>
                <li>Set your availability schedule</li>
                <li>Add detailed descriptions to your subjects</li>
                <li>Respond promptly to booking requests</li>
            </ul>
            <div style="text-align: center;">
                <a href="{settings.FRONTEND_URL}/tutor/dashboard"
                   style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Go to Dashboard
                </a>
            </div>
        """

        plain_text = f"""
Hi {tutor_name},

Great news! Your tutor profile has been verified by our team. You can now start receiving booking requests from students.

Here are some tips to get started:
- Complete your profile with a professional photo
- Set your availability schedule
- Add detailed descriptions to your subjects
- Respond promptly to booking requests

Log in to your dashboard to get started.

Best regards,
Zeal Catalyst Team
"""

        return await self.send_email(
            to_email=to_email,
            subject="Zeal Catalyst - Your Tutor Profile is Verified!",
            html_content=self._base_template(content),
            plain_content=plain_text
        )

    async def send_welcome_email(
        self,
        to_email: str,
        user_name: str,
        is_tutor: bool = False
    ) -> bool:
        """Send welcome email to new users."""
        role_specific = ""
        if is_tutor:
            role_specific = """
            <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
                As a tutor, you can:
            </p>
            <ul style="color: #4b5563; font-size: 14px; line-height: 1.8; margin: 0 0 24px; padding-left: 20px;">
                <li>Create your professional profile</li>
                <li>Set your subjects and hourly rates</li>
                <li>Manage your availability</li>
                <li>Receive and manage booking requests</li>
            </ul>
            """
        else:
            role_specific = """
            <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
                As a student, you can:
            </p>
            <ul style="color: #4b5563; font-size: 14px; line-height: 1.8; margin: 0 0 24px; padding-left: 20px;">
                <li>Browse qualified tutors</li>
                <li>Book tutoring sessions</li>
                <li>Join video sessions with Google Meet</li>
                <li>Leave reviews for your tutors</li>
            </ul>
            """

        content = f"""
            <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">Welcome to Zeal Catalyst!</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Hi {user_name},
            </p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Thank you for joining Zeal Catalyst! We're excited to have you on board.
            </p>
            {role_specific}
            <div style="text-align: center;">
                <a href="{settings.FRONTEND_URL}/{'tutor' if is_tutor else 'student'}/dashboard"
                   style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Get Started
                </a>
            </div>
        """

        plain_text = f"""
Hi {user_name},

Welcome to Zeal Catalyst! Thank you for joining us. We're excited to have you on board.

Log in to your dashboard to get started.

Best regards,
Zeal Catalyst Team
"""

        return await self.send_email(
            to_email=to_email,
            subject="Welcome to Zeal Catalyst!",
            html_content=self._base_template(content),
            plain_content=plain_text
        )


# Singleton instance
email_service = EmailService()
