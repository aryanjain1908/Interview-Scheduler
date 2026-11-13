import clsx from "clsx";
import { BellRing, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { EligibleFilters, useBadges, useEligibleStudents, useNudge } from "../../api/team";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card, PageHeader } from "../../components/ui/Card";
import { Input, Segmented, Select } from "../../components/ui/Field";
import { JourneyPill, Pill } from "../../components/ui/Pill";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { errorMessage } from "../../lib/api";
import { daysSince, formatDateTime, relativeFromNow } from "../../lib/format";

type BookedFilter = EligibleFilters["booked"];

export default function BookingStatus() {
  const [params, setParams] = useSearchParams();
  const booked = (params.get("filter") as BookedFilter) || "all";
  const [badgeId, setBadgeId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(searchText), 250);
    return () => window.clearTimeout(id);
  }, [searchText]);

  const badges = useBadges();
  const rows = useEligibleStudents({ booked, badge_id: badgeId, search });
  const counts = useEligibleStudents({ booked: "all", badge_id: badgeId, search });
  const nudge = useNudge();
  const toast = useToast();
  const now = Date.now();

  const all = counts.data ?? [];
  const bookedCount = all.filter((r) => r.status !== "eligible").length;
  const data = rows.data ?? [];
  const nudgeable = data.filter((r) => r.status === "eligible");

  const setFilter = (value: BookedFilter) => {
    setSelected(new Set());
    setParams(value === "all" ? {} : { filter: value });
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sendNudge = () =>
    nudge.mutate([...selected], {
      onSuccess: ({ count }) => {
        toast.success(`Reminder sent to ${count} student${count === 1 ? "" : "s"}`);
        setSelected(new Set());
      },
      onError: (e) => toast.error(errorMessage(e)),
    });

  return (
    <div>
      <PageHeader
        eyebrow="Interview team"
        title="Booking status"
        description="Everyone who has cleared all skills for a badge — and whether they've booked their interview."
        action={
          <Button
            icon={<BellRing className="h-4 w-4" />}
            disabled={selected.size === 0}
            loading={nudge.isPending}
            onClick={sendNudge}
          >
            Send reminder{selected.size ? ` (${selected.size})` : ""}
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented<BookedFilter>
          value={booked}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: all.length },
            { value: "not_booked", label: "Not booked", count: all.length - bookedCount },
            { value: "booked", label: "Booked", count: bookedCount },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={badgeId} onChange={(e) => setBadgeId(e.target.value)} className="sm:w-44">
            <option value="">All badges</option>
            {badges.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Name, email, college" className="pl-9 sm:w-64" />
          </div>
        </div>
      </div>

      {rows.isLoading ? (
        <Skeleton className="h-80" />
      ) : rows.error ? (
        <ErrorState error={errorMessage(rows.error)} />
      ) : data.length === 0 ? (
        <Card>
          <EmptyState icon={<Users className="h-5 w-5" />} title="No students match">
            Try a different filter or search.
          </EmptyState>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="table-base min-w-[860px]">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all not-booked"
                    disabled={!nudgeable.length}
                    checked={nudgeable.length > 0 && nudgeable.every((r) => selected.has(r.journey_id))}
                    onChange={(e) => setSelected(e.target.checked ? new Set(nudgeable.map((r) => r.journey_id)) : new Set())}
                    className="h-4 w-4 rounded border-ink-300 accent-brand-600"
                  />
                </th>
                <th>Student</th>
                <th>Badge</th>
                <th>Status</th>
                <th>Waiting</th>
                <th>Attempt</th>
                <th>Interview</th>
                <th>Last reminder</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => {
                const waiting = daysSince(r.eligible_since, now);
                const canNudge = r.status === "eligible";
                return (
                  <tr key={r.journey_id} className={clsx(selected.has(r.journey_id) && "bg-brand-50/50")}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.student.name}`}
                        disabled={!canNudge}
                        checked={selected.has(r.journey_id)}
                        onChange={() => toggle(r.journey_id)}
                        className="h-4 w-4 rounded border-ink-300 accent-brand-600 disabled:opacity-30"
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.student.name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-semibold text-ink-900">{r.student.name}</p>
                          <p className="text-xs text-ink-500">{r.student.college ?? r.student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-ink-700">{r.badge.name}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <JourneyPill status={r.status} />
                        {r.priority_rebook && <Pill tone="amber">Priority</Pill>}
                      </div>
                    </td>
                    <td>
                      {waiting === null ? (
                        "—"
                      ) : (
                        <span className={clsx("font-medium tabular-nums", canNudge && waiting >= 5 ? "text-amber-700" : "text-ink-600")}>
                          {waiting} day{waiting === 1 ? "" : "s"}
                        </span>
                      )}
                    </td>
                    <td className="tabular-nums text-ink-600">#{r.attempt_no}</td>
                    <td className="whitespace-nowrap text-ink-600">
                      {r.next_interview_at ? (
                        <>
                          <p className="text-ink-900">{formatDateTime(r.next_interview_at)}</p>
                          <p className="text-xs text-ink-500">with {r.interviewer_name}</p>
                        </>
                      ) : (
                        <span className="text-ink-400">Not booked</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-xs text-ink-500">
                      {r.last_nudged_at ? relativeFromNow(r.last_nudged_at, now) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
