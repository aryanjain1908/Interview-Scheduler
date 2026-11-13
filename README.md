# GRIT Interview Scheduling

Book, run and record GRIT Track Badge interviews, end to end. Built with React (Vite, TypeScript, Tailwind), FastAPI and Postgres.

- **Design write-up** (states, edge cases, data model, messages): [`docs/WRITEUP.md`](docs/WRITEUP.md)
- **Before/after screens:** http://localhost:5173/showcase once the app is running

## Home page and videos

http://localhost:5173 opens the product home page. In order, it covers:
- what the product is, shown with real screens;
- why it's needed and how it works, in four steps;
- each role, with its real screen;
- the student journey (the state machine) and the interview-day timeline;
- edge cases, architecture and data model;
- the three key student messages;
- four narrated demo videos recorded from the real app.

The videos live in `frontend/public/videos/`, and the tooling to re-record them is in [`tools/video/`](tools/video/README.md).

## Run it

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/). Everything else (Python, Node, Postgres) runs inside Docker.

**Windows:** double-click `start.bat`, or run `.\start.ps1` in PowerShell.
**macOS / Linux:** run `./start.sh`.

The script:
- starts Docker Desktop if it isn't running;
- builds the images on the first run;
- starts the database, API and web app;
- waits until they respond, then opens http://localhost:5173.

On first start the API runs the database migrations and loads demo data.

| Windows | macOS / Linux | What it does |
|---|---|---|
| `.\start.ps1` | `./start.sh` | Start (builds images only if missing) |
| `.\start.ps1 -Rebuild` | `./start.sh --rebuild` | Rebuild images first, e.g. after changing dependencies |
| `.\start.ps1 -Reset` | `./start.sh --reset` | Start, then wipe and reload the demo data |
| `.\start.ps1 -Test` | `./start.sh --test` | Start, then run the backend test suite |
| `.\start.ps1 -Logs` | `./start.sh --logs` | Follow the logs of all services |
| `.\start.ps1 -Stop` | `./start.sh --stop` | Stop everything; data is kept |
| `.\start.ps1 -Stop -Wipe` | `./start.sh --stop --wipe` | Stop and delete the database |

| Service | URL |
|---|---|
| Web app | http://localhost:5173 |
| API + Swagger docs | http://localhost:8000/docs |
| Postgres | localhost:5432 (grit / grit) |

Ports 5173, 8000 and 5432 must be free. The scripts build images with plain `docker build`, because `docker compose build` fails on some Windows setups.

### Logs

