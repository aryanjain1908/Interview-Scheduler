import { Flag as FlagIcon, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";

import { useBadgeHolders, useFlags, useRaiseFlag, useResolveFlag } from "../../api/admin";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader, PageHeader } from "../../components/ui/Card";
import { Field, Input, Textarea } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { Pill } from "../../components/ui/Pill";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { NullifyBadgeModal } from "../../features/integrity/IntegrityModals";
import { errorMessage } from "../../lib/api";
import { formatDate } from "../../lib/format";
import type { BadgeHolder, Flag, FlagResolution } from "../../lib/types";

const RESOLUTION_PILL: Record<FlagResolution, { tone: "amber" | "rose" | "neutral"; label: string }> = {
  pending: { tone: "amber", label: "Under review" },
  upheld: { tone: "rose", label: "Upheld · badge revoked" },
  dismissed: { tone: "neutral", label: "Dismissed" },
};

export default function AdminFlags() {
  const holders = useBadgeHolders();
  const flags = useFlags();
  const [flagging, setFlagging] = useState<BadgeHolder | null>(null);
  const [nullifying, setNullifying] = useState<{ id: string; studentName: string; badgeName: string } | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Interview team"
        title="Malpractice"
        description="If malpractice comes to light after a pass, nullify the badge directly, or raise a flag to review first. Reports from interviewers land here too."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="Malpractice flags" subtitle="Newest first" className="pb-4" />
          {flags.isLoading ? (
            <Skeleton className="m-5 h-40" />
          ) : flags.error ? (
            <div className="p-5"><ErrorState error={errorMessage(flags.error)} /></div>
          ) : !flags.data?.length ? (
            <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title="No flags raised" />
          ) : (
            <ul className="divide-y divide-ink-100 border-t border-ink-100">
              {flags.data.map((f) => (
                <FlagItem key={f.id} flag={f} />
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Badge holders" subtitle="Everyone who has earned a Track Badge" className="pb-4" />
          {holders.isLoading ? (
            <Skeleton className="m-5 h-40" />
          ) : !holders.data?.length ? (
            <EmptyState icon={<ShieldAlert className="h-5 w-5" />} title="No badges awarded yet" />
          ) : (
            <table className="table-base border-t border-ink-100">
              <tbody>
                {holders.data.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={h.student.name} size="sm" />
                        <div>
                          <p className="font-semibold text-ink-900">{h.student.name}</p>
                          <p className="text-xs text-ink-500">
                            {h.badge.name} · {formatDate(h.awarded_at)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right">
                      {h.status === "revoked" ? (
                        <Pill tone="slate">Revoked</Pill>
                      ) : (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="ghost" icon={<FlagIcon className="h-3.5 w-3.5" />} onClick={() => setFlagging(h)}>
                            Raise flag
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            icon={<ShieldOff className="h-3.5 w-3.5" />}
                            onClick={() => setNullifying({ id: h.id, studentName: h.student.name, badgeName: h.badge.name })}
                          >
                            Nullify
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      <RaiseFlagModal holder={flagging} onClose={() => setFlagging(null)} />
      <NullifyBadgeModal target={nullifying} onClose={() => setNullifying(null)} />
    </div>
  );
}

function FlagItem({ flag }: { flag: Flag }) {
  const resolve = useResolveFlag();
  const toast = useToast();
  const meta = RESOLUTION_PILL[flag.resolution];
  const act = (resolution: FlagResolution, message: string) =>
    resolve.mutate(
      { id: flag.id, resolution },
      { onSuccess: () => toast.success(message), onError: (e) => toast.error(errorMessage(e)) },
    );

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Avatar name={flag.student.name} size="sm" />
          <div>
            <p className="font-semibold text-ink-900">{flag.student.name}</p>
            <p className="text-xs text-ink-500">
              {flag.badge.name} · raised {formatDate(flag.created_at)} by {flag.flagger.name}
            </p>
          </div>
        </div>
        <Pill tone={meta.tone}>{meta.label}</Pill>
      </div>
      <p className="mt-2 text-sm text-ink-700">{flag.reason}</p>
      {flag.evidence_url && (
        <a href={flag.evidence_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-brand-700 hover:underline">
          View evidence
        </a>
      )}
      <div className="mt-3 flex gap-2">
        {flag.resolution === "pending" && (
          <>
            <Button size="sm" variant="danger" loading={resolve.isPending} onClick={() => act("upheld", "Flag upheld — badge revoked")}>
              Uphold & revoke badge
            </Button>
            <Button size="sm" variant="ghost" disabled={resolve.isPending} onClick={() => act("dismissed", "Flag dismissed")}>
              Dismiss
            </Button>
          </>
        )}
        {flag.resolution === "upheld" && (
          <Button size="sm" variant="secondary" loading={resolve.isPending} onClick={() => act("dismissed", "Appeal accepted — badge reinstated")}>
            Accept appeal & reinstate
          </Button>
        )}
      </div>
    </li>
  );
}

function RaiseFlagModal({ holder, onClose }: { holder: BadgeHolder | null; onClose: () => void }) {
  const raise = useRaiseFlag();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");

  const close = () => {
    setReason("");
    setEvidence("");
    onClose();
  };

  return (
    <Modal
      open={Boolean(holder)}
      onClose={close}
      title="Raise a malpractice flag"
      description={holder ? `${holder.student.name} · ${holder.badge.name}` : ""}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 10}
            loading={raise.isPending}
            onClick={() =>
              holder &&
              raise.mutate(
                { student_id: holder.student.id, badge_id: holder.badge.id, reason, evidence_url: evidence || null },
                {
                  onSuccess: () => {
                    toast.success("Flag raised", "Review it and uphold or dismiss.");
                    close();
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                },
              )
            }
          >
            Submit flag
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="What happened?" hint="Nothing changes for the student until you uphold the flag. If upheld, this reason is shown to them.">
          {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Proctoring review found…" />}
        </Field>
        <Field label="Evidence link (optional)">
          {(id) => <Input id={id} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="https://" />}
        </Field>
      </div>
    </Modal>
  );
}
