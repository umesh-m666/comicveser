"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";

type Mode = "login" | "register" | "forgot" | "reset" | "verify";
const F = {
  email: { name: "email", label: "Email", type: "email", auto: "email" },
  password: { name: "password", label: "Password", type: "password", auto: "current-password" },
  newPassword: { name: "password", label: "New password (10+ characters)", type: "password", auto: "new-password" },
  username: { name: "username", label: "Username", type: "text", auto: "username" },
  confirm: { name: "confirmPassword", label: "Confirm password", type: "password", auto: "new-password" },
};
const CFG: Record<Mode, { title: string; endpoint: string; submit: string; fields: (typeof F)[keyof typeof F][]; done: string }> = {
  login: { title: "Log in", endpoint: "/auth/login", submit: "Log in", fields: [F.email, F.password], done: "" },
  register: { title: "Create your account", endpoint: "/auth/register", submit: "Create account",
    fields: [F.username, F.email, { ...F.password, label: "Password (10+ characters)", auto: "new-password" }, F.confirm], done: "Account created. Check your email for a verification link, then log in." },
  forgot: { title: "Reset your password", endpoint: "/auth/forgot-password", submit: "Send reset link", fields: [F.email], done: "If that email has an account, a reset link is on its way." },
  reset: { title: "Choose a new password", endpoint: "/auth/reset-password", submit: "Update password", fields: [F.newPassword], done: "Password updated. You can log in now." },
  verify: { title: "Verify your email", endpoint: "/auth/verify-email", submit: "Verify email", fields: [], done: "Email verified." },
};

export default function AuthForm({ mode, token }: { mode: Mode; token?: string }) {
  const c = CFG[mode]; const router = useRouter();
  const [pending, setPending] = useState(false); const [errors, setErrors] = useState<string[]>([]); const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErrors([]);
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (mode === "register" && data.password !== data.confirmPassword) return setErrors(["Passwords do not match."]);
    if ((mode === "reset" || mode === "verify") && !token) return setErrors(["This link is missing its token. Open the link from your email again."]);
    setPending(true);
    try {
      await api(c.endpoint, { method: "POST", json: token ? { ...data, token } : data, credentials: "include" });
      if (mode === "login") { router.push("/"); router.refresh(); } else setDone(true);
    } catch (err) {
      setErrors(err instanceof ApiError ? (err.details?.length ? err.details : [err.message]) : ["Something went wrong. Try again."]);
    } finally { setPending(false); }
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="text-2xl font-bold">{c.title}</h1>
      {done ? (
        <div className="mt-4"><p role="status" className="text-success">{c.done}</p><Link href="/login" className="mt-4 inline-block text-primary">Go to log in</Link></div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3" noValidate={false}>
          {c.fields.map((f) => (
            <label key={f.name} className="block text-sm"><span className="mb-1 block text-muted">{f.label}</span>
              <input name={f.name} type={f.type} autoComplete={f.auto} required className="w-full rounded-md border border-line bg-surface px-3 py-2" />
            </label>
          ))}
          {errors.length > 0 && <ul role="alert" className="space-y-1 text-sm text-danger">{errors.map((m) => <li key={m}>{m}</li>)}</ul>}
          <button disabled={pending} className="w-full rounded-md bg-primary py-2.5 font-semibold disabled:opacity-60">{pending ? "Please wait..." : c.submit}</button>
          <p className="text-sm text-muted">
            {mode === "login" && <><Link href="/forgot-password" className="text-primary">Forgot password?</Link> · <Link href="/register" className="text-primary">Create account</Link></>}
            {mode === "register" && <>Already have an account? <Link href="/login" className="text-primary">Log in</Link></>}
          </p>
        </form>
      )}
    </div>
  );
}
