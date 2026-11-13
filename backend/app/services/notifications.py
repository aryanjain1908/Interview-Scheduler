import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Notification, Role, User
from app.services.messages import Message


def notify(db: Session, user_id: uuid.UUID, message: Message, at: datetime) -> Notification:
    notification = Notification(
        user_id=user_id,
        kind=message.kind,
        title=message.title,
        body=message.body,
        tone=message.tone,
        created_at=at,
    )
    db.add(notification)
    return notification


def notify_team_leads(db: Session, message: Message, at: datetime) -> None:
    """Things the interview team has to follow up on (missed interviews, disputes)."""
    for admin_id in db.scalars(select(User.id).where(User.role == Role.ADMIN)):
        notify(db, admin_id, message, at)
