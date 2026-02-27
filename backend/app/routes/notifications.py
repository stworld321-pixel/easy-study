"""
Notification Routes - REST API and WebSocket endpoints for notifications
"""

from fastapi import APIRouter, HTTPException, Depends, Query, WebSocket, WebSocketDisconnect
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from jose import jwt, JWTError

from app.models.user import User
from app.models.notification import Notification, NotificationType
from app.routes.auth import get_current_user
from app.services.websocket_manager import manager, NotificationPayload
from app.services.notification_service import notification_service
from app.core.config import settings

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# --- Schemas ---
class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    link: Optional[str] = None
    related_id: Optional[str] = None
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    actor_avatar: Optional[str] = None
    is_read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    total: int
    unread_count: int


class UnreadCountResponse(BaseModel):
    count: int


# --- Helper Functions ---
def notification_to_response(n: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=str(n.id),
        type=n.type.value,
        title=n.title,
        message=n.message,
        link=n.link,
        related_id=n.related_id,
        actor_id=n.actor_id,
        actor_name=n.actor_name,
        actor_avatar=n.actor_avatar,
        is_read=n.is_read,
        created_at=n.created_at
    )


async def get_user_from_token(token: str) -> Optional[User]:
    """Validate JWT token and return user for WebSocket authentication."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_email: str = payload.get("sub")
        if user_email is None:
            return None
        user = await User.find_one({"email": user_email})
        return user
    except JWTError:
        return None


# --- REST API Endpoints ---
@router.get("", response_model=NotificationListResponse)
async def get_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = False,
    current_user: User = Depends(get_current_user)
):
    """Get user's notifications with pagination."""
    user_id = str(current_user.id)

    # Build query
    query = Notification.find(Notification.user_id == user_id)
    if unread_only:
        query = query.find(Notification.is_read == False)

    # Get total count
    total = await query.count()

    # Get notifications sorted by created_at desc
    notifications = await query.sort(-Notification.created_at).skip(skip).limit(limit).to_list()

    # Get unread count
    unread_count = await Notification.find(
        Notification.user_id == user_id,
        Notification.is_read == False
    ).count()

    return NotificationListResponse(
        notifications=[notification_to_response(n) for n in notifications],
        total=total,
        unread_count=unread_count
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(current_user: User = Depends(get_current_user)):
    """Get the count of unread notifications."""
    count = await notification_service.get_unread_count(str(current_user.id))
    return UnreadCountResponse(count=count)


@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    """Mark a notification as read."""
    notification = await Notification.get(notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if notification.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        await notification.save()

        # Send updated unread count via WebSocket
        await notification_service.send_unread_count(str(current_user.id))

    return {"message": "Notification marked as read"}


@router.put("/mark-all-read")
async def mark_all_as_read(current_user: User = Depends(get_current_user)):
    """Mark all notifications as read."""
    user_id = str(current_user.id)

    # Update all unread notifications
    await Notification.find(
        Notification.user_id == user_id,
        Notification.is_read == False
    ).update({"$set": {"is_read": True, "read_at": datetime.utcnow()}})

    # Send WebSocket update
    payload = NotificationPayload.all_notifications_read()
    await manager.send_personal_message(payload, user_id)

    return {"message": "All notifications marked as read"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a notification."""
    notification = await Notification.get(notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if notification.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    await notification.delete()

    # Send updated unread count via WebSocket
    await notification_service.send_unread_count(str(current_user.id))

    return {"message": "Notification deleted"}


@router.delete("")
async def delete_all_notifications(
    read_only: bool = Query(False, description="If true, only delete read notifications"),
    current_user: User = Depends(get_current_user)
):
    """Delete all notifications or only read ones."""
    user_id = str(current_user.id)

    query = Notification.find(Notification.user_id == user_id)
    if read_only:
        query = query.find(Notification.is_read == True)

    await query.delete()

    return {"message": "Notifications deleted"}


# --- WebSocket Endpoint ---
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    WebSocket endpoint for real-time notifications.

    Connect with: ws://localhost:8000/api/notifications/ws?token=<jwt_token>

    Message types received:
    - NEW_NOTIFICATION: New notification created
    - NOTIFICATION_READ: A notification was marked as read
    - ALL_NOTIFICATIONS_READ: All notifications marked as read
    - UNREAD_COUNT: Updated unread count
    - CONNECTED: Connection established
    - ERROR: Error message
    """
    # Authenticate user
    user = await get_user_from_token(token)
    if not user:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    user_id = str(user.id)

    # Connect
    await manager.connect(websocket, user_id)

    try:
        # Send connection confirmation
        await websocket.send_json(NotificationPayload.connection_established(user_id))

        # Send current unread count
        await notification_service.send_unread_count(user_id)

        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for messages (ping/pong or client requests)
                data = await websocket.receive_json()

                # Handle client requests
                if data.get("type") == "PING":
                    await websocket.send_json({"type": "PONG", "timestamp": datetime.utcnow().isoformat()})

                elif data.get("type") == "GET_UNREAD_COUNT":
                    await notification_service.send_unread_count(user_id)

            except Exception:
                # Handle receive errors (usually means client closed connection)
                break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS] Error for user {user_id}: {e}")
    finally:
        await manager.disconnect(websocket, user_id)
