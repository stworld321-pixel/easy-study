"""
WebSocket Connection Manager for real-time notifications
"""

from fastapi import WebSocket
from typing import Dict, List, Optional
import json
import asyncio
from datetime import datetime


class ConnectionManager:
    """
    Manages WebSocket connections for real-time notifications.
    Maps user_id to their active WebSocket connections (supports multiple tabs/devices).
    """

    def __init__(self):
        # user_id -> list of WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        """Accept a new WebSocket connection for a user."""
        await websocket.accept()
        async with self._lock:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = []
            self.active_connections[user_id].append(websocket)
        print(f"[WS] User {user_id} connected. Total connections: {len(self.active_connections[user_id])}")

    async def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        """Remove a WebSocket connection for a user."""
        async with self._lock:
            if user_id in self.active_connections:
                if websocket in self.active_connections[user_id]:
                    self.active_connections[user_id].remove(websocket)
                # Clean up empty lists
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
        print(f"[WS] User {user_id} disconnected.")

    async def send_personal_message(self, message: dict, user_id: str) -> None:
        """Send a message to all connections of a specific user."""
        if user_id in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"[WS] Error sending to user {user_id}: {e}")
                    dead_connections.append(connection)

            # Clean up dead connections
            for dead in dead_connections:
                await self.disconnect(dead, user_id)

    async def send_to_users(self, message: dict, user_ids: List[str]) -> None:
        """Send a message to multiple users."""
        for user_id in user_ids:
            await self.send_personal_message(message, user_id)

    async def broadcast(self, message: dict) -> None:
        """Broadcast a message to all connected users."""
        for user_id in list(self.active_connections.keys()):
            await self.send_personal_message(message, user_id)

    def is_user_online(self, user_id: str) -> bool:
        """Check if a user has any active connections."""
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0

    def get_online_users_count(self) -> int:
        """Get the count of online users."""
        return len(self.active_connections)

    def get_user_connections_count(self, user_id: str) -> int:
        """Get the number of active connections for a user."""
        return len(self.active_connections.get(user_id, []))


# Singleton instance
manager = ConnectionManager()


class NotificationPayload:
    """Helper class to create notification payloads for WebSocket messages."""

    @staticmethod
    def new_notification(notification: dict) -> dict:
        """Create payload for a new notification."""
        return {
            "type": "NEW_NOTIFICATION",
            "data": notification,
            "timestamp": datetime.utcnow().isoformat()
        }

    @staticmethod
    def notification_read(notification_id: str) -> dict:
        """Create payload when a notification is marked as read."""
        return {
            "type": "NOTIFICATION_READ",
            "data": {"notification_id": notification_id},
            "timestamp": datetime.utcnow().isoformat()
        }

    @staticmethod
    def all_notifications_read() -> dict:
        """Create payload when all notifications are marked as read."""
        return {
            "type": "ALL_NOTIFICATIONS_READ",
            "data": {},
            "timestamp": datetime.utcnow().isoformat()
        }

    @staticmethod
    def unread_count(count: int) -> dict:
        """Create payload for unread count update."""
        return {
            "type": "UNREAD_COUNT",
            "data": {"count": count},
            "timestamp": datetime.utcnow().isoformat()
        }

    @staticmethod
    def connection_established(user_id: str) -> dict:
        """Create payload for successful connection."""
        return {
            "type": "CONNECTED",
            "data": {"user_id": user_id, "message": "WebSocket connection established"},
            "timestamp": datetime.utcnow().isoformat()
        }

    @staticmethod
    def error(message: str) -> dict:
        """Create error payload."""
        return {
            "type": "ERROR",
            "data": {"message": message},
            "timestamp": datetime.utcnow().isoformat()
        }
