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
