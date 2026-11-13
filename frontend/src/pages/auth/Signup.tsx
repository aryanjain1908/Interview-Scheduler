import clsx from "clsx";
import { ClipboardList, GraduationCap, LucideIcon, Users } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { HOME_FOR_ROLE, useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Field";
import { errorMessage } from "../../lib/api";
import type { Role } from "../../lib/types";
import { TrackPicker } from "../../features/interviewer/TrackPicker";
import { AuthLayout } from "./AuthLayout";

const ROLES: { value: Role; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "student", label: "Student", hint: "Book interviews", icon: GraduationCap },
  { value: "interviewer", label: "Interviewer", hint: "Run interviews", icon: ClipboardList },
  { value: "admin", label: "Interview team", hint: "Track everyone", icon: Users },
];

export default function Signup() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", college: "", role: "student" as Role });
  const [badgeIds, setBadgeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={HOME_FOR_ROLE[user.role]} replace />;

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const u = await signup({
        ...form,
        college: form.role === "student" ? form.college : undefined,
        badge_ids: form.role === "interviewer" ? badgeIds : undefined,
      });
      navigate(HOME_FOR_ROLE[u.role], { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink-950">Create your account</h2>
      <p className="mt-1 text-sm text-ink-500">Book, run or manage GRIT Track Badge interviews.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-800">I am a…</p>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <button
                type="button"
                key={r.value}
                onClick={() => set({ role: r.value })}
                className={clsx(
                  "flex flex-col items-center rounded-xl border px-2 py-3 text-center transition",
                  form.role === r.value
                    ? "border-brand-600 bg-brand-50 ring-2 ring-brand-600/15"
                    : "border-ink-200 bg-white hover:border-ink-300",
                )}
              >
                <r.icon className={clsx("h-5 w-5", form.role === r.value ? "text-brand-600" : "text-ink-400")} />
                <span className="mt-1.5 text-[13px] font-semibold text-ink-900">{r.label}</span>
                <span className="text-[11px] text-ink-500">{r.hint}</span>
              </button>
            ))}
          </div>
        </div>
        {form.role === "interviewer" && (
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-ink-800">Tracks you can interview for</p>
            <TrackPicker value={badgeIds} onChange={setBadgeIds} />
            <p className="mt-1.5 text-xs text-ink-500">Students only see your slots for these badges. You can change this later.</p>
          </div>
        )}
        <Field label="Full name">
          {(id) => <Input id={id} required minLength={2} value={form.name} onChange={(e) => set({ name: e.target.value })} />}
        </Field>
        <Field label="Email">
          {(id) => <Input id={id} type="email" required value={form.email} onChange={(e) => set({ email: e.target.value })} />}
        </Field>
        {form.role === "student" && (
          <Field label="College" hint="Optional">
            {(id) => <Input id={id} value={form.college} onChange={(e) => set({ college: e.target.value })} placeholder="NIAT Hyderabad" />}
          </Field>
        )}
        <Field label="Password" hint="At least 6 characters">
          {(id) => (
            <Input id={id} type="password" required minLength={6} autoComplete="new-password" value={form.password} onChange={(e) => set({ password: e.target.value })} />
          )}
        </Field>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={loading}
          disabled={form.role === "interviewer" && badgeIds.length === 0}
        >
          Create account
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-500">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
