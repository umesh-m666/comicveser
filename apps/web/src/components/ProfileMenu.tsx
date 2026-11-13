"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { UserRound } from "lucide-react";
import { useDismiss } from "@/lib/useDismiss";
import { useLoad } from "@/lib/useApi";
import { useAuth } from "./AuthProvider";

export function UserAvatar({
  url,
  name,
  className = "",
}: {
  url?: string | null;
  name: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  if (url && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        onError={() => setBroken(true)}
        className={`h-full w-full object-cover ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span aria-hidden className={className}>
      {name.slice(0, 1).toUpperCase() || <UserRound size={18} />}
    </span>
  );
}

/**
 * Asura Profile Popup (.profile-menu):
 * Header: 56x56 avatar + username + email + GOLD ADMIN badge.
 * Items: Admin Panel (compact row for admins only), Profile, Messages, History, Settings — divider — Log out.
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

  const roleLabel = user.role.toUpperCase();
  const tab = open ? 0 : -1;

  return (
    <div ref={ref} className="avatar-wrap">
      <button
        type="button"
        className="s-avatar"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <UserAvatar url={profile.data?.avatarUrl} name={user.username} />
      </button>

      <div
        role="menu"
        aria-label="Account"
        hidden={!open}
        data-layer="Profile Popup"
        className="profile-menu"
      >
        <div className="pm-head">
          <span className="pm-av overflow-hidden">
            <UserAvatar url={profile.data?.avatarUrl} name={user.username} />
          </span>
          <div style={{ minWidth: 0 }}>
            <span className="pm-name truncate">{user.username}</span>
            <span className="pm-mail truncate">{user.email}</span>
            <span className="pm-badge">★ {roleLabel}</span>
          </div>
        </div>

        <div className="pm-items">
          {isAdmin && (
            <Link
              role="menuitem"
              href="/admin"
              tabIndex={tab}
              className="pm-item pm-admin"
              onClick={close}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3l7 2.8V11c0 4.6-3 7.7-7 9.2C8 18.7 5 15.6 5 11V5.8z" />
                <path d="m9.2 11.6 2 2 3.6-3.8" />
              </svg>
              <span>Admin Panel</span>
            </Link>
          )}

          <Link role="menuitem" href="/account" tabIndex={tab} className="pm-item" onClick={close}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4.5 20.5c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5" />
            </svg>
            <span>Profile</span>
          </Link>

          <Link
            role="menuitem"
            href="/profile/notifications?tab=messages"
            tabIndex={tab}
            className="pm-item"
            onClick={close}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a8 8 0 0 1-8 8c-1.2 0-2.4-.3-3.4-.7L4 20l.8-3.8A8 8 0 1 1 21 12z" />
            </svg>
            <span>Messages</span>
          </Link>

          <Link
            role="menuitem"
            href="/profile/history"
            tabIndex={tab}
            className="pm-item"
            onClick={close}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3.5 12a8.5 8.5 0 1 1 2.5 6" />
              <path d="M3.5 12H7M3.5 12l2-2.5" />
              <path d="M12 8v4.2l3 1.8" />
            </svg>
            <span>History</span>
          </Link>

          <Link
            role="menuitem"
            href="/profile/settings"
            tabIndex={tab}
            className="pm-item"
            onClick={close}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3.2" />
              <path d="M19 12a7 7 0 0 0-.14-1.4l2-1.55-2-3.46-2.36.95a7 7 0 0 0-2.42-1.4L13.7 2.6h-3.4l-.38 2.54a7 7 0 0 0-2.42 1.4l-2.36-.95-2 3.46 2 1.55a7 7 0 0 0 0 2.8l-2 1.55 2 3.46 2.36-.95a7 7 0 0 0 2.42 1.4l.38 2.54h3.4l.38-2.54a7 7 0 0 0 2.42-1.4l2.36.95 2-3.46-2-1.55c.1-.45.14-.92.14-1.4z" />
            </svg>
            <span>Settings</span>
          </Link>
        </div>

        <div className="pm-div" />

        <button
          type="button"
          role="menuitem"
          tabIndex={tab}
          className="pm-item logout"
          onClick={() => {
            setOpen(false);
            void logout();
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
            <path d="M3 12h11M10 7l5 5-5 5" />
          </svg>
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}
