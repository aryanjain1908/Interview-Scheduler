"""Time helpers. Everything is stored in UTC and shown to people in IST."""

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


def fmt_time(dt: datetime) -> str:
    """'4:30 PM'"""
    local = to_local(dt)
    hour = local.hour % 12 or 12
    return f"{hour}:{local.minute:02d} {'AM' if local.hour < 12 else 'PM'}"
