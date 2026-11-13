"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, LogOut, MessageSquare, Settings, ShieldCheck, UserRound } from "lucide-react";
import { useDismiss } from "@/lib/useDismiss";
import { useLoad } from "@/lib/useApi";
import { useAuth } from "./AuthProvider";

export function UserAvatar({ url, name, className = "" }: { url?: string | null; name: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  if (url && !broken) return <img src={url} alt="" onError={() => setBroken(true)} className={`h-full w-full object-cover ${className}`} referrerPolicy="no-referrer" />; // eslint-disable-line @next/next/no-img-element
  return <span aria-hidden className={className}>{name.slice(0, 1).toUpperCase() || <UserRound size={18} />}</span>;
}

/**
 * Account popup: avatar + name, then Admin Panel (administrators only), Profile, Messages, Alerts, Settings, Log out.
 * The Admin Panel item only decides what to *show*: the /admin pages and every /admin API call re-check the role server-side.
 */
export default function ProfileMenu() {
  const { user, isAdmin, logout } = useAuth();
  const profile = useLoad<{ avatarUrl: string | null }>(user ? "/user/profile" : null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  useEffect(() => setOpen(false), [path]);
  if (!user) return null;
  const roleLabel = user.role.charAt(0) + user.role.slice(1).toLowerCase();
  const tab = open ? 0 : -1;

  return (
    <div ref={ref} className="relative">
      <button type="button" className="cv-avatar" aria-label="Account menu" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <UserAvatar url={profile.data?.avatarUrl} name={user.username} />
      </button>
      <div role="menu" aria-label="Account" data-open={open} className="cv-menu">
        <div className="flex items-center gap-3 px-2.5 pb-2.5 pt-2">
          <span className="cv-avatar !h-11 !w-11 shrink-0 !shadow-[0_0_0_2px_rgba(168,85,247,.55)]"><UserAvatar url={profile.data?.avatarUrl} name={user.username} /></span>
          <div className="min-w-0">
            <p className="truncate font-bold text-white">{user.username}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <span className="mt-1 inline-block rounded-full border border-[rgba(168,85,247,.5)] px-2 text-[10px] font-bold uppercase tracking-wide text-[#e9d5ff]">{roleLabel}</span>
          </div>
        </div>
        <div className="cv-menu-sep" />
        {isAdmin && <Link role="menuitem" href="/admin" tabIndex={tab} data-tone="admin" className="cv-menu-item"><ShieldCheck size={18} aria-hidden />Admin Panel</Link>}
        <Link role="menuitem" href="/account" tabIndex={tab} className="cv-menu-item"><UserRound size={18} aria-hidden />Profile</Link>
        <Link role="menuitem" href="/profile/notifications?tab=messages" tabIndex={tab} className="cv-menu-item"><MessageSquare size={18} aria-hidden />Messages</Link>
        <Link role="menuitem" href="/profile/notifications?tab=chapters" tabIndex={tab} className="cv-menu-item"><Bell size={18} aria-hidden />Chapters & Alerts</Link>
        <Link role="menuitem" href="/profile/settings" tabIndex={tab} className="cv-menu-item"><Settings size={18} aria-hidden />Settings</Link>
        <div className="cv-menu-sep" />
        <button type="button" role="menuitem" tabIndex={tab} data-tone="danger" className="cv-menu-item" onClick={() => { setOpen(false); void logout(); }}><LogOut size={18} aria-hidden />Log out</button>
      </div>
    </div>
  );
}
