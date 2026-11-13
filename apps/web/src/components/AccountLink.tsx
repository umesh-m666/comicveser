"use client";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import NotificationBell from "./NotificationBell";
import ProfileMenu from "./ProfileMenu";

/** Right-hand header actions on every screen size: bell + avatar menu when signed in, a Log in / Sign Up button otherwise. */
export default function AccountLink() {
  const { user, status } = useAuth();
  if (status === "loading") {
    return <div className="h-[42px] w-[42px] animate-pulse rounded-full bg-[#2b1d42]" aria-hidden />;
  }
  if (!user) {
    return (
      <Link href="/login" className="s-sign">
        <span aria-hidden="true">◉</span> Log in
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      <NotificationBell />
      <ProfileMenu />
    </div>
  );
}
