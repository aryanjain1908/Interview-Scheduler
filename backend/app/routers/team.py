"""Shared by interviewers and team leads: who is eligible, who has booked, reminders."""

import uuid
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import schemas
from app.core.clock import utcnow
from app.db import get_db
from app.deps import team_only
from app.models import User
from app.services import admin

router = APIRouter(prefix="/team", tags=["interview team"])


@router.get("/eligible-students", response_model=List[schemas.EligibleRowOut])
def eligible_students(
    booked: Literal["all", "booked", "not_booked"] = "all",
    badge_id: Optional[uuid.UUID] = None,
    search: str = "",
    _: User = Depends(team_only),
    db: Session = Depends(get_db),
):
    flag = {"all": None, "booked": True, "not_booked": False}[booked]
    rows = admin.eligible_students(db, booked=flag, badge_id=badge_id, search=search, now=utcnow())
    db.commit()
    return [
        schemas.EligibleRowOut(
            journey_id=row.journey.id,
            student=schemas.UserOut.model_validate(row.journey.student),
            badge=schemas.BadgeOut.model_validate(row.journey.badge),
            status=row.journey.status,
            eligible_since=row.journey.eligible_since,
            attempt_no=row.journey.attempts_used + 1,
            priority_rebook=row.journey.priority_rebook,
            last_nudged_at=row.journey.last_nudged_at,
            next_interview_at=row.interview.start_at if row.interview else None,
            interviewer_name=row.interview.interviewer.name if row.interview else None,
        )
        for row in rows
    ]


@router.post("/nudge", response_model=schemas.CountOut)
def nudge(body: schemas.NudgeIn, _: User = Depends(team_only), db: Session = Depends(get_db)):
    count = admin.nudge(db, journey_ids=body.journey_ids, now=utcnow())
    db.commit()
    return schemas.CountOut(count=count)
