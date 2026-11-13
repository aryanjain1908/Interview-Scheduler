import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Interview, InterviewJourney


def lock_journey(db: Session, journey_id: uuid.UUID) -> InterviewJourney:
    """Row-lock a journey for the rest of the transaction and reload its latest state.

    Pending changes are flushed first so the reload can't discard them.
    """
    db.flush()
    return db.scalars(
        select(InterviewJourney)
        .where(InterviewJourney.id == journey_id)
        .with_for_update(of=InterviewJourney)
        .execution_options(populate_existing=True)
    ).one()


def lock_interview(db: Session, interview_id: uuid.UUID) -> Optional[Interview]:
    """Row-lock an interview and reload it, so two people acting on it at once are
    serialised and the second one sees the first one's change (and is refused).

    The lock is taken on the bare row first: locking a query that also join-loads the
    slot would, after waiting on a concurrent move, re-check the row against the *old*
    slot and come back with no slot at all. The reload then reads the committed state.
    """
    db.flush()
    db.execute(select(Interview.id).where(Interview.id == interview_id).with_for_update())
    return db.scalars(
        select(Interview).where(Interview.id == interview_id).execution_options(populate_existing=True)
    ).unique().one_or_none()
