from datetime import datetime, timedelta, timezone

from app.core.clock import day_word, fmt_until

NOW = datetime(2026, 11, 13, 8, 0, tzinfo=timezone.utc)  # 1:30 PM IST


def test_fmt_until():
    assert fmt_until(NOW + timedelta(minutes=15), NOW) == "in 15 min"
    assert fmt_until(NOW + timedelta(minutes=59, seconds=30), NOW) == "in 1 hr"
    assert fmt_until(NOW + timedelta(minutes=80), NOW) == "in 1 hr 20 min"
    assert fmt_until(NOW + timedelta(seconds=-5), NOW) == "now"
    assert fmt_until(NOW + timedelta(hours=26), NOW) == "tomorrow"


def test_day_word_uses_ist_dates():
    assert day_word(NOW + timedelta(hours=10), NOW) == "today"  # 11:30 PM IST
    assert day_word(NOW + timedelta(hours=11), NOW) == "tomorrow"  # 12:30 AM IST next day
