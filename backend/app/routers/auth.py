from fastapi import APIRouter, Depends
from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.core.clock import utcnow
from app.core.errors import Conflict, DomainError
from app.core.security import create_access_token, hash_password, verify_password
from app.db import get_db
from app.deps import current_user
from app.models import Role, User
from app.services.eligibility import ensure_journeys
from app.services.interviewers import set_badges

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_for(user: User) -> schemas.TokenOut:
    return schemas.TokenOut(
        access_token=create_access_token(str(user.id), user.role.value), user=schemas.UserOut.model_validate(user)
    )


@router.post("/signup", response_model=schemas.TokenOut, status_code=201)
def signup(body: schemas.SignupIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise Conflict("An account with this email already exists. Log in instead.", code="email_taken")
    now = utcnow()
    user = User(
        name=body.name.strip(),
        email=email,
        password_hash=hash_password(body.password),
        role=body.role,
        college=(body.college or "").strip() or None,
        created_at=now,
    )
    db.add(user)
    db.flush()
    if user.role == Role.STUDENT:
        ensure_journeys(db, user.id, now)
    elif user.role == Role.INTERVIEWER:
        set_badges(db, interviewer_id=user.id, badge_ids=body.badge_ids)
    db.commit()
    logger.info("Signed up user {} as {}", user.id, user.role.value)
    return _token_for(user)


@router.post("/login", response_model=schemas.TokenOut)
def login(body: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        logger.warning("Failed login attempt")
        raise DomainError("Email or password is incorrect.", code="invalid_credentials")
    return _token_for(user)


@router.get("/me", response_model=schemas.UserOut)
def me(user: User = Depends(current_user)):
    return user
