import { ShieldOff } from "lucide-react";
import { useState } from "react";

import { useNullifyBadge } from "../../api/admin";
import { useReportMalpractice } from "../../api/interviewer";
import { Button } from "../../components/ui/Button";
import { Field, Input, Textarea } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import { errorMessage } from "../../lib/api";

interface Target {
  id: string;
  studentName: string;
  badgeName: string;
}

function ReasonFields({
  reason,
  evidence,
  onReason,
  onEvidence,
  hint,
}: {
  reason: string;
  evidence: string;
  onReason: (v: string) => void;
  onEvidence: (v: string) => void;
  hint: string;
}) {
  return (
    <div className="space-y-4">
      <Field label="What happened?" hint={hint}>
        {(id) => (
          <Textarea
            id={id}
            value={reason}
            onChange={(e) => onReason(e.target.value)}
            placeholder="e.g. Proctoring review found a second person prompting answers off-camera."
          />
        )}
      </Field>
      <Field label="Evidence link (optional)">
        {(id) => <Input id={id} value={evidence} onChange={(e) => onEvidence(e.target.value)} placeholder="https://" />}
      </Field>
    </div>
  );
}

export function NullifyBadgeModal({ target, onClose }: { target: Target | null; onClose: () => void }) {
  const nullify = useNullifyBadge();
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
      open={Boolean(target)}
      onClose={close}
      title="Nullify this badge?"
      description={target ? `${target.studentName} · ${target.badgeName}` : ""}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="danger"
            icon={<ShieldOff className="h-4 w-4" />}
            disabled={reason.trim().length < 10}
            loading={nullify.isPending}
            onClick={() =>
              target &&
              nullify.mutate(
                { studentBadgeId: target.id, reason, evidence_url: evidence || null },
                {
                  onSuccess: () => {
                    toast.success("Badge nullified", `${target.studentName} has been notified.`);
                    close();
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                },
              )
            }
          >
            Nullify badge
          </Button>
        </>
      }
    >
      <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-800 ring-1 ring-rose-200">
        The badge is removed from the student's profile immediately and they're told why. If an appeal succeeds you can
        reinstate it from Malpractice.
      </p>
      <ReasonFields
        reason={reason}
        evidence={evidence}
        onReason={setReason}
        onEvidence={setEvidence}
        hint="Shown to the student as the reason. 10+ characters."
      />
    </Modal>
  );
}

export function ReportMalpracticeModal({ target, onClose }: { target: Target | null; onClose: () => void }) {
  const report = useReportMalpractice();
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
      open={Boolean(target)}
      onClose={close}
      title="Report malpractice"
      description={target ? `${target.studentName} · ${target.badgeName}` : ""}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 10}
            loading={report.isPending}
            onClick={() =>
              target &&
              report.mutate(
                { id: target.id, reason, evidence_url: evidence || null },
                {
                  onSuccess: () => {
                    toast.success("Report sent", "The interview team will review it.");
                    close();
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                },
              )
            }
          >
            Send report
          </Button>
        </>
      }
    >
      <ReasonFields
        reason={reason}
        evidence={evidence}
        onReason={setReason}
        onEvidence={setEvidence}
        hint="The student keeps the badge until the team reviews and upholds this. 10+ characters."
      />
    </Modal>
  );
}
