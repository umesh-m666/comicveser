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

/** Right-hand header actions on every screen size: bell + avatar menu when signed in, a Log in button otherwise. */
export default function AccountLink() {
  const { user, status } = useAuth();
  if (status === "loading") return <div className="h-10 w-10 animate-pulse rounded-full bg-card" aria-hidden />;
  if (!user) {
    return <Link href="/login" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-95">Log in</Link>;
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
