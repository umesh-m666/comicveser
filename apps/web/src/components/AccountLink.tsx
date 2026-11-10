"use client";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import NotificationBell from "./NotificationBell";
import ProfileMenu from "./ProfileMenu";

/** Right-hand header actions on every screen size: bell + avatar menu when signed in, a Log in button otherwise. */
export default function AccountLink() {
  const { user, status } = useAuth();
  if (status === "loading") return <div className="h-10 w-10 animate-pulse rounded-full bg-card" aria-hidden />;
  if (!user) {
    return <Link href="/login" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-95">Log in</Link>;
  }
  return <div className="flex items-center gap-2"><NotificationBell /><ProfileMenu /></div>;
}
