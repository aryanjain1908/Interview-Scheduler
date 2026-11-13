import clsx from "clsx";
import { Check, ChevronLeft, ChevronRight, RotateCcw, Search, ShieldOff, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { useAllowRebooking, useSetSkillCleared, useStudentDirectory, useStudentRecord } from "../../api/admin";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card, PageHeader } from "../../components/ui/Card";
import { Field, Input, Textarea } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { JourneyPill } from "../../components/ui/Pill";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { NullifyBadgeModal } from "../../features/integrity/IntegrityModals";
import { BadgeMedallion, medallionState } from "../../features/student/BadgeMedallion";
import { errorMessage } from "../../lib/api";
import { formatDate, formatDateTime } from "../../lib/format";
import type { BadgeJourney } from "../../lib/types";

const PAGE_SIZE = 25;
const COOLDOWN = new Set(["failed", "retake_later", "no_show"]);

export default function AdminRecords() {
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchText);
      setPage(0);
    }, 250);
    return () => window.clearTimeout(id);
  }, [searchText]);

  const { data, isLoading, error } = useStudentDirectory(search, page, PAGE_SIZE);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <PageHeader
        eyebrow="Interview team"
        title="Student records"
        description="Look up any student, check their skill clears for each badge, and correct records when the contest sync misses something."
        action={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Name, email, college"
              className="w-64 pl-9"
            />
          </div>
        }
      />

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : error ? (
        <ErrorState error={errorMessage(error)} />
      ) : !data?.items.length ? (
        <Card>
          <EmptyState icon={<Users className="h-5 w-5" />} title="No students found">
            Try a different name, email or college.
          </EmptyState>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="table-base min-w-[760px]">
            <thead>
              <tr>
                <th>Student</th>
                <th>Badges</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.student.id} className="cursor-pointer hover:bg-ink-100/40" onClick={() => setOpenId(row.student.id)}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={row.student.name} size="sm" />
                      <div>
                        <p className="font-semibold text-ink-900">{row.student.name}</p>
                        <p className="text-xs text-ink-500">
                          {row.student.email}
                          {row.student.college && <> · {row.student.college}</>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      {row.journeys.map((j) => (
                        <span key={j.journey_id} className="flex items-center gap-1.5 text-xs text-ink-600">
                          <span className="font-medium">{j.badge.name}</span>
                          <JourneyPill status={j.status} />
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="text-right">
                    <Button size="sm" variant="secondary">
                      Open record
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 text-xs text-ink-500">
            <span>
              {data.total} student{data.total === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>
                Page {page + 1} of {pages}
              </span>
              <Button size="sm" variant="ghost" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      <StudentRecordModal studentId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function StudentRecordModal({ studentId, onClose }: { studentId: string | null; onClose: () => void }) {
  const { data, isLoading, error } = useStudentRecord(studentId);
  return (
    <Modal
      open={Boolean(studentId)}
      onClose={onClose}
      size="lg"
      title={data?.student.name ?? "Student record"}
      description={data ? [data.student.email, data.student.college].filter(Boolean).join(" · ") : undefined}
    >
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : error || !data ? (
        <ErrorState error={errorMessage(error)} />
      ) : (
        <div className="space-y-4">
          {data.journeys.map((j) => (
            <BadgeRecord key={j.journey.id} studentId={data.student.id} studentName={data.student.name} item={j} />
          ))}
        </div>
      )}
    </Modal>
  );
}

function BadgeRecord({ studentId, studentName, item }: { studentId: string; studentName: string; item: BadgeJourney }) {
  const setSkill = useSetSkillCleared();
  const toast = useToast();
  const [rebooking, setRebooking] = useState(false);
  const [nullifying, setNullifying] = useState(false);
  const { journey, badge } = item;
  const locked = journey.status === "booked" || journey.status === "in_progress";

  return (
    <div className="rounded-xl ring-1 ring-ink-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <BadgeMedallion badge={badge} state={medallionState(journey.status)} size="sm" />
          <div>
            <p className="font-semibold text-ink-900">{badge.name}</p>
            <p className="text-xs text-ink-500">
              Attempts used {journey.attempts_used} of {badge.max_attempts}
              {item.current_interview && <> · Interview {formatDateTime(item.current_interview.start_at)}</>}
              {item.earned?.status === "active" && <> · Earned {formatDate(item.earned.awarded_at)}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <JourneyPill status={journey.status} />
          {item.earned?.status === "active" && (
            <Button size="sm" variant="danger" icon={<ShieldOff className="h-3.5 w-3.5" />} onClick={() => setNullifying(true)}>
              Nullify badge
            </Button>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Skill clears</p>
        <div className="flex flex-wrap gap-1.5">
          {item.skills.map((s) => (
            <button
              key={s.id}
              disabled={setSkill.isPending || (locked && s.cleared)}
              title={locked && s.cleared ? "Can't remove while an interview is booked" : s.cleared ? "Mark as not cleared" : "Record as cleared"}
              onClick={() =>
                setSkill.mutate(
                  { studentId, skillId: s.id, cleared: !s.cleared },
                  {
                    onSuccess: () => toast.success(s.cleared ? `Removed “${s.name}”` : `Recorded “${s.name}” as cleared`),
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }
              className={clsx(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                s.cleared
                  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                  : "bg-white text-ink-500 ring-1 ring-inset ring-ink-200 hover:ring-brand-400 hover:text-brand-700",
              )}
            >
              {s.cleared && <Check className="h-3 w-3" />}
              {s.name}
            </button>
          ))}
        </div>
        {COOLDOWN.has(journey.status) && journey.attempts_left > 0 && journey.eligible_again_at && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
            <span>Can rebook from {formatDate(journey.eligible_again_at)}.</span>
            <Button size="sm" variant="secondary" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => setRebooking(true)}>
              Allow rebooking now
            </Button>
          </div>
        )}
      </div>
      <NullifyBadgeModal
        target={nullifying && item.earned ? { id: item.earned.id, studentName: studentName, badgeName: badge.name } : null}
        onClose={() => setNullifying(false)}
      />
      {rebooking && <AllowRebookingModal journeyId={journey.id} badgeName={badge.name} onClose={() => setRebooking(false)} />}
    </div>
  );
}

function AllowRebookingModal({ journeyId, badgeName, onClose }: { journeyId: string; badgeName: string; onClose: () => void }) {
  const allow = useAllowRebooking();
  const toast = useToast();
  const [reason, setReason] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title="Allow early rebooking?"
      description={badgeName}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={reason.trim().length < 10}
            loading={allow.isPending}
            onClick={() =>
              allow.mutate(
                { journeyId, reason },
                {
                  onSuccess: () => {
                    toast.success("Booking reopened", "The student has been notified.");
                    onClose();
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                },
              )
            }
          >
            Reopen booking
          </Button>
        </>
      }
    >
      <Field label="Reason" hint="Saved to the student's audit trail. Attempts already used are not refunded.">
        {(id) => (
          <Textarea
            id={id}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Verified power outage during the interview"
          />
        )}
      </Field>
    </Modal>
  );
}
