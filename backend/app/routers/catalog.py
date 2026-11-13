from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.db import get_db
from app.models import Badge

router = APIRouter(tags=["catalog"])


@router.get("/badges", response_model=List[schemas.BadgeOut])
def badges(db: Session = Depends(get_db)):
    """Public: the Track Badges on offer (used on signup and in filters)."""
    return db.scalars(select(Badge).order_by(Badge.name)).unique().all()
