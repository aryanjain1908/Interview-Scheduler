import itertools

import pytest

from app.core.errors import RuleViolation
from app.models import InterviewJourney, JourneyStatus as S
from app.services.state_machine import ALLOWED, transition
from tests.conftest import NOW

ALL_PAIRS = list(itertools.product(S, S))


def test_every_state_has_rules():
    assert set(ALLOWED) == set(S)


@pytest.mark.parametrize("current,target", ALL_PAIRS, ids=lambda s: s.value)
def test_transition_matches_table(current, target):
    journey = InterviewJourney(status=current)
    if target in ALLOWED[current]:
        transition(journey, target, at=NOW, reason="test")
        assert journey.status == target
        assert journey.events[-1].from_status == current
        assert journey.events[-1].to_status == target
    else:
        with pytest.raises(RuleViolation):
            transition(journey, target, at=NOW)
        assert journey.status == current
        assert journey.events == []


def test_terminal_paths():
    """A pass can only ever be revoked (and reinstated); nothing reopens booking."""
    assert ALLOWED[S.PASSED] == {S.BADGE_REVOKED}
    assert ALLOWED[S.BADGE_REVOKED] == {S.PASSED}
