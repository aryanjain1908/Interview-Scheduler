"""In-process background jobs: interview reminders and marking missed interviews.

Runs every `scheduler_interval_seconds` in a daemon thread. Jobs lock rows with
SKIP LOCKED, so running several API workers (each with its own scheduler) is safe.
"""

import threading

from loguru import logger

from app.core.clock import utcnow
from app.core.config import settings
from app.db import SessionLocal
from app.services import attendance, reminders

_stop = threading.Event()


def run_once() -> None:
    with SessionLocal() as db:
        now = utcnow()
        attendance.close_missed(db, now)
        reminders.send_due(db, now)
        db.commit()


def _loop() -> None:
    while not _stop.is_set():
        try:
            run_once()
        except Exception:  # keep the loop alive; the next tick retries
            logger.exception("Scheduler tick failed; retrying next tick")
        _stop.wait(settings.scheduler_interval_seconds)


def start() -> None:
    if settings.scheduler_enabled:
        _stop.clear()
        threading.Thread(target=_loop, name="grit-scheduler", daemon=True).start()
        logger.info("Scheduler started (every {}s)", settings.scheduler_interval_seconds)


def stop() -> None:
    _stop.set()
