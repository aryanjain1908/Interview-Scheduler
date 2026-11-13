import clsx from "clsx";
import confetti from "canvas-confetti";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  Clock,
  ExternalLink,
  Lock,
  PartyPopper,
  RefreshCcw,
  Hourglass,
  ShieldOff,
  Siren,
  Sparkles,
  UserX,
  Video,
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useCancelInterview, useDisputeNoShow, useReportInterviewerAbsent } from "../../api/student";
import { Button, LinkButton } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field, Textarea } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { JourneyPill, Pill } from "../../components/ui/Pill";
import { useToast } from "../../components/ui/Toast";
import { actionState } from "../../lib/actions";
import { errorMessage } from "../../lib/api";
import { formatDate, formatDateTime, formatLongDay, formatShortDate, formatTime, relativeFromNow } from "../../lib/format";
import type { BadgeJourney, ChangeRequest, Interview } from "../../lib/types";
import { BadgeMedallion, medallionState } from "./BadgeMedallion";
import { JourneyStepper } from "./JourneyStepper";
import { FeedbackQuote, ScoreBars } from "./OutcomeSummary";

interface Props {
  item: BadgeJourney;
  now: number;
  /** false in the before/after showcase: renders identically but performs no side effects. */
  interactive?: boolean;
}

export function InterviewStatusCard({ item, now, interactive = true }: Props) {
  const { badge, journey } = item;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <BadgeMedallion badge={badge} state={medallionState(journey.status)} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold text-ink-950">{badge.name}</h2>
            {journey.status === "eligible" && journey.attempts_left === 0 ? (
              <Pill tone="slate">No attempts left</Pill>
            ) : (
              <JourneyPill status={journey.status} />
            )}
          </div>
          <p className="mt-0.5 text-sm text-ink-500">{badge.description}</p>
        </div>
      </div>
      <div className="px-5 sm:px-6">
        <JourneyStepper status={journey.status} />
      </div>
      <div className="p-3 sm:p-4">
        <StatePanel item={item} now={now} interactive={interactive} />
      </div>
    </Card>
  );
}

function StatePanel({ item, now, interactive }: Required<Props>) {
  switch (item.journey.status) {
    case "not_eligible":
      return <LockedPanel item={item} />;
    case "eligible":
      return <EligiblePanel item={item} />;
    case "booked":
    case "in_progress":
      return item.current_interview ? (
        <BookedPanel item={item} interview={item.current_interview} now={now} interactive={interactive} />
      ) : null;
    case "passed":
      return <PassedPanel item={item} interactive={interactive} />;
    case "failed":
    case "retake_later":
    case "no_show":
      return <SetbackPanel item={item} interactive={interactive} />;
    case "badge_revoked":
      return <RevokedPanel item={item} />;
  }
}

const PANEL_TONES = {
  neutral: "bg-ink-100/60",
  brand: "bg-gradient-to-br from-brand-50 to-white ring-1 ring-brand-100",
  sky: "bg-gradient-to-br from-sky-50 to-white ring-1 ring-sky-100",
  emerald: "bg-gradient-to-br from-emerald-50 via-emerald-50/60 to-white ring-1 ring-emerald-100",
  amber: "bg-gradient-to-br from-amber-50 to-white ring-1 ring-amber-100",
  rose: "bg-gradient-to-br from-rose-50 to-white ring-1 ring-rose-100",
  slate: "bg-slate-100 ring-1 ring-slate-200",
};

const ICON_TONES = {
  neutral: "bg-white text-ink-600",
  brand: "bg-brand-600 text-white",
  sky: "bg-sky-500 text-white",
  emerald: "bg-emerald-500 text-white",
  amber: "bg-amber-500 text-white",
  rose: "bg-rose-500 text-white",
  slate: "bg-slate-500 text-white",
};

