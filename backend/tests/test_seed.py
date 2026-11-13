"""The demo data is built relative to "now", so it must work whatever time a deploy happens."""

from datetime import datetime, timedelta, timezone

import pytest

from app.seed import Seeder
from tests.conftest import TestSession

MIDNIGHT_IST = datetime(2026, 3, 2, 18, 30, tzinfo=timezone.utc)  # Tue 3 Mar 00:00 IST


@pytest.mark.parametrize("hour", [0, 6.5, 9, 13, 17.5, 18, 20, 21.5, 23.75])
def test_seed_works_at_any_time_of_day(hour):
    with TestSession() as db:
        Seeder(db, now=MIDNIGHT_IST + timedelta(hours=hour)).run()
        db.commit()
