from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.models.user import User, UserRole
from app.models.tutor import TutorProfile
from app.models.message import Conversation, Message
from app.routes.auth import get_current_user
from app.services.notification_service import notification_service
from app.models.notification import NotificationType

router = APIRouter(prefix="/messages", tags=["Messages"])


def _role_value(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


class StartConversationRequest(BaseModel):
    tutor_user_id: str


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class ConversationResponse(BaseModel):
    id: str
    student_id: str
    tutor_id: str
    student_name: str
    tutor_name: str
    last_message_at: Optional[datetime] = None
    last_message_preview: Optional[str] = None
    created_at: datetime


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_role: str
    sender_name: str
    content: str
    created_at: datetime


async def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if _role_value(current_user) != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def _conversation_to_response(conv: Conversation) -> ConversationResponse:
    student = await User.get(conv.student_id)
    tutor = await User.get(conv.tutor_id)
    return ConversationResponse(
        id=str(conv.id),
        student_id=conv.student_id,
        tutor_id=conv.tutor_id,
        student_name=student.full_name if student else "Student",
        tutor_name=tutor.full_name if tutor else "Tutor",
        last_message_at=conv.last_message_at,
        last_message_preview=conv.last_message_preview,
        created_at=conv.created_at,
    )


async def _message_to_response(msg: Message) -> MessageResponse:
    sender = await User.get(msg.sender_id)
    return MessageResponse(
        id=str(msg.id),
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        sender_role=msg.sender_role,
        sender_name=sender.full_name if sender else "User",
        content=msg.content,
        created_at=msg.created_at,
    )


async def _can_access_conversation(current_user: User, conversation: Conversation) -> bool:
    role = _role_value(current_user)
    if role == "admin":
        return True
    user_id = str(current_user.id)
    return conversation.student_id == user_id or conversation.tutor_id == user_id


@router.post("/conversations/start", response_model=ConversationResponse)
async def start_conversation(
    payload: StartConversationRequest,
    current_user: User = Depends(get_current_user),
):
    role = _role_value(current_user)
    if role != "student":
        raise HTTPException(status_code=403, detail="Only students can start a conversation")

    tutor_user = await User.get(payload.tutor_user_id)
    if not tutor_user or _role_value(tutor_user) != "tutor":
        raise HTTPException(status_code=404, detail="Tutor not found")

    tutor_profile = await TutorProfile.find_one(TutorProfile.user_id == str(tutor_user.id))
    if not tutor_profile:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    conversation = await Conversation.find_one(
        Conversation.student_id == str(current_user.id),
        Conversation.tutor_id == str(tutor_user.id),
    )
    if not conversation:
        conversation = Conversation(
            student_id=str(current_user.id),
            tutor_id=str(tutor_user.id),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        await conversation.insert()

    return await _conversation_to_response(conversation)


@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    current_user: User = Depends(get_current_user),
):
    role = _role_value(current_user)
    user_id = str(current_user.id)
    if role == "student":
        conversations = await Conversation.find(Conversation.student_id == user_id).sort("-last_message_at").to_list()
    elif role == "tutor":
        conversations = await Conversation.find(Conversation.tutor_id == user_id).sort("-last_message_at").to_list()
    elif role == "admin":
        conversations = await Conversation.find_all().sort("-last_message_at").limit(200).to_list()
    else:
        conversations = []
    return [await _conversation_to_response(c) for c in conversations]


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_conversation_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
):
    conversation = await Conversation.get(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if not await _can_access_conversation(current_user, conversation):
        raise HTTPException(status_code=403, detail="Not authorized")

    messages = await Message.find(Message.conversation_id == conversation_id).sort("+created_at").to_list()
    return [await _message_to_response(m) for m in messages]


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: str,
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user),
):
    conversation = await Conversation.get(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if not await _can_access_conversation(current_user, conversation):
        raise HTTPException(status_code=403, detail="Not authorized")

    role = _role_value(current_user)
    if role not in {"student", "tutor"}:
        raise HTTPException(status_code=403, detail="Only tutor/student can send messages")

    cleaned = payload.content.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    msg = Message(
        conversation_id=conversation_id,
        sender_id=str(current_user.id),
        sender_role=role,
        content=cleaned,
        created_at=datetime.utcnow(),
    )
    await msg.insert()

    conversation.last_message_at = msg.created_at
    conversation.last_message_preview = cleaned[:120]
    conversation.updated_at = datetime.utcnow()
    await conversation.save()

    recipient_user_id = conversation.tutor_id if role == "student" else conversation.student_id
    try:
        await notification_service.create_notification(
            user_id=recipient_user_id,
            notification_type=NotificationType.SYSTEM,
            title="New Message",
            message=f"{current_user.full_name}: {cleaned[:80]}",
            link=f"/{'tutor' if role == 'student' else 'student'}/dashboard?tab=messages",
            related_id=str(conversation.id),
            actor_id=str(current_user.id),
            actor_name=current_user.full_name,
        )
    except Exception:
        # Don't fail message send if notification fails.
        pass

    return await _message_to_response(msg)


@router.get("/admin/conversations", response_model=List[ConversationResponse])
async def admin_list_conversations(
    search: Optional[str] = Query(default=None),
    admin: User = Depends(_require_admin),
):
    conversations = await Conversation.find_all().sort("-last_message_at").limit(500).to_list()
    rows = [await _conversation_to_response(c) for c in conversations]
    if not search:
        return rows
    s = search.lower().strip()
    return [r for r in rows if s in r.student_name.lower() or s in r.tutor_name.lower()]


@router.get("/admin/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def admin_get_conversation_messages(
    conversation_id: str,
    admin: User = Depends(_require_admin),
):
    conversation = await Conversation.get(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = await Message.find(Message.conversation_id == conversation_id).sort("+created_at").to_list()
    return [await _message_to_response(m) for m in messages]