function Panel({
  tone,
  icon,
  title,
  children,
  actions,
}: {
  tone: keyof typeof PANEL_TONES;
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={clsx("rounded-xl p-4 sm:p-5", PANEL_TONES[tone])}>
      <div className="flex gap-3.5">
        <div className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", ICON_TONES[tone])}>{icon}</div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[17px] font-bold leading-snug text-ink-950">{title}</h3>
          <div className="mt-1 space-y-3 text-sm leading-relaxed text-ink-700">{children}</div>
          {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

function LockedPanel({ item }: { item: BadgeJourney }) {
  const done = item.skills.filter((s) => s.cleared).length;
  const left = item.skills.length - done;

  return (
    <Panel
      tone="neutral"
      icon={<Lock className="h-5 w-5" />}
      title={`Clear ${left} more skill${left === 1 ? "" : "s"} to unlock your interview`}
    >
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white ring-1 ring-ink-200">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${(done / item.skills.length) * 100}%` }} />
        </div>
        <span className="text-xs font-semibold text-ink-600">
          {done}/{item.skills.length} skills
        </span>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {item.skills.map((s) => (
          <li
            key={s.id}
            className={clsx(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              s.cleared ? "bg-emerald-100 text-emerald-800" : "bg-white text-ink-500 ring-1 ring-inset ring-ink-200",
            )}
          >
            {s.cleared ? "✓ " : ""}
            {s.name}
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-500">Skills update here automatically as you clear GRIT skill contests.</p>
    </Panel>
  );
}

function EligiblePanel({ item }: { item: BadgeJourney }) {
  const { journey, badge, last_interview } = item;
  const attempt = journey.attempts_used + 1;
  if (journey.attempts_left === 0) {
    return (
      <div className="space-y-3">
        {item.pending_change && <PendingChangeNote change={item.pending_change} />}
        <Panel tone="slate" icon={<AlertTriangle className="h-5 w-5" />} title="No attempts left this season">
          <p>{item.block_reason}</p>
          <p className="text-xs text-ink-500">Think something went wrong? Contact the GRIT team.</p>
        </Panel>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {item.pending_change && <PendingChangeNote change={item.pending_change} />}
      {journey.priority_rebook && (
        <div className="flex gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>{priorityHeadline(last_interview)}</strong> It didn't use an attempt — pick a new slot and the GRIT
            team will prioritise you.
          </p>
        </div>
      )}
      <Panel
        tone="brand"
        icon={<Sparkles className="h-5 w-5" />}
        title={last_interview ? "You can book your next interview" : "You're eligible — book your interview"}
        actions={
          <LinkButton to={`/student/book/${badge.id}`} size="lg" icon={<CalendarCheck2 className="h-4 w-4" />}>
            Book a slot
          </LinkButton>
        }
      >
        <p>
          You've cleared every skill for the {badge.name} Track Badge. Pick a {badge.interview_minutes}-minute live slot
          with a GRIT interviewer.
        </p>
        <p className="text-xs font-medium text-ink-500">
          Attempt {attempt} of {badge.max_attempts} · You can reschedule or cancel up to 12 hours before.
        </p>
      </Panel>
    </div>
  );
}

function PendingChangeNote({ change }: { change: ChangeRequest }) {
  return (
    <div className="flex gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
      <Hourglass className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <strong>Emergency change under review.</strong> If the GRIT team approves it, no attempt is used; if not, this
        change counts as one attempt. <span className="text-amber-800/80">Your reason: “{change.reason}”</span>
      </p>
    </div>
  );
}

function priorityHeadline(last: Interview | null): string {
  switch (last?.status) {
    case "missed":
      return "Your last interview was missed — it was never started.";
    case "interviewer_absent":
      return "Sorry your interviewer didn't join last time.";
    case "excused":
      return "Your no-show was excused and the attempt given back.";
    case "cancelled_interviewer":
      return "Your interviewer had to cancel your last interview.";
    default:
      return "Your last interview didn't go ahead, through no fault of yours.";
  }
}

function BookedPanel({
  item,
  interview,
  now,
  interactive,
}: {
  item: BadgeJourney;
  interview: Interview;
  now: number;
  interactive: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reportingAbsent, setReportingAbsent] = useState(false);
  const cancel = useCancelInterview();
  const reportAbsent = useReportInterviewerAbsent();
  const toast = useToast();
  const start = Date.parse(interview.start_at);
  const end = Date.parse(interview.end_at);
  const live = item.journey.status === "in_progress" || (now >= start - 10 * 60_000 && now < end);
  const over = now >= end && item.journey.status === "booked";
  // The API decides when reporting an absent interviewer opens (15 min after the start).
  const absent = actionState(interview.student_actions.report_interviewer_absent, now);
  const canReportAbsent = interactive && absent.enabled;
  const canReschedule = interview.student_actions.reschedule.allowed;
  const canCancel = interview.student_actions.cancel.allowed;
  const canEmergency = interview.student_actions.emergency_change.allowed;
  const moved = Boolean(interview.moved_by_interviewer_at);

  return (
    <Panel
      tone={live ? "emerald" : "sky"}
      icon={live ? <Video className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />}
      title={
        over ? "Your slot has ended" : item.journey.status === "in_progress" && now >= end
          ? "Waiting for your interview result"
          : live
            ? "Your interview is happening now"
            : "You're booked!"
      }
      actions={
        <>
          <a
            href={interview.meeting_link}
            target="_blank"
            rel="noreferrer"
            className={clsx(
              "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white",
              live ? "animate-pulse-ring bg-emerald-600 hover:bg-emerald-700" : "bg-ink-900 hover:bg-ink-800",
            )}
          >
            <Video className="h-4 w-4" /> Join interview <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </a>
          {canReportAbsent && (
            <Button variant="ghost" onClick={() => setReportingAbsent(true)} icon={<UserX className="h-4 w-4" />}>
              My interviewer hasn't joined
            </Button>
          )}
          {canReschedule && (
            <LinkButton
              to={`/student/book/${item.badge.id}?reschedule=${interview.id}`}
              variant="secondary"
              icon={<RefreshCcw className="h-4 w-4" />}
            >
              Reschedule
            </LinkButton>
          )}
          {canCancel && (
            <Button variant="ghost" onClick={() => setConfirming(true)} icon={<CalendarX2 className="h-4 w-4" />}>
              Cancel
            </Button>
          )}
          {canEmergency && (
            <LinkButton
              to={`/student/book/${item.badge.id}?emergency=${interview.id}`}
              variant="ghost"
              icon={<Siren className="h-4 w-4" />}
            >
              Emergency change
            </LinkButton>
          )}
        </>
      }
    >
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{formatLongDay(interview.start_at)}</p>
          <p className="font-display text-2xl font-extrabold text-ink-950">
            {formatTime(interview.start_at)} <span className="text-base font-bold text-ink-500">IST</span>
          </p>
        </div>
        <div className="pb-1 text-sm">
          <p className="font-medium text-ink-800">with {interview.interviewer.name}</p>
          <p className="flex items-center gap-1 text-ink-500">
            <Clock className="h-3.5 w-3.5" /> {relativeFromNow(interview.start_at, now)} · Attempt {interview.attempt_no} of{" "}
            {item.badge.max_attempts}
          </p>
        </div>
      </div>
      {over && (
        <p className="rounded-lg bg-white/70 px-3 py-2 text-[13px] text-ink-700 ring-1 ring-sky-200">
          If your interview didn't happen, use "My interviewer hasn't joined". If nobody does anything, it will be
          marked as missed shortly after the slot. Either way it won't cost you an attempt.
        </p>
      )}
      {interactive && live && !over && absent.upcoming && (
        <p className="text-xs text-ink-500">
          Interviewer not here yet? If they haven't joined by {formatTime(interview.student_actions.report_interviewer_absent.available_at ?? interview.start_at)}, you can report it here.
        </p>
      )}
      {moved && !over && (
        <p className="rounded-lg bg-white/70 px-3 py-2 text-[13px] text-ink-700 ring-1 ring-amber-200">
          <span className="font-semibold text-ink-900">Your interviewer moved this interview.</span>{" "}
          {interview.move_reason && <>“{interview.move_reason}” </>}
          If the new time doesn't suit you, reschedule or cancel — it's free until the interview starts.
        </p>
      )}
      {item.pending_change && <PendingChangeNote change={item.pending_change} />}
      <p className="text-xs text-ink-500">
        {changeHint({ moved, canReschedule, canCancel, canEmergency, left: item.reschedules_left })}{" "}
        {interactive && (
          <Link to={`/student/interviews/${interview.id}`} className="whitespace-nowrap font-semibold text-brand-700 hover:underline">
            View details
          </Link>
        )}
      </p>

      <Modal
        open={reportingAbsent}
        onClose={() => setReportingAbsent(false)}
        title="Your interviewer hasn't joined?"
        description={formatDateTime(interview.start_at)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReportingAbsent(false)}>
              Keep waiting
            </Button>
            <Button
              variant="danger"
              loading={reportAbsent.isPending}
              onClick={() =>
                reportAbsent.mutate(interview.id, {
                  onSuccess: () => {
                    setReportingAbsent(false);
                    toast.success("Reported", "This won't use an attempt. Book a new slot when you're ready.");
                  },
                  onError: (e) => toast.error("Couldn't report", errorMessage(e)),
                })
              }
            >
              Report and close interview
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          We'll close this interview, tell your interviewer and the GRIT team, and move you to the front of the queue to
          rebook. It won't count as one of your attempts. Only report this if you're in the meeting room and nobody has
          joined.
        </p>
      </Modal>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Cancel this interview?"
        description={formatDateTime(interview.start_at)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={cancel.isPending}
              onClick={() =>
                cancel.mutate(interview.id, {
                  onSuccess: () => {
                    setConfirming(false);
                    toast.success("Interview cancelled", "Book a new slot whenever you're ready.");
                  },
                  onError: (e) => toast.error("Couldn't cancel", errorMessage(e)),
                })
              }
            >
              Yes, cancel
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          Your slot will be released to other students. Cancelling doesn't use an attempt, and you can book again
          straight away.
        </p>
      </Modal>
    </Panel>
  );
}

function changeHint(o: { moved: boolean; canReschedule: boolean; canCancel: boolean; canEmergency: boolean; left: number }) {
  if (o.moved && o.canReschedule) return "Join 5 minutes early. Changes are free until the interview starts.";
  if (o.canReschedule) return `Join 5 minutes early. You can reschedule (${o.left} left) or cancel up to 12 hours before.`;
  if (o.canCancel) return "Join 5 minutes early. You've used your reschedules; you can still cancel up to 12 hours before.";
  if (o.canEmergency)
    return "Join 5 minutes early. Normal changes are closed — for a real emergency, use Emergency change (the GRIT team reviews it).";
  return "Join 5 minutes early.";
}

function useCelebrate(key: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !key) return;
    const storageKey = `grit.celebrated.${key}`;
    try {
      if (localStorage.getItem(storageKey)) return;
      localStorage.setItem(storageKey, "1");
    } catch {
      return;
    }
    confetti({ particleCount: 140, spread: 80, origin: { y: 0.35 }, colors: ["#6366F1", "#10B981", "#F59E0B", "#A3A9FB"] });
  }, [key, enabled]);
}

function PassedPanel({ item, interactive }: { item: BadgeJourney; interactive: boolean }) {
  const interview = item.last_interview;
  useCelebrate(interview?.id, interactive);
  return (
    <Panel
      tone="emerald"
      icon={<PartyPopper className="h-5 w-5" />}
      title="Congratulations — you passed!"
      actions={
        interactive && (
          <LinkButton to="/student/badges" variant="success" icon={<ArrowRight className="h-4 w-4" />}>
            See it on your profile
          </LinkButton>
        )
      }
    >
      <p>
        Your <strong>{item.badge.name}</strong> Track Badge is now live on your GRIT profile. Your interviewer's
        feedback is below.
      </p>
      {interview?.outcome && (
        <>
          <ScoreBars scores={interview.outcome.scores} />
          <FeedbackQuote outcome={interview.outcome} interviewer={interview.interviewer.name} />
        </>
      )}
    </Panel>
  );
}

function SetbackPanel({ item, interactive }: { item: BadgeJourney; interactive: boolean }) {
  const { journey, badge, last_interview: interview } = item;
  const exhausted = journey.attempts_left === 0;
  const reopen = journey.eligible_again_at ? formatShortDate(journey.eligible_again_at) : null;

  const copy = {
    retake_later: {
      tone: "amber" as const,
      icon: <RefreshCcw className="h-5 w-5" />,
      title: "You're almost there.",
      body: `Your interviewer suggested a retake for the ${badge.name} badge. You can book your next interview from ${reopen}. This won't count against you.`,
    },
    failed: {
      tone: "rose" as const,
      icon: <AlertTriangle className="h-5 w-5" />,
      title: exhausted ? "Not this time." : "Not this time — keep going.",
      body: exhausted
        ? `You've used all ${badge.max_attempts} attempts for this badge this season. Reach out to the GRIT team if you think something went wrong.`
        : `You didn't clear this interview. Use the feedback below, then book attempt ${journey.attempts_used + 1} of ${badge.max_attempts} from ${reopen}.`,
    },
    no_show: {
      tone: "amber" as const,
      icon: <CalendarX2 className="h-5 w-5" />,
      title: "We missed you.",
      body: exhausted
        ? `You missed your interview and have used all ${badge.max_attempts} attempts this season.`
        : `You didn't join your interview${interview ? ` on ${formatDateTime(interview.start_at)}` : ""}. It counts as attempt ${journey.attempts_used} of ${badge.max_attempts}. You can book a new slot from ${reopen}.`,
    },
  }[journey.status as "retake_later" | "failed" | "no_show"];

  return (
    <Panel
      tone={copy.tone}
      icon={copy.icon}
      title={copy.title}
      actions={
        interactive &&
        !exhausted && (
          <Button variant="secondary" disabled icon={<CalendarCheck2 className="h-4 w-4" />}>
            Booking opens {reopen}
          </Button>
        )
      }
    >
      <p>{copy.body}</p>
      {interview?.outcome && (
        <>
          <ScoreBars scores={interview.outcome.scores} />
          <FeedbackQuote outcome={interview.outcome} interviewer={interview.interviewer.name} />
        </>
      )}
      {journey.status === "no_show" && interview && <DisputeSection interview={interview} interactive={interactive} />}
      {!exhausted && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
          <RefreshCcw className="h-3.5 w-3.5" />
          {journey.attempts_left} attempt{journey.attempts_left === 1 ? "" : "s"} left this season
        </p>
      )}
    </Panel>
  );
}

function DisputeSection({ interview, interactive }: { interview: Interview; interactive: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const dispute = useDisputeNoShow();
  const toast = useToast();
  const canDispute = interview.student_actions.dispute.allowed;

  if (interview.dispute_resolution === "rejected") {
    return (
      <p className="rounded-lg bg-white/70 px-3 py-2 text-[13px] text-ink-700 ring-1 ring-rose-200">
        <span className="font-semibold text-ink-900">Your dispute wasn't accepted.</span>{" "}
        {interview.cancel_reason?.replace(/^Dispute rejected: /, "")}
      </p>
    );
  }
  if (interview.disputed_at) {
    return (
      <p className="rounded-lg bg-white/70 px-3 py-2 text-[13px] text-ink-700 ring-1 ring-amber-200">
        <span className="font-semibold text-ink-900">Dispute under review.</span> The GRIT team is checking what happened.
        If it's excused, the attempt is given back and you can book straight away.
      </p>
    );
  }
  if (!canDispute || !interactive) return null;

  const close = () => {
    setOpen(false);
    setReason("");
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-[13px] text-ink-700 ring-1 ring-amber-200">
        <span>Were you in the meeting? You can dispute this until {formatDateTime(interview.dispute_deadline)}.</span>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          I was there — dispute
        </Button>
      </div>
      <Modal
        open={open}
        onClose={close}
        title="Dispute this no-show"
        description={`${interview.badge.name} · ${formatDateTime(interview.start_at)}`}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              disabled={reason.trim().length < 20}
              loading={dispute.isPending}
              onClick={() =>
                dispute.mutate(
                  { id: interview.id, reason },
                  {
                    onSuccess: () => {
                      toast.success("Dispute sent", "The GRIT team will review it, usually within a working day.");
                      close();
                    },
                    onError: (e) => toast.error("Couldn't send dispute", errorMessage(e)),
                  },
                )
              }
            >
              Send to the GRIT team
            </Button>
          </>
        }
      >
        <Field
          label="What happened?"
          hint="When did you join, and what did you see? e.g. waiting in the lobby, nobody admitted you. Screenshots can be shared with the team later."
        >
          {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      </Modal>
    </>
  );
}

function RevokedPanel({ item }: { item: BadgeJourney }) {
  return (
    <Panel tone="slate" icon={<ShieldOff className="h-5 w-5" />} title={`Your ${item.badge.name} badge has been revoked`}>
      <p>
        After a review, this Track Badge was nullified due to a malpractice finding
        {item.earned?.revoked_at && <> on {formatDate(item.earned.revoked_at)}</>}. It no longer appears on your GRIT
        profile.
      </p>
      {item.earned?.revoke_reason && (
        <p className="rounded-lg bg-white/70 px-3 py-2 text-[13px] text-ink-600 ring-1 ring-slate-200">
          <span className="font-semibold text-ink-800">Reason: </span>
          {item.earned.revoke_reason}
        </p>
      )}
      <p className="text-xs text-ink-500">Think this is a mistake? Contact the GRIT team to appeal.</p>
    </Panel>
  );
}
