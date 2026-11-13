"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { ApiComic, timeAgo, toComic } from "@/lib/comics";
import { hueOf } from "@/lib/media";
import { act } from "@/lib/useApi";
import { useAuth } from "./AuthProvider";
import { Cover } from "./ComicCard";
import { ComicVerseMark } from "./ComicVerseLogo";
import { PopupNotificationItem, parseNotifDisplay, shortTimeAgo } from "./NotificationBell";
import ReportButton from "./ReportButton";

type Note = PopupNotificationItem;

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

/**
 * Asura Messages & Notifications View (#frame-messages & #frame-mobile-messages):
 * Renders chapter notifications in the exact image_b7315e.png style (Comic cover + bold title + purple "New: Chapter X")
 * and includes the 2-column thread + conversation layout for Messages.
 */
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
  const [comicLookup, setComicLookup] = useState<
    Map<string, { title: string; slug: string; coverUrl: string | null }>
  >(new Map());
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");
  const [meta, setMeta] = useState<{ unread: number; newChapter: boolean } | null>(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [state, setState] = useState<"loading" | "ok" | "error" | "anon">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [msg, setMsg] = useState("");
  const [activeThreadIdx, setActiveThreadIdx] = useState(0);
  const [quickMsg, setQuickMsg] = useState("");

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

  const sendMessageToAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = quickMsg.trim();
    if (text.length < 3) return;
    try {
      await api("/reports", {
        method: "POST",
        body: JSON.stringify({
          targetType: "platform",
          targetId: "general",
          category: "GENERAL",
          subject: text.slice(0, 80),
          description: text,
          reason: text,
        }),
      });
      setQuickMsg("");
      setMsg("Message sent to ComicVerse Admin.");
      await load(1, true);
    } catch {
      setMsg("Could not send message.");
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
      <div className="panel empty-note">
        Please{" "}
        <Link href="/login" style={{ color: "var(--purple-2)", fontWeight: 600 }}>
          log in
        </Link>{" "}
        to see your notifications.
      </div>
    );
  }

  const threads = [
    {
      name: "ComicVerse Team",
      sub: "Official announcements & replies",
      when: items[0] ? timeAgo(items[0].createdAt) : "Now",
      unread: meta?.unread ?? 0,
      snip: items[0]?.title ?? "Welcome to ComicVerse! Chapter updates and notices appear here.",
      bubbles:
        items.length > 0
          ? items.slice(0, 6).map((n) => ({
              side: "them" as const,
              text: `${n.title} — ${n.body}`,
              href: n.href,
            }))
          : [
              {
                side: "them" as const,
                text: "Welcome to ComicVerse! Bookmark your favorite series to receive instant chapter notifications.",
                href: "/browse",
              },
            ],
    },
    ...myReports.map((r) => ({
      name: `Support · ${r.category}`,
      sub: r.subject,
      when: timeAgo(r.createdAt) || "Reported",
      unread: r.adminResponse && r.status === "RESOLVED" ? 1 : 0,
      snip: r.adminResponse ? `Admin: ${r.adminResponse}` : r.description,
      bubbles: [
        { side: "me" as const, text: `[${r.category}] ${r.subject}: ${r.description}`, href: null },
        ...(r.adminResponse
          ? [{ side: "them" as const, text: `Admin Reply: ${r.adminResponse}`, href: null }]
          : [
              {
                side: "them" as const,
                text: `Status: ${r.status}. Our team has received your report and will reply here.`,
                href: null,
              },
            ]),
      ],
    })),
  ];
  const currentThread = threads[activeThreadIdx] ?? threads[0];

  return (
    <div className="space-y-5">
      <div className="panel-h2" style={{ marginBottom: 4 }}>
        <span className="ic" aria-hidden="true">
          {tab === "messages" ? "✉" : tab === "chapters" ? "▤" : "🔔"}
        </span>
        <h1 style={{ fontSize: 21, margin: 0, fontWeight: 700, color: "#fff" }}>
          {props?.title ??
            (tab === "messages"
              ? "Messages"
              : tab === "chapters"
              ? "Chapter Updates"
              : "Notifications")}
        </h1>
        {meta && meta.unread > 0 && <span className="np-count">{meta.unread}</span>}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div className="rowbtn">
            <ReportButton targetType="platform" targetId="general" label="+ Report an Issue to Admin" />
          </div>
          {meta && meta.unread > 0 && (
            <button type="button" className="pillbtn ghost" onClick={() => void markAll()}>
              Mark all read ({meta.unread})
            </button>
          )}
        </div>
      </div>

      {/* Primary Tabs: All | Chapters | Messages */}
      <div role="tablist" aria-label="Inbox" className="browse-tools" style={{ marginBottom: 0 }}>
        {TABS.map((t) => (
          <Link
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            data-active={tab === t.key}
            href={
              t.key === "all" ? "/profile/notifications" : `/profile/notifications?tab=${t.key}`
            }
            className={`chip${tab === t.key ? " on" : ""}`}
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
          {tab === "messages" && (
            <div className="msg-layout" data-layer="Messages Layout">
              <section className="panel msg-list" data-layer="Thread List" style={{ padding: 10 }}>
                {threads.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`msg-thread${i === activeThreadIdx ? " on" : ""}`}
                    onClick={() => setActiveThreadIdx(i)}
                  >
                    <span className="mt-av">{t.name === "ComicVerse Team" ? <ComicVerseMark className="cv-mark-svg" /> : t.name.slice(0, 2).toUpperCase()}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="mt">
                        {t.name}{" "}
                        {t.unread > 0 && <span className="msg-unread">{t.unread}</span>}
                      </span>
                      <span className="ms">{t.snip}</span>
                    </span>
                    <span className="mw">{t.when}</span>
                  </button>
                ))}
              </section>

              <section className="panel" data-layer="Conversation" style={{ padding: "20px 22px" }}>
                <div
                  style={{
                    display: "flex",
                    gap: 11,
                    alignItems: "center",
                    borderBottom: "1px solid var(--row-line)",
                    paddingBottom: 13,
                    marginBottom: 16,
                  }}
                >
                  <span
                    className="mt-av"
                    style={{ width: 42, height: 42, borderRadius: "50%" }}
                  >
                    {currentThread.name === "ComicVerse Team" ? <ComicVerseMark className="cv-mark-svg" /> : currentThread.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <b className="msg-conv-name" style={{ fontSize: 14.5, color: "#fff" }}>
                      {currentThread.name}
                    </b>
                    <span
                      style={{
                        display: "block",
                        fontSize: 11.5,
                        color: "var(--muted)",
                      }}
                    >
                      {currentThread.sub}
                    </span>
                  </div>
                </div>

                <div className="msg-conv-body">
                  {currentThread.bubbles.map((b, idx) => (
                    <div key={idx} className={`bubble ${b.side}`}>
                      {b.href ? (
                        <Link href={b.href} className="hover:underline">
                          {b.text}
                        </Link>
                      ) : (
                        b.text
                      )}
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={sendMessageToAdmin}
                  className="msg-send"
                  style={{ display: "flex", gap: 9, marginTop: 10 }}
                >
                  <input
                    className="set-input"
                    type="text"
                    value={quickMsg}
                    onChange={(e) => setQuickMsg(e.target.value)}
                    placeholder="Write a message to ComicVerse Admin…"
                    aria-label="Write a message"
                    style={{ flex: 1 }}
                  />
                  <button
                    className="pillbtn"
                    type="submit"
                    style={{ justifyContent: "center", minHeight: 42, marginLeft: 0 }}
                  >
                    Send
                  </button>
                </form>
              </section>
            </div>
          )}

          <section className="panel">
            <label className="mb-3 flex items-center gap-2 text-sm text-white">
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
              <div className="empty-note">{empty}</div>
            ) : (
              <div className="space-y-1.5">
                {items.map((n) => {
                  const isUnread = !n.readAt;
                  const info = parseNotifDisplay(n, comicLookup);
                  const rowInner = (
                    <div className={`np-item${isUnread ? " unread" : ""}`} style={{ padding: "11px 13px" }}>
                      <Cover
                        hue={hueOf(info.hueKey)}
                        title={info.comicTitle}
                        src={info.coverUrl}
                        className="np-thumb border-0 !p-0.5"
                      />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        {info.isChapter ? (
                          <>
                            <span className="nt">{info.comicTitle}</span>
                            <span className="ns">
                              <b>New:</b> {info.chapterText}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="nt">
                              {n.title}{" "}
                              <span className="tag purple" style={{ marginLeft: 6, fontSize: 10, padding: "1px 7px" }}>
                                {n.meta?.adminOnly ? "Admin Alert" : TYPE_LABEL[n.type] ?? n.type}
                              </span>
                            </span>
                            <span className="ns">{n.body}</span>
                          </>
                        )}
                      </span>
                      <span suppressHydrationWarning className="nw">
                        {shortTimeAgo(n.createdAt)}
                      </span>
                    </div>
                  );

                  return n.href ? (
                    <Link
                      key={n.id}
                      href={n.href}
                      onClick={() => open(n)}
                      className="block"
                    >
                      {rowInner}
                    </Link>
                  ) : (
                    <div key={n.id} onClick={() => open(n)}>
                      {rowInner}
                    </div>
                  );
                })}
              </div>
            )}

            {more && (
              <div className="pager">
                <button
                  type="button"
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
          </section>

          {/* Admin Chapter Synchronization & Operational Alerts */}
          {isAdmin && (
            <section className="panel space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#fff" }}>
                    Admin Chapter Synchronization &amp; Operational Alerts
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0" }}>
                    Private to administrators: view automatically published chapters, sync failures, and provider alerts.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={syncBusy}
                    onClick={() => void runSyncNow()}
                    className="pillbtn"
                    style={{ marginLeft: 0 }}
                  >
                    <RefreshCw size={13} className={syncBusy ? "animate-spin" : ""} aria-hidden />
                    {syncBusy ? "Synchronizing…" : "Sync & Repair Comics Now"}
                  </button>
                  <Link href="/admin/sources" className="rowbtn">
                    Manage Sources →
                  </Link>
                </div>
              </div>

              {syncNotice && (
                <div role="status" className="svc-alert" style={{ borderColor: "var(--purple-2)" }}>
                  {syncNotice}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Admin alert filters">
                {ADMIN_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setAdminFilter(f.key)}
                    className={`chip${adminFilter === f.key ? " on" : ""}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {adminAlerts.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
                  No administrator synchronization notifications match the &ldquo;{adminFilter}&rdquo; filter yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {adminAlerts.map((alert) => {
                    const m = alert.meta ?? {};
                    const isFailed = m.status === "FAILED" || alert.title.includes("failed");
                    return (
                      <div key={alert.id} className="svc-alert space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`tag ${isFailed ? "red" : "green"}`}>
                              {isFailed ? "Failed" : "Successfully Published"}
                            </span>
                            {m.providerName && <span className="tag purple">{m.providerName}</span>}
                            <strong className="text-white">{alert.title}</strong>
                          </div>
                          <span style={{ color: "var(--muted)" }}>{timeAgo(alert.createdAt)}</span>
                        </div>
                        <p style={{ color: "var(--muted)", margin: 0 }}>{alert.body}</p>
                        <div className="flex flex-wrap items-center gap-4 pt-1 font-semibold">
                          {alert.href && (
                            <Link href={alert.href} style={{ color: "var(--purple-2)" }}>
                              Open ComicVerse Chapter →
                            </Link>
                          )}
                          {m.comicId && (
                            <Link
                              href={`/admin/chapters?comicId=${encodeURIComponent(m.comicId)}`}
                              className="text-white hover:underline"
                            >
                              Manage Comic Chapters
                            </Link>
                          )}
                          {m.sourceUrl && (
                            <a
                              href={m.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "var(--muted)" }}
                            >
                              Source Comic ↗
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* User's Submitted Issue Reports */}
          <section className="panel space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#fff" }}>
                  My Submitted Issue Reports
                </h2>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0" }}>
                  Track issues you reported to the ComicVerse Admin team and view their responses.
                </p>
              </div>
              <button type="button" onClick={() => void load(1, true)} className="rowbtn">
                Refresh
              </button>
            </div>

            {myReports.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
                You haven&apos;t submitted any issue reports yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {myReports.map((r) => (
                  <div key={r.id} className="svc-alert space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="tag purple">{r.category}</span>
                        <strong className="text-white">{r.subject}</strong>
                      </div>
                      <span
                        className={`tag ${
                          r.status === "RESOLVED"
                            ? "green"
                            : r.status === "DISMISSED"
                            ? "grey"
                            : "amber"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <p style={{ color: "var(--muted)", margin: 0 }}>{r.description}</p>
                    {r.adminResponse && (
                      <div
                        style={{
                          background: "rgba(147,51,234,.14)",
                          border: "1px solid rgba(168,85,247,.35)",
                          borderRadius: 7,
                          padding: "8px 11px",
                        }}
                      >
                        <strong style={{ color: "var(--purple-2)", display: "block" }}>
                          Admin Response:
                        </strong>
                        <span className="text-white">{r.adminResponse}</span>
                      </div>
                    )}
                    <span style={{ fontSize: 11, color: "var(--muted-2)", display: "block" }}>
                      Submitted {new Date(r.createdAt).toLocaleString()}
                      {r.respondedAt
                        ? ` · Responded ${new Date(r.respondedAt).toLocaleString()}`
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
