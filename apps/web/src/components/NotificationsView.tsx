"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, CheckCheck, MessageSquare } from "lucide-react";
import ProfileNav from "@/components/ProfileNav";
import { ApiError, api } from "@/lib/api";
import { timeAgo } from "@/lib/comics";
import { act } from "@/lib/useApi";

interface Note { id: string; type: string; title: string; body: string; href: string | null; readAt: string | null; createdAt: string }
interface Resp { unread: number; prefs: { newChapter: boolean }; items: Note[] }
type Tab = "all" | "alerts" | "messages";
const TABS: { key: Tab; label: string }[] = [{ key: "all", label: "All" }, { key: "alerts", label: "Alerts" }, { key: "messages", label: "Messages" }];
const TYPE_LABEL: Record<string, string> = { NEW_CHAPTER: "New chapter", BOOKMARK_UPDATE: "Bookmark update", CREATOR_ANNOUNCEMENT: "Creator", REVIEW_REPLY: "Review reply", ACCOUNT: "Account", PLATFORM: "ComicVerse" };
const PAGE = 20;

/**
 * Alerts (new chapters, bookmark updates) and Messages (notes from ComicVerse, creators and review replies) share one inbox
 * backed by the notifications API; the tab is the `?tab=` query so the account menu can link straight to either.
 */
export default function NotificationsView() {
  const sp = useSearchParams();
  const tab: Tab = sp.get("tab") === "alerts" ? "alerts" : sp.get("tab") === "messages" ? "messages" : "all";
  const [items, setItems] = useState<Note[]>([]); const [meta, setMeta] = useState<{ unread: number; newChapter: boolean } | null>(null);
  const [page, setPage] = useState(1); const [more, setMore] = useState(false);
  const [state, setState] = useState<"loading" | "ok" | "error" | "anon">("loading"); const [loadingMore, setLoadingMore] = useState(false); const [msg, setMsg] = useState("");

  const load = useCallback(async (pg: number, replace: boolean) => {
    try {
      const r = await api<Resp>(`/user/notifications?page=${pg}${tab === "all" ? "" : `&group=${tab}`}`, { credentials: "include", cache: "no-store" });
      setItems((prev) => (replace ? r.items : [...prev, ...r.items])); setMore(r.items.length === PAGE); setPage(pg);
      setMeta({ unread: r.unread, newChapter: r.prefs.newChapter }); setState("ok");
    } catch (e) { setState(e instanceof ApiError && e.status === 401 ? "anon" : "error"); }
  }, [tab]);

  useEffect(() => { setState("loading"); void load(1, true); }, [load]);

  const markAll = async () => { await act("/user/notifications/read", "POST", {}); window.dispatchEvent(new Event("cv:notifications")); void load(1, true); };
  const open = (n: Note) => { if (!n.readAt) act("/user/notifications/read", "POST", { ids: [n.id] }).then(() => window.dispatchEvent(new Event("cv:notifications"))).catch(() => {}); };
  const empty = tab === "messages" ? "No messages yet. Notes from ComicVerse, creators and review replies show up here." : tab === "alerts" ? "No alerts yet. Bookmark a comic to hear about new chapters." : "You're all caught up. Bookmark a comic to hear about new chapters.";

  if (state === "anon") return <p>Please <Link href="/login" className="text-primary">log in</Link> to see your notifications.</p>;
  return (
    <div>
      <ProfileNav active="/profile/notifications" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-white">{tab === "messages" ? <MessageSquare size={24} className="text-[#c084fc]" aria-hidden /> : <Bell size={24} className="text-[#c084fc]" aria-hidden />}{tab === "messages" ? "Messages" : tab === "alerts" ? "Alerts" : "Notifications"}</h1>
        {meta && meta.unread > 0 && <button type="button" className="cv-btn !min-h-9 text-xs" onClick={() => void markAll()}><CheckCheck size={14} aria-hidden />Mark all as read ({meta.unread})</button>}
      </div>
      <div role="tablist" aria-label="Inbox" className="mb-4 flex gap-1.5">
        {TABS.map((t) => <Link key={t.key} role="tab" aria-selected={tab === t.key} data-active={tab === t.key} href={t.key === "all" ? "/profile/notifications" : `/profile/notifications?tab=${t.key}`} className="cv-chip !px-4 !py-1.5 text-[13px]">{t.label}</Link>)}
      </div>

      {state === "loading" && <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-16" />)}</div>}
      {state === "error" && <p role="alert" className="text-danger">We couldn&apos;t load your notifications. Refresh to try again.</p>}
      {state === "ok" && meta && (
        <>
          <label className="mb-4 flex items-center gap-2 text-sm text-[#d9d4e2]"><input type="checkbox" checked={meta.newChapter} onChange={async (e) => { const v = e.target.checked; setMeta({ ...meta, newChapter: v }); try { await act("/user/notification-settings", "PUT", { newChapter: v }); setMsg("Saved."); } catch { setMeta({ ...meta, newChapter: !v }); setMsg("Couldn't save that setting."); } }} />
            Notify me when a bookmarked comic gets a new chapter</label>
          {msg && <p role="status" className="mb-2 text-sm text-success">{msg}</p>}
          {items.length === 0 ? <div className="cv-panel p-8 text-center text-sm text-[#a8a1b5]">{empty}</div> : (
            <ul className="space-y-2">
              {items.map((n) => (
                <li key={n.id} className={`rounded-xl border p-3.5 transition ${n.readAt ? "border-line bg-card" : "border-[rgba(168,85,247,.7)] bg-card shadow-[0_0_0_1px_rgba(168,85,247,.18)]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-white">{n.href ? <Link href={n.href} onClick={() => open(n)} className="hover:text-[#c084fc]">{n.title}</Link> : <button type="button" onClick={() => open(n)} className="text-left hover:text-[#c084fc]">{n.title}</button>}</p>
                    <span className="shrink-0 rounded-md bg-[rgba(168,85,247,.16)] px-1.5 py-0.5 text-[10px] font-bold text-[#e9d5ff]">{TYPE_LABEL[n.type] ?? n.type}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-[#a8a1b5]">{n.body} · {timeAgo(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
          {more && <div className="mt-4 text-center"><button type="button" className="cv-btn" disabled={loadingMore} onClick={async () => { setLoadingMore(true); await load(page + 1, false); setLoadingMore(false); }}>{loadingMore ? "Loading…" : "Load more"}</button></div>}
        </>
      )}
    </div>
  );
}