The API logs with [loguru](https://github.com/Delgan/loguru). View them with `.\start.ps1 -Logs` or `./start.sh --logs`.

- **Requests:** every request gets one line with its status and duration, plus a request ID. The same ID is returned in the `X-Request-ID` response header.
- **Warnings:** refused actions (such as a slot already taken) and failed logins are logged as warnings.
- **Business events:** bookings, results, no-shows, emergency changes and reviews are logged with record IDs only. No names, emails or passwords are logged.
- **Settings:** `LOG_LEVEL` sets the level (default `INFO`; `DEBUG` also shows every state change), and `LOG_JSON=true` switches to JSON lines.

### Without Docker for the app (Postgres still in Docker)

```bash
docker compose up -d db
cd backend && pip install -r requirements.txt && alembic upgrade head && python -m app.seed && uvicorn app.main:app --reload
cd frontend && npm install && npm run dev
```

## Demo accounts (password `demo1234`)

| Account | What you'll see |
|---|---|
| `sneha@grit.demo` | Eligible, not booked → book a slot |
| `rohan@grit.demo` | Booked for tomorrow → reschedule / cancel |
| `vikram@grit.demo` | Just passed (confetti, badge on profile) |
| `sai@grit.demo` | Retake suggested, with date |
| `neha@grit.demo` | Failed, cooling down (attempt 2 of 3 later) |
| `farhan@grit.demo` | No-show the student disputed — waiting in *Interviews → Disputed* |
| `ishita@grit.demo` | Emergency change inside 12h — waiting in *Interviews → Emergency changes* |
| `aditya@grit.demo` | Interviewer moved the interview with a reason; the student can change it for free |
| `tanvi@grit.demo` | Badge revoked for malpractice |
| `kiran@grit.demo` | Interviewer cancelled → priority rebook |
| `arjun@grit.demo` | Skills still pending |
| `priya@grit.demo` | Interviewer (all tracks) with interviews today |
| `rahul@grit.demo` / `meera@grit.demo` | Interviewers for Backend+Frontend / Data Analyst+Backend |
| `admin@grit.demo` | Interview team |

You can also **sign up with any role**. A new student starts with skills pending, exactly like a real student. To make them eligible, log in as the interview team, open **Student records**, find the student and record their skill clears. That's the same tool the team uses when the contest sync misses a clear. **Allow rebooking now** (on a student in cooldown) reopens booking early, with a reason saved to the audit trail.

**Changing a booking.** Students reschedule (max 2) or cancel freely until 12 hours before. Inside 12 hours they get **Emergency change**: pick a new time or cancel, with a reason. It happens at once and the team approves it (no attempt used) or rejects it (counts as an attempt) from *Interviews → Emergency changes*. Interviewers use **Change → Reschedule / Cancel interview** on their schedule, always with a reason; the student and the team leads are notified, and after an interviewer move the student can change it for free.

**Interview-day rules.** Students can book slots starting 30+ minutes from now. On the day: *Mark as started* opens 10 min before the slot, *Record outcome* at the start, and *No-show* (interviewer, with a note) and *My interviewer hasn't joined* (student) 15 min after the start. Buttons that aren't open yet show when they open. An interview nobody started is marked **Missed** 15 min after its slot (no attempt used). A student marked as a no-show can **dispute** it within 48h, and the team excuses or rejects it from *Interviews → Disputed*. A background job (every minute, inside the API) also sends reminders 24h and 1h before. Seeded examples: `nikhil@grit.demo` (interviewer absent), `pooja@grit.demo` (missed), `farhan@grit.demo` (disputed no-show).

Because outcomes can't be recorded before an interview starts, use **Aisha's** interview (on Priya's schedule, happening when you seed) to try recording a result straight away. It's marked missed 15 min after its slot if nobody acts; run `docker compose exec backend python -m app.seed --reset` for a fresh one.

### 2-minute walkthrough

1. Log in as **Sneha**, book a Frontend slot, and see "You're booked!" on the home page.
2. Log in as **Priya**. A booked interview shows *Record outcome* locked until it starts (Sneha's will look like that on her interviewer's schedule). **Aisha's** interview is happening now: click **Record outcome** on it and choose **Pass**.
3. Log in as **Aisha** (`aisha@grit.demo`): the home card shows the pass with confetti, and **My badges** shows the badge.
4. Log in as **admin**. Open **Calendar** and **Interviewers** to see everyone's availability, then **Booking status** to see the *Booked / Not booked* split and send reminders. Then open **Student records**, find Aisha and click **Nullify badge** (or use **Malpractice** to raise a flag and uphold it later): the badge is revoked.

## Tests

```bash
docker compose exec backend pytest
```

There are 152 tests against a real Postgres test database. They cover:
- every allowed and disallowed state transition
- eligibility and cooldowns
- booking rules and the 12-hour cutoff
- a 5-way concurrent booking race (exactly one wins)
- outcomes, no-shows and revocation/appeal
- availability slot generation
- interview-day timing rules, missed interviews (student absent, interviewer absent, both absent), no-show disputes and reminders
- student emergency changes (approve/reject, final attempt), interviewer reschedule/cancel, and racing changes
- auth and role guards

To typecheck and build the frontend: `cd frontend && npm run build`.

## Code map

```
backend/app/
  services/state_machine.py   the only writer of journey status (allow-list + audit event)
  services/eligibility.py     skills → eligible, lazy cooldown expiry, "why can't I book?"
  services/booking.py         book / reschedule / cancel with row locks
  services/interviews.py      start, no-show, record outcome, award badge
  services/availability.py    weekly windows → 14 days of slots, block slot / day off
  services/admin.py           pipeline stats, eligible-students list, reminders, flags
  services/messages.py        every student-facing message (single source of copy)
  routers/                    thin HTTP layer: validate → call service → commit
  seed.py                     demo data generated by running the real services
frontend/src/
  features/student/InterviewStatusCard.tsx   one card, a variant per journey state
  features/student/StudentHomeView.tsx       shared by the real dashboard and /showcase
  lib/status.ts                              every state's label and colour in one map
  api/                                        typed TanStack Query hooks per role
```
