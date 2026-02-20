"""
Notification Service - Handles creating and sending notifications
"""

from typing import Optional, List
from datetime import datetime
from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.services.websocket_manager import manager, NotificationPayload
from app.services.email_service import email_service


class NotificationService:
    """Service for creating and managing notifications."""

    @staticmethod
    async def create_notification(
        user_id: str,
        notification_type: NotificationType,
        title: str,
        message: str,
        link: Optional[str] = None,
        related_id: Optional[str] = None,
        actor_id: Optional[str] = None,
        actor_name: Optional[str] = None,
        actor_avatar: Optional[str] = None,
        send_realtime: bool = True
    ) -> Notification:
        """
        Create a new notification and optionally send it via WebSocket.

        Args:
            user_id: The recipient's user ID
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            link: Optional URL to navigate to when clicked
            related_id: Optional related entity ID (booking_id, etc.)
            actor_id: Optional ID of the user who triggered the notification
            actor_name: Optional name of the actor
            actor_avatar: Optional avatar URL of the actor
            send_realtime: Whether to send via WebSocket immediately
        """
        notification = Notification(
            user_id=user_id,
            type=notification_type,
            title=title,
            message=message,
            link=link,
            related_id=related_id,
            actor_id=actor_id,
            actor_name=actor_name,
            actor_avatar=actor_avatar
        )

        await notification.insert()

        # Send via WebSocket if user is online
        if send_realtime:
            await NotificationService.send_notification_realtime(notification)

        return notification

    @staticmethod
    async def send_notification_realtime(notification: Notification) -> None:
        """Send a notification via WebSocket to the user."""
        notification_data = {
            "id": str(notification.id),
            "type": notification.type.value,
            "title": notification.title,
            "message": notification.message,
            "link": notification.link,
            "related_id": notification.related_id,
            "actor_id": notification.actor_id,
            "actor_name": notification.actor_name,
            "actor_avatar": notification.actor_avatar,
            "is_read": notification.is_read,
            "created_at": notification.created_at.isoformat()
        }

        payload = NotificationPayload.new_notification(notification_data)
        await manager.send_personal_message(payload, notification.user_id)

    @staticmethod
    async def get_unread_count(user_id: str) -> int:
        """Get the count of unread notifications for a user."""
        return await Notification.find(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).count()

    @staticmethod
    async def send_unread_count(user_id: str) -> None:
        """Send the current unread count to a user via WebSocket."""
        count = await NotificationService.get_unread_count(user_id)
        payload = NotificationPayload.unread_count(count)
        await manager.send_personal_message(payload, user_id)

    # ==================== Notification Creators ====================

    @staticmethod
    async def notify_new_booking(
        tutor_user_id: str,
        student_name: str,
        student_id: str,
        subject: str,
        booking_id: str,
        scheduled_at: datetime
    ) -> Notification:
        """Notify tutor of a new booking request."""
        formatted_time = scheduled_at.strftime("%B %d, %Y at %I:%M %p")
        notification = await NotificationService.create_notification(
            user_id=tutor_user_id,
            notification_type=NotificationType.BOOKING_NEW,
            title="New Booking Request",
            message=f"{student_name} wants to book a {subject} session on {formatted_time}",
            link="/tutor/dashboard?tab=calendar",
            related_id=booking_id,
            actor_id=student_id,
            actor_name=student_name
        )

        # Send email notification
        try:
            tutor = await User.get(tutor_user_id)
            if tutor:
                await email_service.send_booking_notification(
                    to_email=tutor.email,
                    recipient_name=tutor.full_name,
                    other_party_name=student_name,
                    subject_name=subject,
                    scheduled_at=scheduled_at,
                    is_new_booking=True,
                    is_for_tutor=True
                )
        except Exception as e:
            print(f"[Email] Failed to send new booking email: {e}")

        return notification

    @staticmethod
    async def notify_booking_confirmed(
        student_user_id: str,
        tutor_name: str,
        tutor_id: str,
        subject: str,
        booking_id: str,
        scheduled_at: datetime,
        meeting_link: Optional[str] = None
    ) -> Notification:
        """Notify student that their booking was confirmed."""
        formatted_time = scheduled_at.strftime("%B %d, %Y at %I:%M %p")
        notification = await NotificationService.create_notification(
            user_id=student_user_id,
            notification_type=NotificationType.BOOKING_CONFIRMED,
            title="Booking Confirmed",
            message=f"Your {subject} session with {tutor_name} on {formatted_time} has been confirmed!",
            link="/student/dashboard?tab=sessions",
            related_id=booking_id,
            actor_id=tutor_id,
            actor_name=tutor_name
        )

        # Send email notification
        try:
            student = await User.get(student_user_id)
            if student:
                await email_service.send_booking_confirmed_email(
                    to_email=student.email,
                    student_name=student.full_name,
                    tutor_name=tutor_name,
                    subject_name=subject,
                    scheduled_at=scheduled_at,
                    meeting_link=meeting_link
                )
        except Exception as e:
            print(f"[Email] Failed to send booking confirmed email: {e}")

        return notification

    @staticmethod
    async def notify_booking_cancelled(
        user_id: str,
        cancelled_by_name: str,
        cancelled_by_id: str,
        subject: str,
        booking_id: str,
        scheduled_at: datetime,
        is_student: bool = True
    ) -> Notification:
        """Notify user that a booking was cancelled."""
        formatted_time = scheduled_at.strftime("%B %d, %Y at %I:%M %p")
        link = "/student/dashboard?tab=sessions" if is_student else "/tutor/dashboard?tab=calendar"
        notification = await NotificationService.create_notification(
            user_id=user_id,
            notification_type=NotificationType.BOOKING_CANCELLED,
            title="Booking Cancelled",
            message=f"The {subject} session on {formatted_time} has been cancelled by {cancelled_by_name}",
            link=link,
            related_id=booking_id,
            actor_id=cancelled_by_id,
            actor_name=cancelled_by_name
        )

        # Send email notification
        try:
            user = await User.get(user_id)
            if user:
                await email_service.send_booking_cancelled_email(
                    to_email=user.email,
                    recipient_name=user.full_name,
                    cancelled_by=cancelled_by_name,
                    subject_name=subject,
                    scheduled_at=scheduled_at
                )
        except Exception as e:
            print(f"[Email] Failed to send booking cancelled email: {e}")

        return notification

    @staticmethod
    async def notify_booking_reminder(
        user_id: str,
        subject: str,
        booking_id: str,
        scheduled_at: datetime,
        other_party_name: str,
        is_student: bool = True
    ) -> Notification:
        """Send a reminder notification for an upcoming session."""
        formatted_time = scheduled_at.strftime("%I:%M %p")
        role = "tutor" if is_student else "student"
        link = "/student/dashboard?tab=sessions" if is_student else "/tutor/dashboard?tab=calendar"
        return await NotificationService.create_notification(
            user_id=user_id,
            notification_type=NotificationType.BOOKING_REMINDER,
            title="Session Reminder",
            message=f"Your {subject} session with {role} {other_party_name} starts at {formatted_time}",
            link=link,
            related_id=booking_id
        )

    @staticmethod
    async def notify_tutor_verified(
        tutor_user_id: str
    ) -> Notification:
        """Notify tutor that their profile has been verified."""
        notification = await NotificationService.create_notification(
            user_id=tutor_user_id,
            notification_type=NotificationType.TUTOR_VERIFIED,
            title="Profile Verified",
            message="Congratulations! Your tutor profile has been verified. You can now receive bookings.",
            link="/tutor/dashboard"
        )

        # Send email notification
        try:
            tutor = await User.get(tutor_user_id)
            if tutor:
                await email_service.send_tutor_verified_email(
                    to_email=tutor.email,
                    tutor_name=tutor.full_name
                )
        except Exception as e:
            print(f"[Email] Failed to send tutor verified email: {e}")

        return notification

    @staticmethod
    async def notify_tutor_suspended(
        tutor_user_id: str,
        reason: Optional[str] = None
    ) -> Notification:
        """Notify tutor that their profile has been suspended."""
        message = "Your tutor profile has been suspended."
        if reason:
            message += f" Reason: {reason}"
        return await NotificationService.create_notification(
            user_id=tutor_user_id,
            notification_type=NotificationType.TUTOR_SUSPENDED,
            title="Profile Suspended",
            message=message,
            link="/tutor/dashboard"
        )

    @staticmethod
    async def notify_review_received(
        tutor_user_id: str,
        student_name: str,
        student_id: str,
        rating: int,
        booking_id: Optional[str] = None
    ) -> Notification:
        """Notify tutor of a new review."""
        stars = "⭐" * rating
        return await NotificationService.create_notification(
            user_id=tutor_user_id,
            notification_type=NotificationType.REVIEW_RECEIVED,
            title="New Review Received",
            message=f"{student_name} left you a {rating}-star review {stars}",
            link="/tutor/dashboard?tab=feedback",
            related_id=booking_id,
            actor_id=student_id,
            actor_name=student_name
        )

    @staticmethod
    async def notify_system(
        user_id: str,
        title: str,
        message: str,
        link: Optional[str] = None
    ) -> Notification:
        """Send a system notification to a user."""
        return await NotificationService.create_notification(
            user_id=user_id,
            notification_type=NotificationType.SYSTEM,
            title=title,
            message=message,
            link=link
        )

    @staticmethod
    async def broadcast_system_notification(
        user_ids: List[str],
        title: str,
        message: str,
        link: Optional[str] = None
    ) -> List[Notification]:
        """Send a system notification to multiple users."""
        notifications = []
        for user_id in user_ids:
            notification = await NotificationService.notify_system(
                user_id=user_id,
                title=title,
                message=message,
                link=link
            )
            notifications.append(notification)
        return notifications


# Singleton instance
notification_service = NotificationService()
