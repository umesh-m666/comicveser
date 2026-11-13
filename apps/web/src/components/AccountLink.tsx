"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Bell, LogOut, PenLine, UserRound } from "lucide-react";

type User = {
  username: string;
  role: string;
};

const pill =
  "group inline-flex items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2 text-sm font-medium text-fg transition-all duration-200 hover:border-primary active:scale-95";

export default function AccountLink() {
  const router = useRouter();
  const path = usePathname();

  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    let active = true;

    api<User>("/auth/me", { credentials: "include" })
      .then((data) => {
        if (!active) return;
        setUser(data);
        api<{ unread: number }>("/user/notifications", { credentials: "include" })
          .then((n) => active && setUnread(n.unread))
          .catch(() => {});
      })
      .catch(() => {
        if (active) setUser(null);
      });

    return () => {
      active = false;
    };
  }, []);

  // Re-check on every page change so the header updates right after login/logout.
  useEffect(() => refresh(), [path, refresh]);

  // Other components fire this after marking notifications as read.
  useEffect(() => {
    const onChange = () => {
      refresh();
    };
    window.addEventListener("cv:notifications", onChange);
    return () => window.removeEventListener("cv:notifications", onChange);
  }, [refresh]);

  const handleLogout = async () => {
    try {
      await api("/auth/logout", { method: "POST", credentials: "include" });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setUser(null);
      setUnread(0);
      router.push("/");
      router.refresh();
    }
  };

  if (user === undefined) {
    return <div className="hidden h-9 w-24 animate-pulse rounded-lg bg-card md:block" />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="hidden items-center justify-center rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-95 md:inline-flex"
      >
        Log in
      </Link>
    );
  }

  return (
    <div className="hidden items-center gap-2 md:flex">
      {/* Creator portal (everyone except admins; admins reach the panel via the profile popup) */}
      {user.role !== "ADMIN" && (
        <Link href="/creator/dashboard" className={pill}>
          <PenLine size={16} />
          <span>Creator</span>
        </Link>
      )}

      {/* Notifications */}
      <Link href="/profile/notifications" className={pill} aria-label={`Alerts${unread ? `, ${unread} unread` : ""}`}>
        <Bell size={16} />
        <span>Alerts</span>
        {unread > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-white">{unread}</span>
        )}
      </Link>

      {/* User Profile */}
      <Link href="/profile/bookmarks" className={pill}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-primary ring-1 ring-primary transition-transform duration-200 group-hover:scale-110">
          <UserRound size={16} />
        </span>
        <span className="max-w-28 truncate">{user.username}</span>
      </Link>

      {/* Logout */}
      <button
        type="button"
        onClick={handleLogout}
        className="group inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-muted transition-all duration-200 hover:bg-red-500/10 hover:text-red-500 active:scale-95"
      >
        <LogOut size={16} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
        <span>Log out</span>
      </button>
    </div>
  );
}
