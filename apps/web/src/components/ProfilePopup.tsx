"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History, LayoutDashboard, LogOut, MessageSquare, Settings, ShieldCheck, UserRound } from "lucide-react";
import { api } from "@/lib/api";

export type PopupUser = { username: string; role: string };

export default function ProfilePopup({
  open,
  onClose,
  user,
  onLoggedOut,
}: {
  open: boolean;
  onClose: () => void;
  user: PopupUser | null;
  onLoggedOut: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  // /auth/me only returns username + role; email comes from /user/profile.
  useEffect(() => {
    if (!open || !user) return;
    let live = true;
    api<{ email: string }>("/user/profile", { credentials: "include" })
      .then((p) => live && setEmail(p.email))
      .catch(() => live && setEmail(null));
    return () => { live = false; };
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isAdmin = user?.role === "ADMIN";
  const items = [
    ...(isAdmin ? [{ href: "/admin", label: "Admin Panel", Icon: LayoutDashboard }] : []),
    { href: "/profile", label: "Profile", Icon: UserRound },
    { href: "/profile/messages", label: "Messages", Icon: MessageSquare },
    { href: "/profile/history", label: "History", Icon: History },
    { href: "/profile/settings", label: "Settings", Icon: Settings },
  ];

  async function logout() {
    try { await api("/auth/logout", { method: "POST", credentials: "include" }); } catch (e) { console.error("Logout failed:", e); }
    onLoggedOut();
    onClose();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-line bg-[#17141f] p-2 shadow-2xl shadow-black/60" role="menu" aria-label="Profile menu">
      <div className="flex items-center gap-3 rounded-xl bg-card px-3 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-black text-white">
          {(user?.username ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-bold">
            {user?.username ?? "Account"}
            {isAdmin && <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white"><ShieldCheck size={10} /> Admin</span>}
          </p>
          {email && <p className="truncate text-xs text-muted">{email}</p>}
        </div>
      </div>
      <nav className="mt-1">
        {items.map(({ href, label, Icon }) => (
          <Link key={href} href={href} onClick={onClose} role="menuitem" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-card hover:text-fg">
            <Icon size={16} className="text-muted" /> {label}
          </Link>
        ))}
      </nav>
      <button type="button" onClick={logout} role="menuitem" className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-danger hover:bg-danger/10">
        <LogOut size={16} /> Log out
      </button>
    </div>
  );
}
