import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { HOME_FOR_ROLE, useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Field";
import { errorMessage } from "../../lib/api";
import { AuthLayout } from "./AuthLayout";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  if (user) return <Navigate to={HOME_FOR_ROLE[user.role]} replace />;

  const signIn = async (e: string, p: string, key: string) => {
    setError(null);
    setPending(key);
    try {
      const u = await login(e, p);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from?.startsWith(HOME_FOR_ROLE[u.role]) ? from : HOME_FOR_ROLE[u.role], { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    signIn(email, password, "form");
  };

  return (
    <AuthLayout>
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink-950">Welcome back</h2>
      <p className="mt-1 text-sm text-ink-500">Log in to book or run GRIT interviews.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label="Email">
          {(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@niat.in" />}
        </Field>
        <Field label="Password">
          {(id) => <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={pending === "form"}>
          Log in
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-500">
        New here?{" "}
        <Link to="/signup" className="font-semibold text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>

    </AuthLayout>
  );
}
