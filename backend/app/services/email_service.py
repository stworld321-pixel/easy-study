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
        if settings.MAIL_USE_SSL is None:
            # Auto-detect: 465 -> SSL, common submission ports -> STARTTLS
            self.use_ssl = self.port == 465
        else:
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

            candidates = []
            context = ssl.create_default_context()
            if self.use_ssl:
                candidates.append(("ssl", self.host, self.port))
                if self.port == 465:
                    candidates.append(("starttls", self.host, 587))
            else:
                candidates.append(("starttls", self.host, self.port))
                if self.port != 587:
                    candidates.append(("starttls", self.host, 587))

            last_error: Exception | None = None
            for mode, host, port in candidates:
                try:
                    if mode == "ssl":
                        with smtplib.SMTP_SSL(host, port, timeout=15, context=context) as server:
                            server.ehlo()
                            server.login(self.username, self.password)
                            server.sendmail(self.from_address, to_email, message.as_string())
                    else:
                        with smtplib.SMTP(host, port, timeout=15) as server:
                            server.ehlo()
                            # Mailtrap/local sandboxes often work with STARTTLS, but if not,
                            # login/sendmail may still succeed on plain SMTP for testing.
                            if server.has_extn("starttls"):
                                try:
                                    server.starttls(context=context)
                                    server.ehlo()
                                except smtplib.SMTPException:
                                    pass
                            server.login(self.username, self.password)
                            server.sendmail(self.from_address, to_email, message.as_string())
                    print(f"[Email] Sent to {to_email}: {subject} via {mode.upper()}:{port}")
                    return True
                except Exception as transport_error:
                    last_error = transport_error
                    print(f"[Email] Transport attempt failed ({mode.upper()}:{port}) for {to_email}: {transport_error}")

            if last_error:
                raise last_error
            return False
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
                <li>Join secure live sessions inside Zeal Catalyst</li>
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

    async def send_payment_invoice_email(
        self,
        to_email: str,
        student_name: str,
        booking_id: str,
        payment_id: str,
        subject_name: str,
        tutor_name: str,
        scheduled_at: datetime,
        currency: str,
        session_amount: float,
        platform_fee: float,
        total_paid: float,
        razorpay_payment_id: Optional[str] = None,
    ) -> bool:
        """Send paid invoice email to student after successful payment verification."""
        formatted_date = scheduled_at.strftime("%B %d, %Y")
        formatted_time = scheduled_at.strftime("%I:%M %p")
        issued_at = datetime.utcnow().strftime("%B %d, %Y %I:%M %p UTC")

        content = f"""
            <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">Payment Invoice</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Hi {student_name},
            </p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Your payment was received successfully. Please find your invoice details below.
            </p>

            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 0 0 20px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 6px 0;">Invoice No:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">INV-{payment_id}</td>
                    </tr>
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 6px 0;">Booking ID:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{booking_id}</td>
                    </tr>
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 6px 0;">Issued On:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{issued_at}</td>
                    </tr>
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 6px 0;">Razorpay Payment ID:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{razorpay_payment_id or "-"}</td>
                    </tr>
                </table>
            </div>

            <div style="background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 6px 0;">Session:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{subject_name}</td>
                    </tr>
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 6px 0;">Tutor:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{tutor_name}</td>
                    </tr>
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 6px 0;">Date:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{formatted_date}</td>
                    </tr>
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 6px 0;">Time:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{formatted_time}</td>
                    </tr>
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 6px 0;">Session Amount:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{currency} {session_amount:.2f}</td>
                    </tr>
                    <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 6px 0;">Platform Fee:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{currency} {platform_fee:.2f}</td>
                    </tr>
                    <tr>
                        <td style="color: #111827; font-size: 15px; font-weight: 700; padding: 8px 0; border-top: 1px solid #10b981;">Total Paid:</td>
                        <td style="color: #111827; font-size: 15px; font-weight: 700; text-align: right; padding: 8px 0; border-top: 1px solid #10b981;">{currency} {total_paid:.2f}</td>
                    </tr>
                </table>
            </div>

            <div style="text-align: center;">
                <a href="{settings.FRONTEND_URL}/student/dashboard"
                   style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    View Booking
                </a>
            </div>
        """

        plain_text = f"""
Hi {student_name},

Your payment was received successfully.

Invoice No: INV-{payment_id}
Booking ID: {booking_id}
Razorpay Payment ID: {razorpay_payment_id or "-"}
Issued On: {issued_at}

Session: {subject_name}
Tutor: {tutor_name}
Date: {formatted_date}
Time: {formatted_time}

Session Amount: {currency} {session_amount:.2f}
Platform Fee: {currency} {platform_fee:.2f}
Total Paid: {currency} {total_paid:.2f}

Best regards,
Zeal Catalyst Team
"""

        return await self.send_email(
            to_email=to_email,
            subject=f"Zeal Catalyst - Payment Invoice (Booking {booking_id})",
            html_content=self._base_template(content),
            plain_content=plain_text
        )

    async def send_payment_invoice_email_with_retry(
        self,
        max_attempts: int = 3,
        retry_delay_seconds: float = 1.5,
        **kwargs
    ) -> bool:
        """Retry wrapper for invoice email delivery."""
        for attempt in range(1, max_attempts + 1):
            sent = await self.send_payment_invoice_email(**kwargs)
            if sent:
                return True
            if attempt < max_attempts:
                await asyncio.sleep(retry_delay_seconds)
        return False

    async def send_tutor_session_confirmation_email(
        self,
        to_email: str,
        tutor_name: str,
        student_name: str,
        subject_name: str,
        scheduled_at: datetime,
        meeting_link: Optional[str] = None,
    ) -> bool:
        """Send confirmation summary mail to tutor once session is confirmed."""
        formatted_date = scheduled_at.strftime("%B %d, %Y")
        formatted_time = scheduled_at.strftime("%I:%M %p")
        meeting_text = f"Meeting: {meeting_link}\n" if meeting_link else ""
        meeting_line = (
            f"<tr><td style='color:#6b7280; font-size:14px; padding:4px 0;'>Meeting Link:</td>"
            f"<td style='color:#111827; font-size:14px; font-weight:600; text-align:right;'>"
            f"<a href='{meeting_link}' style='color:#2563eb;'>Open Session</a></td></tr>"
            if meeting_link else ""
        )
        content = f"""
            <h2 style="color:#1f2937; margin:0 0 20px; font-size:24px;">Session Confirmed</h2>
            <p style="color:#4b5563; font-size:16px;">Hi {tutor_name},</p>
            <p style="color:#4b5563; font-size:16px;">You have confirmed a session booking. Here are the details:</p>
            <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:20px; margin:20px 0;">
                <table style="width:100%;">
                    <tr><td style="color:#6b7280; font-size:14px; padding:4px 0;">Student:</td><td style="color:#111827; font-size:14px; font-weight:600; text-align:right;">{student_name}</td></tr>
                    <tr><td style="color:#6b7280; font-size:14px; padding:4px 0;">Subject:</td><td style="color:#111827; font-size:14px; font-weight:600; text-align:right;">{subject_name}</td></tr>
                    <tr><td style="color:#6b7280; font-size:14px; padding:4px 0;">Date:</td><td style="color:#111827; font-size:14px; font-weight:600; text-align:right;">{formatted_date}</td></tr>
                    <tr><td style="color:#6b7280; font-size:14px; padding:4px 0;">Time:</td><td style="color:#111827; font-size:14px; font-weight:600; text-align:right;">{formatted_time}</td></tr>
                    {meeting_line}
                </table>
            </div>
            <div style="text-align:center;">
                <a href="{settings.FRONTEND_URL}/tutor/dashboard?tab=bookings"
                   style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding:12px 20px; border-radius:8px;">
                   Open Dashboard
                </a>
            </div>
        """
        plain_text = (
            f"Hi {tutor_name},\n\n"
            f"You confirmed a session with {student_name}.\n"
            f"Subject: {subject_name}\nDate: {formatted_date}\nTime: {formatted_time}\n"
            f"{meeting_text}"
            "Open your tutor dashboard for details."
        )
        return await self.send_email(
            to_email=to_email,
            subject=f"Zeal Catalyst - Session Confirmed ({subject_name})",
            html_content=self._base_template(content),
            plain_content=plain_text,
        )

    async def send_refund_initiated_email(
        self,
        to_email: str,
        student_name: str,
        booking_id: str,
        subject_name: str,
        scheduled_at: datetime,
        currency: str,
        amount: float,
        eta_text: str = "2 to 4 business days",
    ) -> bool:
        """Send refund processing email for cancelled paid sessions."""
        formatted_date = scheduled_at.strftime("%B %d, %Y")
        formatted_time = scheduled_at.strftime("%I:%M %p")
        content = f"""
            <h2 style="color:#1f2937; margin:0 0 20px; font-size:24px;">Refund Initiated</h2>
            <p style="color:#4b5563; font-size:16px;">Hi {student_name},</p>
            <p style="color:#4b5563; font-size:16px;">
                Your paid session has been cancelled and refund processing has started.
            </p>
            <div style="background:#fef2f2; border:1px solid #fca5a5; border-radius:12px; padding:20px; margin:20px 0;">
                <table style="width:100%;">
                    <tr><td style="color:#6b7280; font-size:14px; padding:4px 0;">Booking ID:</td><td style="color:#111827; font-size:14px; font-weight:600; text-align:right;">{booking_id}</td></tr>
                    <tr><td style="color:#6b7280; font-size:14px; padding:4px 0;">Session:</td><td style="color:#111827; font-size:14px; font-weight:600; text-align:right;">{subject_name}</td></tr>
                    <tr><td style="color:#6b7280; font-size:14px; padding:4px 0;">Scheduled:</td><td style="color:#111827; font-size:14px; font-weight:600; text-align:right;">{formatted_date} {formatted_time}</td></tr>
                    <tr><td style="color:#6b7280; font-size:14px; padding:4px 0;">Refund Amount:</td><td style="color:#111827; font-size:14px; font-weight:700; text-align:right;">{currency} {amount:.2f}</td></tr>
                    <tr><td style="color:#6b7280; font-size:14px; padding:4px 0;">Expected Time:</td><td style="color:#111827; font-size:14px; font-weight:600; text-align:right;">{eta_text}</td></tr>
                </table>
            </div>
        """
        plain_text = (
            f"Hi {student_name},\n\nRefund initiated for booking {booking_id}.\n"
            f"Session: {subject_name}\nScheduled: {formatted_date} {formatted_time}\n"
            f"Refund Amount: {currency} {amount:.2f}\nExpected Time: {eta_text}\n"
        )
        return await self.send_email(
            to_email=to_email,
            subject=f"Zeal Catalyst - Refund Initiated (Booking {booking_id})",
            html_content=self._base_template(content),
            plain_content=plain_text,
        )

    async def send_withdrawal_request_received_email(
        self,
        to_email: str,
        tutor_name: str,
        amount: float,
        currency: str,
        payment_method: str,
    ) -> bool:
        content = f"""
            <h2 style="color:#1f2937; margin:0 0 20px; font-size:24px;">Withdrawal Request Received</h2>
            <p style="color:#4b5563; font-size:16px;">Hi {tutor_name},</p>
            <p style="color:#4b5563; font-size:16px;">Your payout request has been submitted successfully.</p>
            <p style="color:#4b5563; font-size:16px;"><strong>Amount:</strong> {currency} {amount:.2f}<br/><strong>Method:</strong> {payment_method}</p>
        """
        plain = f"Hi {tutor_name}, your withdrawal request for {currency} {amount:.2f} ({payment_method}) has been submitted."
        return await self.send_email(
            to_email=to_email,
            subject="Zeal Catalyst - Withdrawal Request Received",
            html_content=self._base_template(content),
            plain_content=plain,
        )

    async def send_withdrawal_status_email(
        self,
        to_email: str,
        tutor_name: str,
        amount: float,
        currency: str,
        status: str,
        admin_notes: Optional[str] = None,
        transaction_id: Optional[str] = None,
    ) -> bool:
        status_label = status.upper()
        notes = admin_notes or "No additional notes."
        tx_row = f"<p style='color:#4b5563; font-size:16px;'><strong>Transaction ID:</strong> {transaction_id}</p>" if transaction_id else ""
        content = f"""
            <h2 style="color:#1f2937; margin:0 0 20px; font-size:24px;">Withdrawal Status Updated</h2>
            <p style="color:#4b5563; font-size:16px;">Hi {tutor_name},</p>
            <p style="color:#4b5563; font-size:16px;">Your withdrawal request status is now <strong>{status_label}</strong>.</p>
            <p style="color:#4b5563; font-size:16px;"><strong>Amount:</strong> {currency} {amount:.2f}</p>
            {tx_row}
            <p style="color:#4b5563; font-size:16px;"><strong>Admin Notes:</strong> {notes}</p>
        """
        plain = (
            f"Hi {tutor_name}, withdrawal status: {status_label}. Amount: {currency} {amount:.2f}. "
            f"{f'Transaction ID: {transaction_id}. ' if transaction_id else ''}Notes: {notes}"
        )
        return await self.send_email(
            to_email=to_email,
            subject=f"Zeal Catalyst - Withdrawal {status_label}",
            html_content=self._base_template(content),
            plain_content=plain,
        )

    async def send_password_setup_email(
        self,
        to_email: str,
        user_name: str,
        setup_link: str,
        expires_minutes: int = 30,
    ) -> bool:
        content = f"""
            <h2 style="color:#1f2937; margin:0 0 20px; font-size:24px;">Set Your Password</h2>
            <p style="color:#4b5563; font-size:16px;">Hi {user_name},</p>
            <p style="color:#4b5563; font-size:16px;">
                Use the button below to set a password for email/password login.
                This link expires in {expires_minutes} minutes.
            </p>
            <div style="text-align:center; margin:24px 0;">
                <a href="{setup_link}"
                   style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding:12px 20px; border-radius:8px; font-weight:600;">
                   Set Password
                </a>
            </div>
            <p style="color:#6b7280; font-size:13px;">
                If you did not request this, you can ignore this email.
            </p>
        """
        plain = (
            f"Hi {user_name},\n\n"
            f"Set your password using this link (expires in {expires_minutes} minutes):\n{setup_link}\n\n"
            "If you did not request this, ignore this email."
        )
        return await self.send_email(
            to_email=to_email,
            subject="Zeal Catalyst - Set Your Password",
            html_content=self._base_template(content),
            plain_content=plain,
        )


# Singleton instance
email_service = EmailService()
