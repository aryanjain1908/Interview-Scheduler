# GRIT Interviews: Write-up

Aryan Jain | NIAT AI Product Engineer, Round 1 | Live app: http://130.210.56.15 | Code: github.com/aryanjain1908/Interview-Scheduler

A student who clears every skill for a Track Badge has to pass a live interview to earn it. I built the booking and interview flow for that. Students book a slot, interviewers take the interview and record the result, and the GRIT team can see who's stuck and take a badge back if cheating comes out later. This write-up covers the states, the edge cases I handled and the data model.

## 1. States

Each student has one journey per badge. Only one module (the state machine) is allowed to change a journey's state, and every change is saved with who made it and why. The same log is shown to the student as their timeline.

| State | What it means | What moves it on |
|---|---|---|
| Not eligible | Some skills for the badge aren't cleared yet | Last skill cleared → Eligible |
| Eligible | Can book, nothing booked right now | Student books a slot → Booked |
| Booked | Has a slot with an interviewer | Interviewer starts it → In progress. Student or interviewer cancels → Eligible. Student marked absent → No-show. Interviewer never joins, or nobody turns up → Eligible (no attempt used, first in line to rebook). Reschedules keep it Booked |
| In progress | Interview is happening | Result recorded → Passed, Not cleared or Retake later. No result within 24 hours → Eligible (closed as missed, no attempt used) |
| Passed | Badge is live on the profile | Malpractice confirmed → Revoked |
| Retake later | "Not ready yet". Doesn't use an attempt | The date the interviewer picked (1 to 60 days) → Eligible |
| Not cleared | Uses 1 of 3 attempts | 14 days later → Eligible, if attempts are left |
| No-show | Student didn't join. Uses an attempt | 3 days later → Eligible. If the team accepts the student's dispute → Eligible at once, attempt given back |
| Revoked | Badge taken back for malpractice | Appeal accepted → Passed |

**Interview day.** Students can't book a slot that starts in the next 30 minutes, unless the interviewer opens it at short notice (down to 5 minutes). The interviewer can start 10 minutes early and record a result once the slot begins. 15 minutes after the start, the interviewer can mark a no-show and the student can report that the interviewer never came. If nobody has started it 15 minutes after the slot ends, it's closed as missed and no attempt is used.

## 2. Edge cases and questions

**Booking**
- Two students click the same slot at the same moment. The row is locked while booking, so one gets it and the other is told the slot was just taken. A unique index on live bookings is a backup check in case the code has a bug.
- One live booking per badge. A student can still hold bookings for different badges at the same time.
- Slots are offered 14 days ahead. The 30-minute notice above applies to every slot unless the interviewer chooses to open it sooner.

**Changing a booking**
- Students can reschedule twice and cancel freely until 12 hours before. Inside 12 hours they get one emergency change per attempt, with a reason. The change is applied right away and the team reviews it later. If approved it's free, if rejected it counts as an attempt.
- Moving to the same time with a different interviewer is refused. It would waste a change without fixing anything.
- An interviewer can move or cancel an interview but has to give a reason. The student is told why, keeps their attempt, and goes to the front of the queue. If the student had an emergency change waiting for review, it's closed as approved, since it wasn't the student's fault.
- If the student and the interviewer change the same interview at the same moment, only the first change goes through. The second person is asked to refresh.

**On the day**
- A no-show can only be marked 15 minutes into the slot, needs a short note, and can't be marked once the interview has started. The meeting link gives me no attendance data, so the student can dispute a no-show within 48 hours and the team decides after hearing both sides.
- Reminders go out a day before and an hour before, and they say the real time left, so a short-notice booking made 15 minutes ahead doesn't claim it's an hour away.

**After the interview**
- Only the assigned interviewer can record the result, once. A "Not cleared" or "Retake later" result needs written feedback. Internal notes are never shown to the student.
- If cheating is found after a pass, the team revokes the badge and the student sees the reason. If their appeal is accepted, the badge comes back.

**Assumptions and open questions**
- Skill clears come from the existing contest system. The team can correct them by hand, and every correction is logged.
- 30-minute slots, 3 attempts per badge and the 14-day and 3-day waits are just config values for now. They aren't final product decisions.
- If a skill clear is withdrawn while a student is booked, I keep the booking. That probably needs a product call.
- For the demo anyone can sign up with any role. In production the GRIT team would assign roles.
- Meetings use a generated Jitsi link and messages go to the in-app inbox. Email or WhatsApp would plug into the same notify step.
- All times are stored in UTC and shown in IST.

## 3. Data model

Postgres, with Alembic migrations. Status columns are plain text checked in code, so adding a status doesn't need a database enum change.

| Table | Key fields | Why it exists |
|---|---|---|
| users | email (unique), password_hash, role | Students, interviewers and the GRIT team |
| badges, skills, badge_skills | badge and skill ids, max_attempts | A skill can count towards more than one badge |
| student_skill_clears | student_id, skill_id, cleared_at | Decides who is eligible |
| interview_journeys | student_id + badge_id (unique), status, attempts_used, reschedules_used, eligible_again_at, priority_rebook | The state machine's row, one per student per badge |
| interview_events | journey_id, from_status, to_status, actor_id, reason | Audit trail and the student's timeline |
| interviewer_badges | interviewer_id, badge_id | Which badges an interviewer can take |
| availability_windows | interviewer_id, weekday or date, start and end time | The hours an interviewer is free |
| slots | interviewer_id + start_at (unique), status | 30-minute blocks: open, booked or blocked |
| interviews | journey_id, slot_id, attempt_no, status, meeting_link, no-show and dispute fields | One row per booking. Unique indexes stop double booking |
| change_requests | interview_id, reason, from and to time, status | Emergency changes waiting for the team |
| interview_outcomes | interview_id, result, scores, feedback, internal_notes | One result per interview |
| student_badges, malpractice_flags | status, reason, resolution | What the profile shows, and why a badge was taken back |
| notifications | user_id, kind, title, body, read_at | The in-app inbox |

How they connect: a user has one journey per badge, a journey can have several interviews over time (retakes and rebookings), each interview takes one slot and gets at most one outcome, and every status change adds a row to interview_events.
