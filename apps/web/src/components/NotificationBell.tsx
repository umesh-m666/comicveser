"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ApiComic, toComic } from "@/lib/comics";
import { coverSrc, hueOf } from "@/lib/media";
import { act } from "@/lib/useApi";
import { useDismiss } from "@/lib/useDismiss";
import { useAuth } from "./AuthProvider";
import { Cover } from "./ComicCard";

export interface PopupNotificationItem {
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
    comicId?: string;
    comicTitle?: string;
    comicSlug?: string;
    coverUrl?: string | null;
    providerName?: string;
    chapterNumber?: number | null;
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

type PopupTab = "all" | "chapters" | "comments";

/** Compact relative timestamp matching image_b7315e.png ("5h", "2d", "15m", "Just now"). */
export function shortTimeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t) || t <= 0) return "";
  const m = Math.max(0, Math.round((now - t) / 60000));
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d}d`;
  const w = Math.round(d / 7);
  return `${w}w`;
}

export function isChapterNotif(n: PopupNotificationItem): boolean {
  if (n.type === "NEW_CHAPTER" || n.type === "BOOKMARK_UPDATE") return true;
  const ev = n.meta?.event;
  if (
    ev === "AUTO_CHAPTER_PUBLISHED" ||
    ev === "BOOKMARK_NEW_CHAPTER" ||
    ev === "MANUAL_CHAPTER_PUBLISHED"
  ) {
    return true;
  }
  if (/new chapter/i.test(n.title) || /\bchapter\s*:\s*[0-9.]+/i.test(n.body)) {
    return true;
  }
  return false;
}

export function parseNotifDisplay(
  n: PopupNotificationItem,
  comicLookup: Map<string, { title: string; slug: string; coverUrl: string | null }>,
): {
  isChapter: boolean;
  comicTitle: string;
  chapterText: string;
  coverUrl: string | null;
  hueKey: string;
} {
  const chap = isChapterNotif(n);

  // Extract comic title
  let comicTitle = n.meta?.comicTitle?.trim() || "";
  if (!comicTitle) {
    const m1 = n.title.match(/New Chapter Released!\s*[—:-]\s*(.+)$/i);
    const m2 = n.title.match(/New chapter automatically published:\s*(.+)$/i);
    const m3 = n.body.match(/Comic:\s*([^·\n]+)/i);
    comicTitle = (m1?.[1] || m2?.[1] || m3?.[1] || n.title).trim();
  }

  // Extract chapter number/label
  let chapterText = "";
  if (n.meta?.displayNumber) {
    chapterText = `Chapter ${n.meta.displayNumber}`;
  } else if (n.meta?.chapterNumber !== undefined && n.meta?.chapterNumber !== null) {
    chapterText = `Chapter ${n.meta.chapterNumber}`;
  } else {
    const cm1 = n.body.match(/Chapter:\s*(?:Chapter\s*)?([^·\n(]+)/i);
    const cm2 = n.body.match(/Chapter\s+([0-9.]+)/i);
    const cm3 = n.title.match(/Chapter\s+([0-9.]+)/i);
    const rawNum = (cm1?.[1] || cm2?.[1] || cm3?.[1] || "").trim();
    chapterText = rawNum
      ? /^chapter/i.test(rawNum)
        ? rawNum
        : `Chapter ${rawNum}`
      : n.body;
  }

  // Match coverUrl from meta or comicLookup
  let matchedCover: string | null = n.meta?.coverUrl ? coverSrc(n.meta.coverUrl) ?? null : null;
  let slugOrTitle = n.meta?.comicSlug || comicTitle;

  if (!matchedCover) {
    const candidates: string[] = [];
    if (n.meta?.comicId) candidates.push(n.meta.comicId.toLowerCase());
    if (n.meta?.comicSlug) candidates.push(n.meta.comicSlug.toLowerCase());
    if (n.href) {
      const hm = n.href.match(/\/comics\/([^/?#]+)/i);
      if (hm?.[1]) candidates.push(decodeURIComponent(hm[1]).toLowerCase());
    }
    if (comicTitle) {
      candidates.push(comicTitle.toLowerCase());
      candidates.push(
        comicTitle
          .toLowerCase()
          .replace(/^official\s+/i, "")
          .replace(/[^a-z0-9]+/g, ""),
      );
    }
    for (const key of candidates) {
      const hit = comicLookup.get(key);
      if (hit) {
        if (hit.coverUrl) matchedCover = hit.coverUrl;
        slugOrTitle = hit.slug || hit.title;
        break;
      }
    }
  }

  return {
    isChapter: chap,
    comicTitle,
    chapterText,
    coverUrl: matchedCover,
    hueKey: slugOrTitle || n.id,
  };
}

/**
 * Asura Notifications Dropdown (.notif-panel) matching image_b7315e.png 1:1:
 * - Header: "Notifications" + red unread count badge + "Likes" switch + "Mark all read"
 * - Tabs: All (N) | Chapters (N) | Comments (N)
 * - Chapter rows: Comic Cover thumbnail (40x52px) + bold Comic Title + purple "New:" Chapter X + short time ("5h", "2d")
 * - Footer: "View All"
 */
export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PopupTab>("all");
  const [likesOnly, setLikesOnly] = useState(false);
  const [unread, setUnread] = useState(0);
  const [allItems, setAllItems] = useState<PopupNotificationItem[]>([]);
  const [comicLookup, setComicLookup] = useState<
    Map<string, { title: string; slug: string; coverUrl: string | null }>
  >(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const close = useCallback(() => setOpen(false), []);
  useDismiss(containerRef, open, close);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Load catalogue covers once so every chapter notification displays its comic cover thumbnail
  useEffect(() => {
    let active = true;
    api<{ items: ApiComic[] }>("/comics?pageSize=48&sort=popular", { cache: "no-store" })
      .then((r) => {
        if (!active) return;
        const map = new Map<string, { title: string; slug: string; coverUrl: string | null }>();
        for (const raw of r.items ?? []) {
          const c = toComic(raw);
          const entry = { title: c.title, slug: c.slug, coverUrl: c.coverUrl };
          map.set(c.id.toLowerCase(), entry);
          map.set(c.slug.toLowerCase(), entry);
          map.set(c.title.toLowerCase(), entry);
          map.set(
            c.title
              .toLowerCase()
              .replace(/^official\s+/i, "")
              .replace(/[^a-z0-9]+/g, ""),
            entry,
          );
        }
        setComicLookup(map);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const fetchNotifications = useCallback(
    async (showSpinner = false) => {
      if (!user) {
        setUnread(0);
        setAllItems([]);
        return;
      }
      if (showSpinner) setLoading(true);
      setError(false);
      try {
        const res = await api<NotificationsApiResponse>("/user/notifications?page=1", {
          credentials: "include",
          cache: "no-store",
        });
        setUnread(res.unread ?? 0);
        setAllItems(res.items ?? []);
      } catch {
        setError(true);
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    if (!user) {
      setUnread(0);
      setAllItems([]);
      return;
    }
    let mounted = true;
    const reload = () => {
      if (mounted) void fetchNotifications(false);
    };
    reload();
    window.addEventListener("cv:notifications", reload);
    return () => {
      mounted = false;
      window.removeEventListener("cv:notifications", reload);
    };
  }, [user, fetchNotifications]);

  useEffect(() => {
    if (open && user) {
      void fetchNotifications(true);
    }
  }, [open, user, fetchNotifications]);

  const markSingleRead = async (id: string) => {
    setAllItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, readAt: it.readAt ?? new Date().toISOString() } : it)),
    );
    setUnread((u) => Math.max(0, u - 1));
    try {
      await act("/user/notifications/read", "POST", { ids: [id] });
      window.dispatchEvent(new Event("cv:notifications"));
    } catch {
      void fetchNotifications(false);
    }
  };

  const markAllRead = async () => {
    setAllItems((prev) => prev.map((it) => ({ ...it, readAt: it.readAt ?? new Date().toISOString() })));
    setUnread(0);
    try {
      await act("/user/notifications/read", "POST", {});
      window.dispatchEvent(new Event("cv:notifications"));
    } catch {
      void fetchNotifications(false);
    }
  };

  const counts = useMemo(() => {
    let chapters = 0;
    let comments = 0;
    for (const n of allItems) {
      if (isChapterNotif(n)) chapters++;
      else comments++;
    }
    return {
      all: allItems.length,
      chapters,
      comments,
    };
  }, [allItems]);

  const visibleItems = useMemo(() => {
    return allItems.filter((n) => {
      const chap = isChapterNotif(n);
      if (likesOnly && chap) return false;
      if (tab === "chapters") return chap;
      if (tab === "comments") return !chap;
      return true;
    });
  }, [allItems, tab, likesOnly]);

  if (!user) return null;

  return (
    <div ref={containerRef} className="notif-wrap">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="icon-btn"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
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
          <path d="M6 9.5a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path d="M10 20a2.2 2.2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span className="bdg" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <div
        role="dialog"
        aria-label="Notifications"
        hidden={!open}
        data-layer="Notifications Panel"
        className="notif-panel"
      >
        <div className="np-head">
          <b>Notifications</b>
          {unread > 0 && <span className="np-count">{unread}</span>}
          <span className="np-likes">
            Likes{" "}
            <button
              type="button"
              className="switch"
              role="switch"
              aria-checked={likesOnly}
              aria-label="Show likes only"
              onClick={() => setLikesOnly((v) => !v)}
            >
              <i />
            </button>
          </span>
          <button type="button" className="np-mark" onClick={() => void markAllRead()}>
            Mark all read
          </button>
        </div>

        <div className="np-tabs" role="tablist" aria-label="Notification categories">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "all"}
            className={tab === "all" ? "on" : undefined}
            onClick={() => setTab("all")}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "chapters"}
            className={tab === "chapters" ? "on" : undefined}
            onClick={() => setTab("chapters")}
          >
            Chapters ({counts.chapters})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "comments"}
            className={tab === "comments" ? "on" : undefined}
            onClick={() => setTab("comments")}
          >
            Comments ({counts.comments})
          </button>
        </div>

        <div className="np-list">
          {loading && allItems.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
              Loading notifications…
            </div>
          ) : error ? (
            <div style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
              Couldn&apos;t load notifications.{" "}
              <button
                type="button"
                onClick={() => void fetchNotifications(true)}
                className="np-mark"
              >
                Retry
              </button>
            </div>
          ) : visibleItems.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
              Nothing here yet.
            </div>
          ) : (
            visibleItems.slice(0, 12).map((n) => {
              const isUnread = !n.readAt;
              const info = parseNotifDisplay(n, comicLookup);

              return (
                <button
                  key={n.id}
                  type="button"
                  className={`np-item${isUnread ? " unread" : ""}`}
                  onClick={() => {
                    if (isUnread) void markSingleRead(n.id);
                    close();
                    if (n.href) router.push(n.href);
                    else router.push("/profile/notifications");
                  }}
                >
                  <Cover
                    hue={hueOf(info.hueKey)}
                    title={info.comicTitle}
                    src={info.coverUrl}
                    className="np-thumb border-0 !p-0.5"
                  />
                  <span style={{ minWidth: 0 }}>
                    {info.isChapter ? (
                      <>
                        <span className="nt truncate">{info.comicTitle}</span>
                        <span className="ns truncate">
                          <b>New:</b> {info.chapterText}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="nt truncate">{n.title}</span>
                        <span className="ns line-clamp-2">{n.body}</span>
                      </>
                    )}
                  </span>
                  <span suppressHydrationWarning className="nw">
                    {shortTimeAgo(n.createdAt)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <Link
          href={
            tab === "chapters"
              ? "/profile/notifications?tab=chapters"
              : tab === "comments"
              ? "/profile/notifications?tab=messages"
              : "/profile/notifications"
          }
          onClick={close}
          className="np-foot"
        >
          View All
        </Link>
      </div>
    </div>
  );
}
