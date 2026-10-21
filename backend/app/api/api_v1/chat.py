import re
from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.models.user import User
from app.models.chat import Chat, Message
from app.models.knowledge import Document, KnowledgeBase
from app.schemas.chat import (
    ChatCreate,
    ChatResponse,
    ChatUpdate,
    MessageCreate,
    MessageResponse
)
from app.core.security import get_current_user
from app.services.chat_service import generate_response

router = APIRouter()


def _auto_chat_title(text: str) -> str:
    """Create a compact title from the first user request."""
    clean = re.sub(r"\s+", " ", (text or "")).strip()
    if not clean:
        return "Новый чат"
    return clean[:69].rstrip() + "..." if len(clean) > 72 else clean


def _serialize_chat(chat: Chat) -> ChatResponse:
    return ChatResponse(
        id=chat.id,
        title=chat.title,
        user_id=chat.user_id,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
        messages=[
            MessageResponse(
                id=message.id,
                chat_id=message.chat_id,
                content=message.content,
                role=message.role,
                created_at=message.created_at,
                updated_at=message.updated_at,
            )
            for message in chat.messages
        ],
        knowledge_base_ids=[kb.id for kb in chat.knowledge_bases],
    )


@router.post("", response_model=ChatResponse, include_in_schema=False)
@router.post("/", response_model=ChatResponse)
def create_chat(
    *,
    db: Session = Depends(get_db),
    chat_in: ChatCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    requested_ids = list(dict.fromkeys(chat_in.knowledge_base_ids or []))

    if requested_ids:
        # Verify selected knowledge bases exist and belong to user.
        knowledge_bases = (
            db.query(KnowledgeBase)
            .filter(
                KnowledgeBase.id.in_(requested_ids),
                KnowledgeBase.user_id == current_user.id
            )
            .all()
        )
        if len(knowledge_bases) != len(requested_ids):
            raise HTTPException(
                status_code=400,
                detail="One or more knowledge bases not found"
            )
    else:
        # Default behavior: a new chat sees every user knowledge base that has documents.
        knowledge_bases = (
            db.query(KnowledgeBase)
            .join(Document)
            .filter(KnowledgeBase.user_id == current_user.id)
            .distinct()
            .all()
        )
    
    chat = Chat(
        title=(chat_in.title or "").strip() or "Новый чат",
        user_id=current_user.id,
    )
    chat.knowledge_bases = knowledge_bases
    
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return _serialize_chat(chat)

@router.get("", response_model=List[ChatResponse], include_in_schema=False)
@router.get("/", response_model=List[ChatResponse])
def get_chats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
) -> Any:
    chats = (
        db.query(Chat)
        .options(joinedload(Chat.knowledge_bases), joinedload(Chat.messages))
        .filter(Chat.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_serialize_chat(chat) for chat in chats]

@router.get("/{chat_id}", response_model=ChatResponse)
def get_chat(
    *,
    db: Session = Depends(get_db),
    chat_id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    chat = (
        db.query(Chat)
        .options(joinedload(Chat.knowledge_bases), joinedload(Chat.messages))
        .filter(
            Chat.id == chat_id,
            Chat.user_id == current_user.id
        )
        .first()
    )
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return _serialize_chat(chat)

@router.post("/{chat_id}/messages")
async def create_message(
    *,
    db: Session = Depends(get_db),
    chat_id: int,
    messages: dict,
    current_user: User = Depends(get_current_user)
) -> StreamingResponse:
    chat = (
        db.query(Chat)
        .options(joinedload(Chat.knowledge_bases))
        .filter(
            Chat.id == chat_id,
            Chat.user_id == current_user.id
        )
        .first()
    )
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Get the last user message
    last_message = messages["messages"][-1]
    if last_message["role"] != "user":
        raise HTTPException(status_code=400, detail="Last message must be from user")

    existing_messages_count = (
        db.query(Message)
        .filter(Message.chat_id == chat_id)
        .count()
    )

    if existing_messages_count == 0:
        chat.title = _auto_chat_title(last_message["content"])
        db.commit()
        db.refresh(chat)
    
    # Get knowledge base IDs
    knowledge_base_ids = [kb.id for kb in chat.knowledge_bases]
    strict_sources = bool(messages.get("strict_sources", False))
    document_wizard = bool(messages.get("document_wizard", False))
    document_template = messages.get("document_template")

    async def response_stream():
        async for chunk in generate_response(
            query=last_message["content"],
            messages=messages,
            knowledge_base_ids=knowledge_base_ids,
            chat_id=chat_id,
            db=db,
            current_user_id=current_user.id,
            strict_sources=strict_sources,
            document_wizard=document_wizard,
            document_template=document_template,
        ):
            yield chunk

    return StreamingResponse(
        response_stream(),
        media_type="text/event-stream",
        headers={
            "x-vercel-ai-data-stream": "v1"
        }
    )

@router.delete("/{chat_id}")
def delete_chat(
    *,
    db: Session = Depends(get_db),
    chat_id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    chat = (
        db.query(Chat)
        .filter(
            Chat.id == chat_id,
            Chat.user_id == current_user.id
        )
        .first()
    )
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    db.delete(chat)
    db.commit()
    return {"status": "success"}
