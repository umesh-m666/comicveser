"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import { Bell, LogOut, PenLine, ShieldCheck, UserRound } from "lucide-react";

const pill =
  "group inline-flex items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2 text-sm font-medium text-fg transition-all duration-200 hover:border-primary active:scale-95";

/** Desktop header actions. Mobile uses the bottom navigation, which links to /account. */
export default function AccountLink() {
  const { user, status, logout } = useAuth();
  const [unread, setUnread] = useState(0);

  // Unread-alert badge; reloaded whenever the signed-in user changes or notifications are marked read.
  useEffect(() => {
    if (!user) { setUnread(0); return; }
    let live = true;
    const load = () => api<{ unread: number }>("/user/notifications", { credentials: "include" }).then((n) => live && setUnread(n.unread)).catch(() => {});
    load();
    window.addEventListener("cv:notifications", load);
    return () => { live = false; window.removeEventListener("cv:notifications", load); };
  }, [user]);

  if (status === "loading") return <div className="hidden h-9 w-24 animate-pulse rounded-lg bg-card md:block" />;

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
      {/* Admin Panel (admins) or Creator portal (everyone else) */}
      {user.role === "ADMIN" ? (
        <Link
          href="/admin"
          className="group inline-flex items-center gap-2 rounded-xl border border-purple-500/20 bg-purple-500/10 px-3.5 py-2 text-sm font-semibold text-purple-600 transition-all duration-200 hover:border-purple-500/40 hover:bg-purple-500/20 dark:text-purple-400"
        >
          <ShieldCheck size={17} />
          <span>Admin Panel</span>
        </Link>
      ) : (
        <Link href="/creator/dashboard" className={pill}>
          <PenLine size={16} />
          <span>Creator</span>
        </Link>
      )}

      <Link href="/profile/notifications" className={pill} aria-label={`Alerts${unread ? `, ${unread} unread` : ""}`}>
        <Bell size={16} />
        <span>Alerts</span>
        {unread > 0 && <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-white">{unread}</span>}
      </Link>

      {/* Account dashboard */}
      <Link href="/account" className={pill}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-primary ring-1 ring-primary transition-transform duration-200 group-hover:scale-110">
          <UserRound size={16} />
        </span>
        <span className="max-w-28 truncate">{user.username}</span>
      </Link>

      <button
        type="button"
        onClick={() => void logout()}
        className="group inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-muted transition-all duration-200 hover:bg-red-500/10 hover:text-red-500 active:scale-95"
      >
        <LogOut size={16} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
        <span>Log out</span>
      </button>
    </div>
  );
}
