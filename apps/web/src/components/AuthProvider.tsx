"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, UNAUTHORIZED_EVENT, api, clearSessionToken, setSessionToken } from "@/lib/api";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
  permissions: string[];
  emailVerified: boolean;
  avatarUrl?: string | null;
  authProvider?: string;
}

export type User = AuthUser;

export type AuthStatus = "loading" | "authenticated" | "anonymous" | "error";

type Ctx = {
  user: AuthUser | null;
  status: AuthStatus;
  expired: boolean;
  isAdmin: boolean;
  refresh: () => Promise<AuthUser | null>;
  applyLogin: (loggedInUser?: AuthUser | null, token?: string | null) => Promise<AuthUser | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function useAuth(): Ctx {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be used inside <AuthProvider>.");
  return c;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [expired, setExpired] = useState(false);
  const userRef = useRef<AuthUser | null>(null);
  const inflight = useRef<Promise<AuthUser | null> | null>(null);
  userRef.current = user;

  const refresh = useCallback((): Promise<AuthUser | null> => {
    if (inflight.current) return inflight.current;
    const p = api<AuthUser>("/auth/me", { credentials: "include", cache: "no-store" })
      .then((u) => {
        userRef.current = u;
        setUser(u);
        setStatus("authenticated");
        setExpired(false);
        return u;
      })
      .catch((e) => {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          clearSessionToken();
          if (userRef.current) setExpired(true);
          userRef.current = null;
          setUser(null);
          setStatus("anonymous");
        } else {
          setStatus(userRef.current ? "authenticated" : "error");
        }
        return null;
      })
      .finally(() => {
        inflight.current = null;
      });
    inflight.current = p;
    return p;
  }, []);

  const applyLogin = useCallback(
    async (loggedInUser?: AuthUser | null, token?: string | null): Promise<AuthUser | null> => {
      if (token) {
        setSessionToken(token);
      }
      if (loggedInUser) {
        userRef.current = loggedInUser;
        setUser(loggedInUser);
        setStatus("authenticated");
        setExpired(false);
        return loggedInUser;
      }
      return refresh();
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onChange = () => {
      void refresh();
    };
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
    try {
      await api("/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // 401 means already signed out
    }
    clearSessionToken();
    userRef.current = null;
    setUser(null);
    setStatus("anonymous");
    setExpired(false);
    router.replace("/");
    router.refresh();
  }, [router]);

  const value = useMemo<Ctx>(
    () => ({
      user,
      status,
      expired,
      isAdmin: user?.role === "ADMIN",
      refresh,
      applyLogin,
      logout,
    }),
    [user, status, expired, refresh, applyLogin, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
