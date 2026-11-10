"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, BookOpen, Check, CheckCheck, ExternalLink, MessageSquare, ShieldAlert, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/comics";
import { act } from "@/lib/useApi";
import { useDismiss } from "@/lib/useDismiss";
import { useAuth } from "./AuthProvider";

interface PopupNotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
  meta?: {
    adminOnly?: boolean;
    event?: string;
    comicTitle?: string;
    providerName?: string;
    displayNumber?: string;
    originalLabel?: string | null;
    status?: "PUBLISHED" | "FAILED";
    sourceUrl?: string | null;
    chapterUrl?: string | null;
  } | null;
}

interface NotificationsApiResponse {
  unread: number;
  items: PopupNotificationItem[];
  prefs: { newChapter: boolean };
}

type PopupTab = "all" | "chapters" | "messages";

const POPUP_TABS: { key: PopupTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "chapters", label: "Chapters" },
  { key: "messages", label: "Messages" },
];

const TYPE_BADGES: Record<string, string> = {
  NEW_CHAPTER: "Chapter",
  BOOKMARK_UPDATE: "Bookmark",
  CREATOR_ANNOUNCEMENT: "Creator",
  REVIEW_REPLY: "Reply",
  ACCOUNT: "Account",
  PLATFORM: "Platform",
};

/**
 * Interactive Notification Bell Popup (Desktop Dropdown + Mobile Bottom Sheet).
 * Uses the unified ComicVerse palette:
 * - Dark background: #100E16
 * - Card background: #211B2D
 * - Primary purple: #9333EA
 * - Secondary purple: #A855F7
 * - Text: #FFFFFF
 * - Muted text: #A8A1B5
 */
