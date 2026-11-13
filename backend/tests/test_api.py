def _signup(client, role, email):
    res = client.post(
        "/api/auth/signup", json={"name": "Test Person", "email": email, "password": "secret123", "role": role}
    )
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_signup_login_and_me(client):
    _signup(client, "student", "a@test.dev")
    res = client.post("/api/auth/login", json={"email": "A@test.dev", "password": "secret123"})
    assert res.status_code == 200
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {res.json()['access_token']}"})
    assert me.json()["role"] == "student"


def test_duplicate_email_and_bad_password(client):
    _signup(client, "student", "b@test.dev")
    assert client.post(
        "/api/auth/signup", json={"name": "X Y", "email": "b@test.dev", "password": "secret123", "role": "student"}
    ).status_code == 409
    assert client.post("/api/auth/login", json={"email": "b@test.dev", "password": "nope"}).status_code == 400


def test_role_guards(client):
    student = _signup(client, "student", "c@test.dev")
    assert client.get("/api/admin/overview", headers=student).status_code == 403
    assert client.get("/api/interviewer/schedule", headers=student).status_code == 403
    assert client.get("/api/student/dashboard").status_code == 401


def test_dashboard_shape(client):
    student = _signup(client, "student", "d@test.dev")
    body = client.get("/api/student/dashboard", headers=student).json()
    assert body["student"]["email"] == "d@test.dev"
    assert body["journeys"] == []  # no badges in an empty catalogue


def test_interviewer_signup_requires_tracks(client):
    res = client.post(
        "/api/auth/signup",
        json={"name": "New Interviewer", "email": "i@test.dev", "password": "secret123", "role": "interviewer"},
    )
    assert res.status_code == 422
    assert "at least one" in res.json()["detail"]


def test_booking_status_is_shared_with_interviewers(client):
    interviewer = _signup_interviewer(client)
    assert client.get("/api/team/eligible-students", headers=interviewer).status_code == 200
    assert client.get("/api/admin/overview", headers=interviewer).status_code == 403


def _signup_interviewer(client):
    from app.models import Badge
    from tests.conftest import TestSession

    with TestSession() as s:
        badge = Badge(slug="t", name="Track")
        s.add(badge)
        s.commit()
        badge_id = str(badge.id)
    res = client.post(
        "/api/auth/signup",
        json={"name": "New Interviewer", "email": "j@test.dev", "password": "secret123", "role": "interviewer", "badge_ids": [badge_id]},
    )
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}
