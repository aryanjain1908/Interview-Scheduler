import uuid

from sqlalchemy import DateTime, Uuid
from sqlalchemy.orm import mapped_column

from app.core.clock import utcnow


def uuid_pk():
    return mapped_column(Uuid, primary_key=True, default=uuid.uuid4)


def timestamp(nullable: bool = False, default=utcnow):
    return mapped_column(DateTime(timezone=True), nullable=nullable, default=default)