export default function NotificationBell() {
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PopupTab>("all");
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<PopupNotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const close = useCallback(() => setOpen(false), []);
  useDismiss(containerRef, open, close);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const fetchNotifications = useCallback(
    async (activeTab: PopupTab, showSpinner = false) => {
      if (!user) {
        setUnread(0);
        setItems([]);
        return;
      }
      if (showSpinner) setLoading(true);
      setError(false);
      try {
        const query = activeTab === "all" ? "?page=1" : `?page=1&group=${activeTab}`;
        const res = await api<NotificationsApiResponse>(`/user/notifications${query}`, {
          credentials: "include",
          cache: "no-store",
        });
        setUnread(res.unread ?? 0);
        setItems(res.items ?? []);
      } catch {
        setError(true);
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [user],
  );

  // Initial unread badge fetch & live event listener
  useEffect(() => {
    if (!user) {
      setUnread(0);
      setItems([]);
      return;
    }
    let mounted = true;
    const reload = () => {
      if (mounted) void fetchNotifications(tab, false);
    };
    reload();
    window.addEventListener("cv:notifications", reload);
    return () => {
      mounted = false;
      window.removeEventListener("cv:notifications", reload);
    };
  }, [user, tab, fetchNotifications]);

  // Reload list when popup opens or tab changes
  useEffect(() => {
    if (open && user) {
      void fetchNotifications(tab, true);
    }
  }, [open, tab, user, fetchNotifications]);

  const markSingleRead = async (id: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, readAt: it.readAt ?? new Date().toISOString() } : it)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await act("/user/notifications/read", "POST", { ids: [id] });
      window.dispatchEvent(new Event("cv:notifications"));
    } catch {
      void fetchNotifications(tab, false);
    }
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((it) => ({ ...it, readAt: it.readAt ?? new Date().toISOString() })));
    setUnread(0);
    try {
      await act("/user/notifications/read", "POST", {});
      window.dispatchEvent(new Event("cv:notifications"));
    } catch {
      void fetchNotifications(tab, false);
    }
  };

  if (!user) return null;

  const emptyMessage =
    tab === "chapters"
      ? "No chapter updates yet. Bookmark a comic to get notified as soon as new chapters release."
      : tab === "messages"
      ? "No messages yet. Account notices, creator updates, and admin responses appear here."
      : "You're all caught up! New chapter releases and platform messages will appear here.";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="cv-iconbtn"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell size={18} aria-hidden />
        {unread > 0 && (
          <span className="cv-badge" aria-hidden>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Mobile backdrop scrim */}
      {open && (
        <div
          aria-hidden="true"
          onClick={close}
          className="fixed inset-0 z-40 bg-black/65 backdrop-blur-xs transition-opacity sm:hidden"
        />
      )}

      {/* Popup Panel: Responsive Bottom Sheet on Mobile, Dropdown on Desktop */}
      <div
        role="dialog"
        aria-label="Notifications"
        data-open={open}
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col overflow-hidden rounded-t-2xl border border-[#322A42] bg-[#100E16] text-white shadow-[0_24px_64px_rgba(0,0,0,0.85)] transition-all duration-200 sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-[calc(100%+0.65rem)] sm:max-h-[34rem] sm:w-[25rem] sm:rounded-2xl ${
          open
            ? " pointer-events-auto translate-y-0 opacity-100 scale-100 visible"
            : " pointer-events-none translate-y-3 sm:-translate-y-2 opacity-0 scale-95 invisible"
        }`}
      >
        {/* Mobile grabber handle */}
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-[#322A42] sm:hidden" aria-hidden />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#322A42] px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Bell size={17} className="text-[#A855F7]" aria-hidden />
            <h2 className="text-sm font-bold tracking-tight text-white">Notifications</h2>
            {unread > 0 && (
              <span className="rounded-full bg-[#9333EA] px-2 py-0.5 text-[11px] font-extrabold text-white">
                {unread} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1 rounded-lg bg-[#211B2D] px-2.5 py-1 text-xs font-semibold text-[#A855F7] transition hover:bg-[#9333EA] hover:text-white"
              >
                <CheckCheck size={13} aria-hidden />
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={close}
              aria-label="Close notifications"
              className="rounded-lg p-1 text-[#A8A1B5] hover:bg-[#211B2D] hover:text-white sm:hidden"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        </div>

        {/* Three Tabs: All | Chapters | Messages */}
        <div role="tablist" aria-label="Notification categories" className="grid grid-cols-3 gap-1.5 border-b border-[#322A42] bg-[#100E16] px-4 py-2.5">
          {POPUP_TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`rounded-xl py-1.5 text-xs font-bold transition ${
                  active
                    ? "bg-[#9333EA] text-white shadow-[0_4px_14px_rgba(147,51,234,0.45)]"
                    : "bg-[#211B2D] text-[#A8A1B5] hover:text-white"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Notification List Body */}
        <div className="min-h-[14rem] flex-1 overflow-y-auto px-3 py-2.5">
          {loading ? (
            <div className="space-y-2.5 py-1" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-[#211B2D]" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-[#322A42] bg-[#211B2D] p-6 text-center text-xs text-[#A8A1B5]">
              <p className="text-white font-semibold">Couldn&apos;t load notifications</p>
              <button
                type="button"
                onClick={() => void fetchNotifications(tab, true)}
                className="mt-2 rounded-lg bg-[#9333EA] px-3 py-1.5 font-semibold text-white hover:bg-[#A855F7]"
              >
                Retry
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[#322A42] bg-[#211B2D] px-5 py-8 text-center">
              {tab === "messages" ? (
                <MessageSquare size={26} className="text-[#A855F7]" aria-hidden />
              ) : (
                <BookOpen size={26} className="text-[#A855F7]" aria-hidden />
              )}
              <p className="mt-2.5 text-xs leading-relaxed text-[#A8A1B5]">{emptyMessage}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {items.slice(0, 12).map((n) => {
                const isUnread = !n.readAt;
                const isAdminAlert = n.meta?.adminOnly === true || n.title.startsWith("New chapter automatically published") || n.title.startsWith("[Admin Alert]");
                const isFailed = n.meta?.status === "FAILED" || n.title.includes("failed");
                const badgeLabel = isAdminAlert
                  ? isFailed
                    ? "Admin · Sync Failed"
                    : "Admin · Auto-Published"
                  : TYPE_BADGES[n.type] ?? "Update";

                return (
                  <li
                    key={n.id}
                    className={`group relative rounded-xl border p-3 transition ${
                      isUnread
                        ? "border-[#A855F7]/70 bg-[#211B2D] shadow-[0_0_0_1px_rgba(168,85,247,0.2)]"
                        : "border-[#322A42] bg-[#211B2D]/80 hover:border-[#9333EA]/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {isUnread && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-[#A855F7] shadow-[0_0_8px_#A855F7]"
                            aria-label="Unread"
                          />
                        )}
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            isFailed
                              ? "bg-rose-500/20 text-rose-300"
                              : isAdminAlert
                              ? "bg-[#9333EA]/30 text-[#E9D5FF]"
                              : "bg-[#9333EA]/20 text-[#A855F7]"
                          }`}
                        >
                          {isAdminAlert ? <ShieldAlert size={11} aria-hidden /> : <Sparkles size={11} aria-hidden />}
                          {badgeLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-[#A8A1B5]">{timeAgo(n.createdAt)}</span>
                        {isUnread && (
                          <button
                            type="button"
                            onClick={() => void markSingleRead(n.id)}
                            title="Mark as read"
                            aria-label="Mark notification as read"
                            className="rounded-md p-1 text-[#A8A1B5] hover:bg-[#100E16] hover:text-white"
                          >
                            <Check size={13} aria-hidden />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-1.5">
                      {n.href ? (
                        <Link
                          href={n.href}
                          onClick={() => {
                            if (isUnread) void markSingleRead(n.id);
                            close();
                          }}
                          className="block text-xs font-bold text-white hover:text-[#A855F7]"
                        >
                          {n.title}
                        </Link>
                      ) : (
                        <p className="text-xs font-bold text-white">{n.title}</p>
                      )}
                      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[#A8A1B5]">{n.body}</p>
                    </div>

                    {(n.href || n.meta?.sourceUrl) && (
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-semibold">
                        {n.href && (
                          <Link
                            href={n.href}
                            onClick={() => {
                              if (isUnread) void markSingleRead(n.id);
                              close();
                            }}
                            className="text-[#A855F7] hover:underline"
                          >
                            Open chapter / details →
                          </Link>
                        )}
                        {isAdmin && n.meta?.sourceUrl && (
                          <a
                            href={n.meta.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#A8A1B5] hover:text-white"
                          >
                            Source <ExternalLink size={11} aria-hidden />
                          </a>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-[#322A42] bg-[#100E16] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-3">
          <Link
            href={tab === "all" ? "/profile/notifications" : `/profile/notifications?tab=${tab}`}
            onClick={close}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#9333EA] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#A855F7]"
          >
            View All Notifications
          </Link>
          {isAdmin && (
            <Link
              href="/admin/sources"
              onClick={close}
              className="inline-flex items-center justify-center rounded-xl border border-[#322A42] bg-[#211B2D] px-3 py-2 text-xs font-bold text-[#A855F7] transition hover:border-[#A855F7] hover:text-white"
            >
              Admin Sync
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
