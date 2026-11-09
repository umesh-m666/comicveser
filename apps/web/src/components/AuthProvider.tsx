"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, UNAUTHORIZED_EVENT, api } from "@/lib/api";

export type AuthUser = { id: string; username: string; email: string; role: string; permissions: string[]; emailVerified: boolean };
/** loading: first check not finished; error: backend unreachable (we do NOT treat that as logged out). */
export type AuthStatus = "loading" | "authenticated" | "anonymous" | "error";

type Ctx = {
  user: AuthUser | null; status: AuthStatus; expired: boolean; isAdmin: boolean;
  refresh: () => Promise<AuthUser | null>; logout: () => Promise<void>;
};
const AuthContext = createContext<Ctx | null>(null);

export function useAuth(): Ctx {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be used inside <AuthProvider>.");
  return c;
}

/** Single source of truth for "who is signed in", always read from the backend (GET /auth/me), never guessed. */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [expired, setExpired] = useState(false);
  const userRef = useRef<AuthUser | null>(null);
  const inflight = useRef<Promise<AuthUser | null> | null>(null);
  userRef.current = user;

  const refresh = useCallback((): Promise<AuthUser | null> => {
    if (inflight.current) return inflight.current; // collapse concurrent checks into one request
    const p = api<AuthUser>("/auth/me", { credentials: "include", cache: "no-store" })
      .then((u) => { setUser(u); setStatus("authenticated"); setExpired(false); return u; })
      .catch((e) => {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          // Session missing, expired, revoked, or account suspended.
          if (userRef.current) setExpired(true);
          setUser(null); setStatus("anonymous");
        } else {
          // Network/server problem: keep whatever we knew rather than logging a valid user out.
          setStatus(userRef.current ? "authenticated" : "error");
        }
        return null;
      })
      .finally(() => { inflight.current = null; });
    inflight.current = p;
    return p;
  }, []);

  // Initial check on load (also covers page refresh and opening a URL directly).
  useEffect(() => { void refresh(); }, [refresh]);

  // Re-verify when the tab regains focus, when any API call reports 401, and after profile/notification changes.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    const onChange = () => { void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(UNAUTHORIZED_EVENT, onChange);
    window.addEventListener("cv:notifications", onChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(UNAUTHORIZED_EVENT, onChange);
      window.removeEventListener("cv:notifications", onChange);
    };
  }, [refresh]);

  const logout = useCallback(async () => {
    try { await api("/auth/logout", { method: "POST", credentials: "include" }); } catch { /* 401 means already signed out */ }
    setUser(null); setStatus("anonymous"); setExpired(false);
    router.replace("/");
    router.refresh();
  }, [router]);

  const value = useMemo<Ctx>(() => ({ user, status, expired, isAdmin: user?.role === "ADMIN", refresh, logout }), [user, status, expired, refresh, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
