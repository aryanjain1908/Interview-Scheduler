"""Time helpers. Everything is stored in UTC and shown to people in IST."""

import math
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from app.core.config import settings

LOCAL_TZ = ZoneInfo(settings.timezone)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def to_local(dt: datetime) -> datetime:
    return dt.astimezone(LOCAL_TZ)


def local_today(now: datetime) -> date:
    return to_local(now).date()


def local_midnight_utc(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=LOCAL_TZ).astimezone(timezone.utc)


def local_day_bounds(day: date) -> "tuple[datetime, datetime]":
    start = local_midnight_utc(day)
    return start, start + timedelta(days=1)


def fmt_date(value: "date | datetime") -> str:
    """'2 Dec'"""
    d = to_local(value).date() if isinstance(value, datetime) else value
    return f"{d.day} {d:%b}"


def fmt_datetime(dt: datetime) -> str:
    """'Tue, 18 Nov at 4:30 PM IST'"""
    local = to_local(dt)
    hour = local.hour % 12 or 12
    meridiem = "AM" if local.hour < 12 else "PM"
    return f"{local:%a}, {local.day} {local:%b} at {hour}:{local.minute:02d} {meridiem} IST"


def fmt_until(start: datetime, now: datetime) -> str:
    """How far away `start` is, for notifications: 'in 15 min', 'in 1 hr 20 min', 'now'."""
    minutes = math.ceil((start - now).total_seconds() / 60)
    if minutes < 1:
        return "now"
    if minutes < 60:
        return f"in {minutes} min"
    hours, rest = divmod(minutes, 60)
    if hours < 24:
        return f"in {hours} hr" + (f" {rest} min" if rest else "")
    days = (local_today(start) - local_today(now)).days
    return "tomorrow" if days == 1 else f"in {days} days"


def day_word(start: datetime, now: datetime) -> str:
    """'today', 'tomorrow' or the date, in IST."""
    days = (local_today(start) - local_today(now)).days
    return {0: "today", 1: "tomorrow"}.get(days, f"on {fmt_date(start)}")


def fmt_time(dt: datetime) -> str:
    """'4:30 PM'"""
    local = to_local(dt)
    hour = local.hour % 12 or 12
    return f"{hour}:{local.minute:02d} {'AM' if local.hour < 12 else 'PM'}"
