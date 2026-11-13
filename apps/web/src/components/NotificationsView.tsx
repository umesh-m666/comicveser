"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, BookOpen, CheckCheck, ExternalLink, MessageSquare, RefreshCw, ShieldAlert } from "lucide-react";
import ProfileNav from "@/components/ProfileNav";
import { ApiError, api } from "@/lib/api";
import { timeAgo } from "@/lib/comics";
import { act } from "@/lib/useApi";
import { useAuth } from "./AuthProvider";
import ReportButton from "./ReportButton";

interface Note {
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
    providerId?: string;
    providerName?: string;
    chapterId?: string | null;
    chapterNumber?: number | null;
    displayNumber?: string;
    originalLabel?: string | null;
    chapterTitle?: string | null;
    sourceReleaseDate?: string | null;
    publishedAt?: string | null;
    status?: "PUBLISHED" | "FAILED";
    chapterUrl?: string | null;
    sourceUrl?: string | null;
    errorMessage?: string | null;
  } | null;
}

interface Resp {
  unread: number;
  prefs: { newChapter: boolean };
  items: Note[];
}

export interface UserIssueReport {
  id: string;
  category: string;
  subject: string;
  description: string;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  adminResponse: string | null;
  respondedAt: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

type Tab = "all" | "chapters" | "messages";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "chapters", label: "Chapters" },
  { key: "messages", label: "Messages" },
];

type AdminFilter = "all" | "published" | "failed" | "weebcentral" | "asurascans";
const ADMIN_FILTERS: { key: AdminFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "failed", label: "Failed" },
  { key: "weebcentral", label: "WeebCentral" },
  { key: "asurascans", label: "AsuraScans" },
];

const TYPE_LABEL: Record<string, string> = {
  NEW_CHAPTER: "New chapter",
  BOOKMARK_UPDATE: "Bookmark update",
  CREATOR_ANNOUNCEMENT: "Creator",
  REVIEW_REPLY: "Review reply",
  ACCOUNT: "Account",
  PLATFORM: "ComicVerse",
};
const PAGE = 20;

