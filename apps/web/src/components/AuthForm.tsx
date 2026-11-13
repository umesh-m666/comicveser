"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth, User } from "./AuthProvider";
import GoogleSignInButton from "./GoogleSignInButton";
import { safeNext } from "@/lib/auth-redirect";
import { ComicVerseLogo } from "./ComicVerseLogo";

export type Mode = "login" | "register" | "forgot" | "reset" | "verify";

const CFG: Record<
  Mode,
  { title: string; cta: string; path: string; fields: string[]; done?: string }
> = {
  login: {
    title: "Welcome back",
    cta: "Log in",
    path: "/auth/login",
    fields: ["email", "password"],
  },
  register: {
    title: "Create your account",
    cta: "Create account",
    path: "/auth/register",
    fields: ["username", "email", "password", "confirmPassword"],
    done: "Account created. Check your email for a verification link, then log in.",
  },
  forgot: {
    title: "Reset your password",
    cta: "Send reset link",
    path: "/auth/forgot-password",
    fields: ["email"],
    done: "If an account exists for that email, a reset link is on its way.",
  },
  reset: {
    title: "Choose a new password",
    cta: "Save password",
    path: "/auth/reset-password",
    fields: ["password"],
    done: "Password updated. You can log in now.",
  },
  verify: {
    title: "Verify your email",
    cta: "Verify email",
    path: "/auth/verify-email",
    fields: [],
    done: "Email verified. You can log in now.",
  },
};

export default function AuthForm({ mode, token }: { mode: Mode; token?: string }) {
  const c = CFG[mode];
  const router = useRouter();
  const auth = useAuth();
  const [form, setForm] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const [dest, setDest] = useState("/");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setDest(safeNext(q.get("next")));
    setExpired(q.get("expired") === "1");
  }, []);

  useEffect(() => {
    if ((mode === "login" || mode === "register") && auth.status === "authenticated") {
      router.replace(dest);
    }
  }, [mode, auth.status, dest, router]);

  const handleAuthenticatedSuccess = (loggedInUser: User | null) => {
    const target = dest === "/" && loggedInUser?.role === "ADMIN" ? "/" : dest;
    router.replace(target);
    router.refresh();
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (mode === "register" && form.password !== form.confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }
    if ((mode === "reset" || mode === "verify") && !token) {
      setErr("This link is missing its token. Open the link from your email again.");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ ok?: boolean; token?: string; user?: User }>(c.path, {
        method: "POST",
        json: token ? { ...form, token } : form,
        credentials: "include",
      });
      if (mode === "login") {
        const loggedInUser = await auth.applyLogin(res?.user ?? null, res?.token ?? null);
        handleAuthenticatedSuccess(loggedInUser);
        return;
      }
      if (c.done) {
        setDone(c.done);
        return;
      }
      router.push("/login");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.details?.length) {
        setErr(e.details.join(" "));
      } else {
        setErr((e as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="rounded-xl border border-line bg-card p-6 space-y-5 shadow-lg">
        <div className="flex flex-col items-center text-center space-y-2 pb-1">
          <Link
            href="/"
            aria-label="ComicVerse home"
            className="inline-flex items-center justify-center rounded-2xl bg-[#2F2250] px-5 py-3.5 border border-white/15 shadow-md transition hover:border-primary/60"
          >
            <ComicVerseLogo className="h-14 w-auto" />
          </Link>
          <h1 className="text-2xl font-bold pt-1">{c.title}</h1>
          {mode === "login" && (
            <p className="text-sm text-muted">
              Sign in with your email and password or continue with Google.
            </p>
          )}
          {mode === "register" && (
            <p className="text-sm text-muted">
              Join ComicVerse with Google in one click or register with your email.
            </p>
          )}
        </div>

        {mode === "login" && (expired || auth.expired) && !err && (
          <p role="status" className="rounded-md bg-surface p-3 text-sm text-muted">
            Your session expired. Log in again to continue.
          </p>
        )}

        {err && (
          <p role="alert" className="rounded-md bg-danger/15 p-3 text-sm text-danger">
            {err}
          </p>
        )}

        {done ? (
          <div className="space-y-3">
            <p role="status" className="text-sm text-emerald-400">
              {done}
            </p>
            <Link href="/login" className="inline-block text-sm font-semibold text-primary">
              Back to log in
            </Link>
          </div>
        ) : (
          <>
            {(mode === "login" || mode === "register") && (
              <div className="space-y-4">
                <GoogleSignInButton
                  mode={mode}
                  onSuccess={handleAuthenticatedSuccess}
                  onError={(message) => setErr(message)}
                />
                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-line" />
                  <span className="mx-3 flex-shrink text-xs uppercase tracking-wider text-muted">
                    or continue with email
                  </span>
                  <div className="flex-grow border-t border-line" />
                </div>
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              {c.fields.map((f) => (
                <label key={f} className="block space-y-1 text-sm">
                  <span className="capitalize text-muted">
                    {f === "confirmPassword" ? "Confirm password" : f}
                  </span>
                  <input
                    required
                    name={f}
                    type={f.toLowerCase().includes("password") ? "password" : f === "email" ? "email" : "text"}
                    autoComplete={
                      f === "email"
                        ? "email"
                        : f === "username"
                        ? "username"
                        : f === "password" && mode === "login"
                        ? "current-password"
                        : "new-password"
                    }
                    value={form[f] ?? ""}
                    onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 outline-none focus:border-primary"
                  />
                </label>
              ))}
              <button
                disabled={busy}
                className="w-full rounded-lg bg-primary py-2.5 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
              >
                {busy ? "Please wait..." : c.cta}
              </button>
            </form>
          </>
        )}

        <div className="flex justify-between text-xs text-muted pt-1">
          {mode === "login" && (
            <>
              <Link href="/register" className="hover:text-fg">
                Create account
              </Link>
              <Link href="/forgot-password" className="hover:text-fg">
                Forgot password?
              </Link>
            </>
          )}
          {mode === "register" && (
            <Link href="/login" className="hover:text-fg">
              Already have an account? Log in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
