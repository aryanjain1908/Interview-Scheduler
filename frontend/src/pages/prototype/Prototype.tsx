import clsx from "clsx";
import { ArrowDown, ArrowLeft, ArrowRight, Check, ExternalLink, MousePointerClick, RotateCcw } from "lucide-react";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { HOME_FOR_ROLE, useAuth } from "../../auth/AuthContext";
import { HomeLogo } from "../../components/layout/AppShell";
import { buttonClasses } from "../../components/ui/Button";
import { ScheduleRow } from "../../features/interviewer/ScheduleRow";
import { KEY_MESSAGES } from "../../features/showcase/fixtures";
import { ProfileView } from "../../features/student/ProfileView";
import { StudentHomeView } from "../../features/student/StudentHomeView";
import { formatDay, formatLongDay, formatTime } from "../../lib/format";
import type { Dashboard, Notification, Slot } from "../../lib/types";
import { BookingScreen } from "./BookingScreen";
import { prototypeData, type Result } from "./data";
import { OutcomeForm } from "./OutcomeForm";

const STEPS = [
  { id: "home", label: "Student home" },
  { id: "book", label: "Book a slot" },
  { id: "booked", label: "Booked" },
  { id: "day", label: "Interviewer's day" },
  { id: "record", label: "Record result" },
  { id: "result", label: "Before / after" },
  { id: "profile", label: "Profile" },
  { id: "messages", label: "3 messages" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

const RESULT_LABEL: Record<Result, string> = { pass: "Pass", retake_later: "Retake later", fail: "Not cleared" };
const TONE_DOT = { info: "bg-brand-500", success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-rose-500" };

const noop = () => undefined;

export default function Prototype() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const now = useMemo(() => Date.now(), []);
  const data = useMemo(() => prototypeData(now), [now]);
  const [slot, setSlot] = useState<Slot | null>(null);

  const step: StepId = STEPS.some((s) => s.id === params.get("step")) ? (params.get("step") as StepId) : "home";
  const result: Result = (["pass", "retake_later", "fail"] as const).find((r) => r === params.get("result")) ?? "pass";
  const index = STEPS.findIndex((s) => s.id === step);

  const go = (id: StepId, extra: Record<string, string> = {}) => {
    setParams({ step: id, result, ...extra });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const next = () => index < STEPS.length - 1 && go(STEPS[index + 1]!.id);
  const back = () => index > 0 && go(STEPS[index - 1]!.id);

  useEffect(() => {
    document.title = "Prototype · GRIT Interviews";
    return () => {
      document.title = "GRIT Interviews";
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select");
      if (typing || document.querySelector("[role='dialog']")) return;
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const booked = useMemo(() => (slot ? bookedFor(data.booked, slot) : data.booked), [data.booked, slot]);
  const day = useMemo(() => data.day(Date.parse(booked.journeys[0]!.current_interview!.start_at)), [data, booked]);
  const messages = useMemo(() => {
    const [first, ...rest] = KEY_MESSAGES(now);
    const bookedNote = booked.notifications[0]!;
    return [{ ...first!, body: bookedNote.body }, ...rest];
  }, [booked, now]);

  const view = renderStep();

  return (
    <div className="min-h-screen bg-canvas text-ink-900">
      <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <HomeLogo dark={false} />
            <span className="hidden rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-brand-700 ring-1 ring-brand-200 sm:inline">
              Prototype
            </span>
          </div>
          <Link to={user ? HOME_FOR_ROLE[user.role] : "/login"} className={buttonClasses("dark", "sm")}>
            {user ? "Open the live app" : "Try the live app"} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <nav aria-label="Prototype steps" className="mx-auto max-w-[1360px] overflow-x-auto px-4 pb-3 sm:px-6">
          <ol className="flex min-w-max gap-1.5">
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <button
                  onClick={() => go(s.id)}
                  aria-current={s.id === step ? "step" : undefined}
                  className={clsx(
                    "flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-[13px] font-semibold transition",
                    s.id === step
                      ? "bg-ink-950 text-white"
                      : i < index
                        ? "bg-white text-ink-700 ring-1 ring-ink-200 hover:ring-ink-300"
                        : "text-ink-500 hover:bg-white hover:text-ink-800",
                  )}
                >
                  <span
                    className={clsx(
                      "grid h-5 w-5 place-items-center rounded-full text-[11px]",
                      s.id === step ? "bg-white text-ink-950" : i < index ? "bg-emerald-100 text-emerald-700" : "bg-ink-200 text-ink-600",
                    )}
                  >
                    {i < index ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  {s.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <main className="mx-auto grid max-w-[1360px] grid-cols-1 gap-6 px-3 py-8 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-10">
        <aside className="lg:sticky lg:top-36 lg:self-start">
          <p className="text-[13px] font-semibold text-brand-700">
            Step {index + 1} of {STEPS.length} · {view.who}
          </p>
          <h1 className="mt-2 font-head text-[28px] font-extrabold leading-tight text-ink-950">{view.title}</h1>
          <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-600">{view.text}</div>
          {view.hint && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-[13px] font-medium text-brand-800 ring-1 ring-brand-100">
              <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0" /> {view.hint}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            {index > 0 && (
              <button onClick={back} className={buttonClasses("secondary", "md")}>
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            )}
            {view.cta}
          </div>
          <p className="mt-4 hidden text-xs text-ink-400 lg:block">Tip: use the ← and → keys to move between steps.</p>
        </aside>

        <section className="min-w-0">{view.screen}</section>
      </main>
    </div>
  );

  function renderStep(): { who: string; title: string; text: ReactNode; hint?: string; cta: ReactNode; screen: ReactNode } {
    const nextButton = (label: string) => (
      <button onClick={next} className={buttonClasses("primary", "md")}>
        {label} <ArrowRight className="h-4 w-4" />
      </button>
    );

    switch (step) {
      case "home":
        return {
          who: "Student",
          title: "Riya has cleared every skill",
          text: (
            <>
              <p>
                This is a student's home screen. The moment Riya clears her last Frontend skill, the badge card switches
                to "ready to book" and a message lands in her inbox.
              </p>
              <p>Other badges still show how many skills are left.</p>
            </>
          ),
          cta: nextButton("Book the interview"),
          screen: (
            <Screen path="/student" label="Student · Home">
              <Inert>
                <StudentHomeView data={data.eligible} now={now} interactive={false} />
              </Inert>
            </Screen>
          ),
        };
      case "book":
        return {
          who: "Student",
          title: "Pick a slot",
          text: (
            <p>
              Highlighted dates have open slots. Times are in IST, and anything starting in the next 30 minutes isn't
              offered, so the interviewer always has notice.
            </p>
          ),
          hint: "Pick a time, then Review booking and Confirm.",
          cta: (
            <button onClick={() => go("booked")} className={buttonClasses("ghost", "md")}>
              Skip <ArrowRight className="h-4 w-4" />
            </button>
          ),
          screen: (
            <Screen path="/student/book/frontend" label="Student · Booking">
              <BookingScreen
                badge={data.booked.journeys[0]!.badge}
                slots={data.slots}
                now={now}
                onBooked={(s) => {
                  setSlot(s);
                  go("booked");
                }}
              />
            </Screen>
          ),
        };
      case "booked":
        return {
          who: "Student",
          title: "Message 1: You're booked!",
          text: (
            <>
              <p>The card turns into a countdown with the time, the interviewer and the join button.</p>
              <p>
                The confirmation below is the first of the three key messages. It answers the questions a student has
                right after booking: when, with whom, how to join, and how to change it.
              </p>
            </>
          ),
          cta: nextButton("Go to interview day"),
          screen: (
            <Screen path="/student" label="Student · Home">
              <MessageCard n={1} note={booked.notifications[0]!} />
              <Inert>
                <StudentHomeView data={booked} now={now} interactive={false} />
              </Inert>
            </Screen>
          ),
        };
      case "day":
        return {
          who: "Interviewer",
          title: "The interviewer's day",
          text: (
            <>
              <p>
                Priya sees today's interviews in order. Buttons open only when they make sense: Start from 10 minutes
                before, Record outcome once the slot begins, and No-show only 15 minutes in.
              </p>
              <p>We've jumped to the day of Riya's interview, 20 minutes in. It's happening now.</p>
            </>
          ),
          hint: "Click Record outcome on Riya's row.",
          cta: nextButton("Record the result"),
          screen: (
            <Screen path="/interviewer" label="Interviewer · Today">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Hi Priya</p>
                <h2 className="mt-1 font-display text-2xl font-extrabold text-ink-950">Today's interviews</h2>
                <p className="mt-1 text-sm text-ink-500">{formatLongDay(day.live.start_at)} · 3 interviews · 1 done · 2 to go</p>
              </div>
              <div className="space-y-3">
                <Inert>
                  <ScheduleRow item={day.done} now={day.now} />
                </Inert>
                <div className="rounded-2xl ring-2 ring-brand-500 ring-offset-2 ring-offset-canvas">
                  <ScheduleRow item={day.live} now={day.now} onStart={noop} onNoShow={noop} onRecord={() => go("record")} />
                </div>
                <Inert>
                  <ScheduleRow item={day.later} now={day.now} onStart={noop} onNoShow={noop} onRecord={noop} />
                </Inert>
              </div>
            </Screen>
          ),
        };
      case "record":
        return {
          who: "Interviewer",
          title: "Record the outcome",
          text: (
            <>
              <p>
                Pass, retake later or fail, plus a 1 to 5 score on three skills. Retake and fail need written feedback,
                because that's what the student will read.
              </p>
              <p>Pick a result to see how Riya's screens change for it.</p>
            </>
          ),
          hint: "Use Fill sample answers if you're short on time.",
          cta: null,
          screen: (
            <Screen path="/interviewer" label="Interviewer · Record outcome">
              <div className="mx-auto max-w-2xl rounded-2xl bg-white p-5 shadow-card ring-1 ring-ink-200/70 sm:p-6">
                <h2 className="font-display text-lg font-bold text-ink-950">Record outcome</h2>
                <p className="mb-5 mt-0.5 text-sm text-ink-500">Riya Kapoor · Frontend Developer · interview in progress</p>
                <OutcomeForm onSubmit={(r) => go("result", { result: r })} onCancel={() => go("day")} />
              </div>
            </Screen>
          ),
        };
      case "result": {
        const afterHome = data.after[result];
        const note = afterHome.notifications[0]!;
        return {
          who: "Student and interviewer",
          title: `Before and after: ${RESULT_LABEL[result]}`,
          text: (
            <>
              <p>
                The moment the result is saved, Riya's home screen changes and she gets a message.{" "}
                {result === "pass" && "The badge goes live on her profile."}
                {result === "retake_later" && "No attempt is used, and she can book again from the date Priya chose."}
                {result === "fail" && "One attempt is used, and she can try again after 14 days."}
              </p>
              <p>Priya's row locks to the result.</p>
              <ResultSwitch value={result} onChange={(r) => go("result", { result: r })} />
            </>
          ),
          cta: nextButton("See the profile"),
          screen: (
            <div className="space-y-8">
              {result !== "fail" && <MessageCard n={result === "pass" ? 2 : 3} note={note} />}
              {result === "fail" && <MessageCard note={note} />}
              <BeforeAfter
                title="Student home"
                before={<StudentHomeView data={booked} now={now} interactive={false} compact />}
                after={<StudentHomeView data={afterHome} now={now} interactive={false} compact />}
              />
              <BeforeAfter
                title="Interviewer's row"
                before={<ScheduleRow item={day.live} now={day.now} onStart={noop} onNoShow={noop} onRecord={noop} />}
                after={<ScheduleRow item={day.recorded(result)} now={day.now} />}
              />
            </div>
          ),
        };
      }
      case "profile":
        return {
          who: "Anyone viewing the profile",
          title: "The GRIT profile",
          text: (
            <>
              <p>A pass puts the badge on Riya's public profile.</p>
              <p>
                If cheating comes out later, the GRIT team can revoke it. The badge is marked revoked and Riya sees the
                reason. An accepted appeal brings it back.
              </p>
            </>
          ),
          cta: nextButton("See the 3 messages"),
          screen: (
            <div className="grid grid-cols-1 items-start gap-5 2xl:grid-cols-3">
              <Labeled label="Before the result">
                <ProfileView student={data.booked.student} journeys={data.booked.journeys} />
              </Labeled>
              <Labeled label="After a pass" tone="after">
                <ProfileView student={data.passed.student} journeys={data.passed.journeys} />
              </Labeled>
              <Labeled label="After malpractice is upheld" tone="revoked">
                <ProfileView student={data.revoked.student} journeys={data.revoked.journeys} />
              </Labeled>
            </div>
          ),
        };
      case "messages":
        return {
          who: "Student",
          title: "The 3 messages that matter",
          text: (
            <p>
              Exact copy, as it appears in the student's inbox and on their home screen. Each one says what happened and
              what to do next.
            </p>
          ),
          cta: (
            <>
              <Link to={user ? HOME_FOR_ROLE[user.role] : "/login"} className={buttonClasses("primary", "md")}>
                Try the live app <ArrowRight className="h-4 w-4" />
              </Link>
              <button onClick={() => go("home")} className={buttonClasses("ghost", "md")}>
                <RotateCcw className="h-4 w-4" /> Start again
              </button>
            </>
          ),
          screen: (
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={m.title} className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-ink-200/70 sm:p-6">
                  <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-400">
                    Message {i + 1} · {m.when}
                  </p>
                  <div className="mt-3 flex gap-3">
                    <span className={clsx("mt-2 h-2 w-2 shrink-0 rounded-full", TONE_DOT[m.tone])} />
                    <p className="text-[16px] leading-relaxed text-ink-800">
                      <span className="font-semibold text-ink-950">{m.title}</span> {m.body}
                    </p>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-2">
                <Link to="/showcase" className={buttonClasses("secondary", "sm")}>
                  All before and after screens <ExternalLink className="h-3.5 w-3.5" />
                </Link>
                <Link to="/writeup" className={buttonClasses("secondary", "sm")}>
                  Read the write-up <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ),
        };
    }
  }
}

/** The booked dashboard for the slot the viewer picked (time, interviewer and message). */
function bookedFor(base: Dashboard, slot: Slot): Dashboard {
  const [fe, ...others] = base.journeys;
  const current = fe!.current_interview!;
  const when = `${formatDay(slot.start_at)} at ${formatTime(slot.start_at)} IST`;
  const note: Notification = {
    ...base.notifications[0]!,
    body: `Your ${fe!.badge.name} badge interview is on ${when} with ${slot.interviewer.name}. Join from your dashboard 5 minutes early. Need to change it? You can reschedule or cancel up to 12 hours before.`,
    read_at: null,
  };
  return {
    ...base,
    journeys: [
      { ...fe!, current_interview: { ...current, start_at: slot.start_at, end_at: slot.end_at, interviewer: slot.interviewer } },
      ...others,
    ],
    notifications: [note],
    unread_count: 1,
  };
}

function Screen({ path, label, children }: { path: string; label: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-ink-900/10">
      <div className="flex items-center gap-1.5 bg-ink-900 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 truncate rounded-md bg-white/10 px-2.5 py-0.5 font-mono text-[12px] text-ink-300">{path}</span>
        <span className="ml-auto hidden text-[12px] font-medium text-ink-400 sm:inline">{label}</span>
      </div>
      <div className="bg-canvas p-2 sm:p-6">{children}</div>
    </div>
  );
}

/** Real components, but clicks don't leave the prototype. */
function Inert({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none select-none" aria-hidden>
      {children}
    </div>
  );
}

function MessageCard({ n, note }: { n?: number; note: Notification }) {
  return (
    <div className="mb-5 rounded-2xl bg-white p-4 shadow-card ring-2 ring-brand-200 sm:p-5">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-brand-700">
        {n ? `Key message ${n} of 3 · in Riya's inbox` : "In Riya's inbox"}
      </p>
      <div className="mt-2 flex gap-3">
        <span className={clsx("mt-2 h-2 w-2 shrink-0 rounded-full", TONE_DOT[note.tone])} />
        <p className="text-[15px] leading-relaxed text-ink-800">
          <span className="font-semibold text-ink-950">{note.title}</span> {note.body}
        </p>
      </div>
    </div>
  );
}

function BeforeAfter({ title, before, after }: { title: string; before: ReactNode; after: ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 font-display text-lg font-bold text-ink-950">{title}</h2>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 2xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <Labeled label="Before">{before}</Labeled>
        <div className="grid place-items-center self-center text-ink-300">
          <ArrowRight className="hidden h-6 w-6 2xl:block" />
          <ArrowDown className="h-6 w-6 2xl:hidden" />
        </div>
        <Labeled label="After" tone="after">
          {after}
        </Labeled>
      </div>
    </div>
  );
}

function Labeled({ label, tone = "before", children }: { label: string; tone?: "before" | "after" | "revoked"; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p
        className={clsx(
          "mb-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider",
          tone === "before" && "bg-ink-200 text-ink-600",
          tone === "after" && "bg-emerald-100 text-emerald-800",
          tone === "revoked" && "bg-slate-200 text-slate-700",
        )}
      >
        {label}
      </p>
      <div className="pointer-events-none select-none rounded-2xl bg-canvas p-3 ring-1 ring-ink-200 sm:p-4" aria-hidden>
        {children}
      </div>
    </div>
  );
}

function ResultSwitch({ value, onChange }: { value: Result; onChange: (r: Result) => void }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-ink-800">Show the result as</p>
      <div className="inline-flex flex-wrap gap-1 rounded-xl bg-ink-100 p-1">
        {(Object.keys(RESULT_LABEL) as Result[]).map((r) => (
          <button
            key={r}
            onClick={() => onChange(r)}
            className={clsx(
              "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
              value === r ? "bg-white text-ink-950 shadow-sm" : "text-ink-500 hover:text-ink-800",
            )}
          >
            {RESULT_LABEL[r]}
          </button>
        ))}
      </div>
    </div>
  );
}
