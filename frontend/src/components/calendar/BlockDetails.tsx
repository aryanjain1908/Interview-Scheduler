import { CalendarDays, Video } from "lucide-react";
import { ReactNode } from "react";

import { formatLongDay, formatTime } from "../../lib/format";
import { Avatar } from "../ui/Avatar";
import { LinkButton } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { InterviewPill, OutcomePill } from "../ui/Pill";
import { BOOKING_NOTICE_MIN } from "../../lib/policy";
import type { CalendarBlock } from "./WeekCalendar";

export function BlockDetails({
  block,
  onClose,
  scheduleLink,
  footer,
}: {
  block: CalendarBlock | null;
  onClose: () => void;
  scheduleLink?: (dayKey: string) => string;
  footer?: ReactNode;
}) {
  if (!block) return null;
  const entry = block.entries[0]!;
  const interview = block.kind === "interview" ? entry.interview : null;
  const when = `${formatLongDay(block.startAt)} · ${formatTime(block.startAt)} – ${formatTime(block.endAt)} IST`;

  return (
    <Modal
      open
      onClose={onClose}
      title={interview ? `${interview.badge.name} interview` : DETAIL_TITLE[block.kind as keyof typeof DETAIL_TITLE]}
      description={when}
      footer={footer}
    >
      <div className="space-y-4 text-sm">
        {interview ? (
          <>
            <div className="flex items-center gap-3">
              <Avatar name={interview.student.name} />
              <div>
                <p className="font-semibold text-ink-900">{interview.student.name}</p>
                <p className="text-xs text-ink-500">
                  Attempt {interview.attempt_no} · with {entry.interviewer.name}
                </p>
              </div>
              <div className="ml-auto">
                {interview.result ? <OutcomePill result={interview.result} /> : <InterviewPill status={interview.status} />}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(interview.status === "scheduled" || interview.status === "in_progress") && (
                <a
                  href={interview.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-ink-900 px-3 text-[13px] font-semibold text-white hover:bg-ink-800"
                >
                  <Video className="h-4 w-4" /> Join
                </a>
              )}
              {scheduleLink && (
                <LinkButton to={scheduleLink(block.dayKey)} variant="secondary" size="sm" icon={<CalendarDays className="h-4 w-4" />}>
                  Open in schedule
                </LinkButton>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-2 text-ink-600">
            <p>
              <span className="font-semibold text-ink-900">{entry.interviewer.name}</span>{" "}
              {detailText(block.kind, block.entries.length)}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

const DETAIL_TITLE = {
  open: "Open availability",
  too_soon: "Too soon to book",
  expired: "Expired slot",
  blocked: "Blocked time",
};

function detailText(kind: CalendarBlock["kind"], count: number): string {
  const slots = `${count} slot${count === 1 ? "" : "s"}`;
  switch (kind) {
    case "open":
      return `has ${count} open slot${count === 1 ? "" : "s"} students can book.`;
    case "too_soon":
      return `has ${slots} starting too soon for students to book — bookings need ${BOOKING_NOTICE_MIN} minutes' notice. If you're free, open it for booking now and students can take it at short notice.`;
    case "expired":
      return `had ${slots} here that nobody booked.`;
    default:
      return `is unavailable for ${slots}.`;
  }
}