export default function NotificationsView(props?: {
  group?: "messages" | "alerts" | "chapters";
  title?: string;
  subtitle?: string;
  emptyText?: string;
  showChapterToggle?: boolean;
}) {
  const { isAdmin } = useAuth();
  const sp = useSearchParams();
  const rawTab = props?.group ?? sp.get("tab");
  const tab: Tab =
    rawTab === "alerts" || rawTab === "chapters"
      ? "chapters"
      : rawTab === "messages"
      ? "messages"
      : "all";

  const [items, setItems] = useState<Note[]>([]);
  const [myReports, setMyReports] = useState<UserIssueReport[]>([]);
  const [adminAlerts, setAdminAlerts] = useState<Note[]>([]);
  const [adminFilter, setAdminFilter] = useState<AdminFilter>("all");
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");
  const [meta, setMeta] = useState<{ unread: number; newChapter: boolean } | null>(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [state, setState] = useState<"loading" | "ok" | "error" | "anon">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(
    async (pg: number, replace: boolean) => {
      try {
        const [r, reportsData, adminData] = await Promise.all([
          api<Resp>(`/user/notifications?page=${pg}${tab === "all" ? "" : `&group=${tab}`}`, {
            credentials: "include",
            cache: "no-store",
          }),
          api<UserIssueReport[]>("/reports/mine").catch(() => []),
          isAdmin
            ? api<{ items: Note[] }>(`/admin/notifications?filter=${adminFilter}`, {
                credentials: "include",
                cache: "no-store",
              }).catch(() => ({ items: [] }))
            : Promise.resolve({ items: [] }),
        ]);
        setItems((prev) => (replace ? r.items : [...prev, ...r.items]));
        setMyReports(reportsData);
        setAdminAlerts(adminData.items ?? []);
        setMore(r.items.length === PAGE);
        setPage(pg);
        setMeta({ unread: r.unread, newChapter: r.prefs.newChapter });
        setState("ok");
      } catch (e) {
        setState(e instanceof ApiError && e.status === 401 ? "anon" : "error");
      }
    },
    [tab, isAdmin, adminFilter],
  );

  useEffect(() => {
    setState("loading");
    void load(1, true);
  }, [load]);

  const markAll = async () => {
    await act("/user/notifications/read", "POST", {});
    window.dispatchEvent(new Event("cv:notifications"));
    void load(1, true);
  };

  const open = (n: Note) => {
    if (!n.readAt) {
      act("/user/notifications/read", "POST", { ids: [n.id] })
        .then(() => window.dispatchEvent(new Event("cv:notifications")))
        .catch(() => {});
    }
  };

  const runSyncNow = async () => {
    setSyncBusy(true);
    setSyncNotice("");
    try {
      const res = await act<{
        checkedComics: number;
        repairedChapters: number;
        publishedChapters: number;
        failedChapters: number;
      }>("/admin/sources/sync", "POST", {});
      setSyncNotice(
        `Synchronization complete: checked ${res.checkedComics} comic(s), repaired ${res.repairedChapters} chapter(s), auto-published ${res.publishedChapters} new chapter(s), ${res.failedChapters} failed.`,
      );
      window.dispatchEvent(new Event("cv:notifications"));
      await load(1, true);
    } catch (e) {
      setSyncNotice(e instanceof Error ? e.message : "Could not run synchronization.");
    } finally {
      setSyncBusy(false);
    }
  };

  const empty =
    props?.emptyText ??
    (tab === "messages"
      ? "No messages yet. Notes from ComicVerse, creators and review replies show up here."
      : tab === "chapters"
      ? "No chapter notifications yet. Bookmark a comic to hear about new chapters."
      : "You're all caught up. Bookmark a comic to hear about new chapters.");

  if (state === "anon") {
    return (
      <p>
        Please{" "}
        <Link href="/login" className="text-[#A855F7]">
          log in
        </Link>{" "}
        to see your notifications.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <ProfileNav active="/profile/notifications" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-white">
          {tab === "messages" ? (
            <MessageSquare size={24} className="text-[#A855F7]" aria-hidden />
          ) : tab === "chapters" ? (
            <BookOpen size={24} className="text-[#A855F7]" aria-hidden />
          ) : (
            <Bell size={24} className="text-[#A855F7]" aria-hidden />
          )}
          {props?.title ?? (tab === "messages" ? "Messages" : tab === "chapters" ? "Chapter Updates" : "Notifications")}
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border border-line bg-[#211B2D] px-3 py-1.5">
            <ReportButton targetType="platform" targetId="general" label="+ Report an Issue to Admin" />
          </div>
          {meta && meta.unread > 0 && (
            <button type="button" className="cv-btn !min-h-9 text-xs" onClick={() => void markAll()}>
              <CheckCheck size={14} aria-hidden />
              Mark all as read ({meta.unread})
            </button>
          )}
        </div>
      </div>

      {/* Primary Tabs: All | Chapters | Messages */}
      <div role="tablist" aria-label="Inbox" className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            data-active={tab === t.key}
            href={t.key === "all" ? "/profile/notifications" : `/profile/notifications?tab=${t.key}`}
            className="cv-chip !px-4 !py-1.5 text-[13px]"
          >
            {t.label}
          </Link>
        ))}
      </div>

      {state === "loading" && (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-16" />
          ))}
        </div>
      )}
      {state === "error" && (
        <p role="alert" className="text-danger">
          We couldn&apos;t load your notifications. Refresh to try again.
        </p>
      )}
      {state === "ok" && meta && (
        <>
          <label className="mb-4 flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={meta.newChapter}
              onChange={async (e) => {
                const v = e.target.checked;
                setMeta({ ...meta, newChapter: v });
                try {
                  await act("/user/notification-settings", "PUT", { newChapter: v });
                  setMsg("Saved.");
                } catch {
                  setMeta({ ...meta, newChapter: !v });
                  setMsg("Couldn't save that setting.");
                }
              }}
            />
            Notify me when a bookmarked comic gets a new chapter
          </label>
          {msg && (
            <p role="status" className="mb-2 text-sm text-success">
              {msg}
            </p>
          )}
          {items.length === 0 ? (
            <div className="cv-panel p-8 text-center text-sm text-[#A8A1B5]">{empty}</div>
          ) : (
            <ul className="space-y-2">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`rounded-xl border p-3.5 transition ${
                    n.readAt
                      ? "border-line bg-[#211B2D]"
                      : "border-[#A855F7]/70 bg-[#211B2D] shadow-[0_0_0_1px_rgba(168,85,247,.18)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-white">
                      {n.href ? (
                        <Link href={n.href} onClick={() => open(n)} className="hover:text-[#A855F7]">
                          {n.title}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => open(n)}
                          className="text-left hover:text-[#A855F7]"
                        >
                          {n.title}
                        </button>
                      )}
                    </p>
                    <span className="shrink-0 rounded-md bg-[#9333EA]/25 px-2 py-0.5 text-[10px] font-bold text-[#E9D5FF]">
                      {n.meta?.adminOnly ? "Admin Alert" : TYPE_LABEL[n.type] ?? n.type}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#A8A1B5]">
                    {n.body} · {timeAgo(n.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {more && (
            <div className="mt-4 text-center">
              <button
                type="button"
                className="cv-btn"
                disabled={loadingMore}
                onClick={async () => {
                  setLoadingMore(true);
                  await load(page + 1, false);
                  setLoadingMore(false);
                }}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}

          {/* PART 8: Separate Admin Notification Experience (Authorized ADMIN users only) */}
          {isAdmin && (
            <section className="space-y-4 rounded-2xl border border-[#322A42] bg-[#211B2D] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                    <ShieldAlert size={19} className="text-[#A855F7]" aria-hidden />
                    Admin Chapter Synchronization &amp; Operational Alerts
                  </h2>
                  <p className="text-xs text-[#A8A1B5]">
                    Private to administrators: view automatically published chapters, sync failures, and provider alerts.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={syncBusy}
                    onClick={() => void runSyncNow()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#9333EA] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#A855F7] disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={syncBusy ? "animate-spin" : ""} aria-hidden />
                    {syncBusy ? "Synchronizing…" : "Sync & Repair Comics Now"}
                  </button>
                  <Link
                    href="/admin/sources"
                    className="rounded-xl border border-[#322A42] bg-[#100E16] px-3 py-2 text-xs font-semibold text-[#A8A1B5] hover:border-[#A855F7] hover:text-white"
                  >
                    Manage Sources →
                  </Link>
                </div>
              </div>

              {syncNotice && (
                <div role="status" className="rounded-xl border border-[#A855F7]/40 bg-[#100E16] px-4 py-2.5 text-xs text-white">
                  {syncNotice}
                </div>
              )}

              {/* Filters: All | Published | Failed | WeebCentral | AsuraScans */}
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Admin alert filters">
                {ADMIN_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setAdminFilter(f.key)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      adminFilter === f.key
                        ? "bg-[#9333EA] text-white"
                        : "bg-[#100E16] text-[#A8A1B5] hover:text-white"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {adminAlerts.length === 0 ? (
                <p className="rounded-xl border border-[#322A42] bg-[#100E16] p-4 text-xs text-[#A8A1B5]">
                  No administrator synchronization notifications match the &ldquo;{adminFilter}&rdquo; filter yet.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {adminAlerts.map((alert) => {
                    const m = alert.meta ?? {};
                    const isFailed = m.status === "FAILED" || alert.title.includes("failed");
                    return (
                      <li
                        key={alert.id}
                        className="rounded-xl border border-[#322A42] bg-[#100E16] p-4 text-xs space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                                isFailed
                                  ? "bg-rose-500/20 text-rose-300"
                                  : "bg-emerald-500/20 text-emerald-300"
                              }`}
                            >
                              {isFailed ? "Failed" : "Successfully Published"}
                            </span>
                            {m.providerName && (
                              <span className="rounded-md bg-[#211B2D] px-2 py-0.5 font-semibold text-[#A855F7]">
                                {m.providerName}
                              </span>
                            )}
                            <span className="font-bold text-white">{alert.title}</span>
                          </div>
                          <span className="text-[#A8A1B5]">{timeAgo(alert.createdAt)}</span>
                        </div>
                        <p className="text-[#A8A1B5] leading-relaxed">{alert.body}</p>
                        <div className="flex flex-wrap items-center gap-4 pt-1 font-semibold">
                          {alert.href && (
                            <Link href={alert.href} className="text-[#A855F7] hover:underline">
                              Open ComicVerse Chapter →
                            </Link>
                          )}
                          {m.comicId && (
                            <Link
                              href={`/admin/chapters?comicId=${encodeURIComponent(m.comicId)}`}
                              className="text-white hover:text-[#A855F7] hover:underline"
                            >
                              Manage Comic Chapters
                            </Link>
                          )}
                          {m.sourceUrl && (
                            <a
                              href={m.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#A8A1B5] hover:text-white"
                            >
                              Source Comic <ExternalLink size={12} aria-hidden />
                            </a>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {/* User's Submitted Issue Reports & Admin Responses */}
          <div className="space-y-3 pt-4 border-t border-line">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">My Submitted Issue Reports</h2>
                <p className="text-xs text-[#A8A1B5]">
                  Track issues you reported to the ComicVerse Admin team and view their responses.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void load(1, true)}
                className="text-xs text-[#A855F7] hover:underline"
              >
                Refresh
              </button>
            </div>

            {myReports.length === 0 ? (
              <p className="rounded-lg border border-line bg-[#211B2D]/40 p-4 text-xs text-[#A8A1B5]">
                You haven&apos;t submitted any issue reports yet.
              </p>
            ) : (
              <div className="space-y-3">
                {myReports.map((r) => (
                  <div key={r.id} className="rounded-xl border border-line bg-[#211B2D] p-4 space-y-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[#100E16] px-2 py-0.5 text-xs font-semibold text-[#A855F7]">
                          {r.category}
                        </span>
                        <span className="font-semibold text-white">{r.subject}</span>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          r.status === "RESOLVED"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : r.status === "DISMISSED"
                            ? "bg-zinc-500/15 text-[#A8A1B5]"
                            : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#A8A1B5]">{r.description}</p>
                    {r.adminResponse && (
                      <div className="rounded-md border border-[#9333EA]/40 bg-[#100E16] p-3 text-xs">
                        <p className="font-semibold text-[#A855F7]">Admin Response:</p>
                        <p className="mt-1 text-white">{r.adminResponse}</p>
                      </div>
                    )}
                    <p className="text-[11px] text-[#A8A1B5]">
                      Submitted {new Date(r.createdAt).toLocaleString()}
                      {r.respondedAt ? ` · Responded ${new Date(r.respondedAt).toLocaleString()}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
