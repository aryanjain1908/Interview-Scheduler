import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import timestamp, uuid_pk


class Notification(Base):
    """In-app inbox. Every student-facing message in the flow lands here."""

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    tone: Mapped[str] = mapped_column(String(20), default="info")
    read_at: Mapped[Optional[datetime]] = timestamp(nullable=True, default=None)
    created_at: Mapped[datetime] = timestamp()
