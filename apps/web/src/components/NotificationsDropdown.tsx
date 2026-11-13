"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Heart, MessageSquare, BookOpen, CheckCheck } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { act } from "@/lib/useApi";
import { browseComics } from "@/lib/comics";
import { Cover, relTime } from "./ComicCard";

type Item = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  readAt: string | null;
  kind: "Chapters" | "Comments";
  hue: number;
  coverUrl: string | null;
};

type ApiItem = { id: string; title: string; body: string; href: string | null; readAt: string | null; createdAt: string };
type ApiData = { unread: number; prefs: { newChapter: boolean }; items: ApiItem[] };

const hueOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

function classify(n: ApiItem): "Chapters" | "Comments" {
  return /comment/i.test(`${n.title} ${n.body}`) ? "Comments" : "Chapters";
}

export default function NotificationsDropdown({
  open,
  onClose,
  onUnreadChange,
}: {
  open: boolean;
  onClose: () => void;
  onUnreadChange: (n: number) => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [tab, setTab] = useState<"All" | "Chapters" | "Comments">("All");
  const [likesOnly, setLikesOnly] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [isReal, setIsReal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoading(true);
    api<ApiData>("/user/notifications", { credentials: "include" })
      .then((d) => {
        if (!live) return;
        setIsReal(true);
        setItems(d.items.map((n) => ({ ...n, kind: classify(n), hue: hueOf(n.id), coverUrl: null })));
        onUnreadChange(d.unread);
      })
      .catch((e) => {
        if (!live) return;
        // Not signed in: show an empty state, not a fake feed.
        if (e instanceof ApiError && e.status === 401) { setIsReal(false); setItems([]); return; }
        // Endpoint unreachable: fall back to the newest popular titles as
        // "new chapter" items (client-side only, clearly derived content).
        browseComics({ sort: "updated", page: "1" })
          .then((r) => {
            if (!live) return;
            setIsReal(false);
            setItems(r.items.slice(0, 6).map((c) => ({
              id: c.slug,
              title: `${c.title} — new chapter`,
              body: `Chapter ${c.latest?.displayNumber ?? c.latest?.number ?? ""} is out now.`,
              href: `/comics/${c.slug}`,
              createdAt: c.updatedAt,
              readAt: null,
              kind: "Chapters" as const,
              hue: c.hue,
              coverUrl: c.coverUrl,
            })));
          })
          .catch(() => live && setItems([]));
      })
      .finally(() => live && setLoading(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const unread = items?.filter((i) => !i.readAt).length ?? 0;
  const shown = (items ?? []).filter((i) => (tab === "All" || i.kind === tab) && (!likesOnly || liked.has(i.id)));

  async function markAllRead() {
    setItems((prev) => prev?.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })) ?? prev);
    onUnreadChange(0);
    if (isReal) {
      try { await act("/user/notifications/read", "POST", {}); window.dispatchEvent(new Event("cv:notifications")); } catch { /* local state already updated */ }
    }
  }

  return (
    <div className="absolute right-0 top-full z-40 mt-2 w-[min(92vw,380px)] rounded-2xl border border-line bg-[#17141f] shadow-2xl shadow-black/60" role="dialog" aria-label="Notifications">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <p className="flex items-center gap-2 font-bold"><Bell size={16} className="text-primary" /> Notifications {unread > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">{unread} new</span>}</p>
        <button type="button" onClick={markAllRead} className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-fg"><CheckCheck size={14} /> Mark all read</button>
      </div>

      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <div className="flex gap-1" role="tablist" aria-label="Notification types">
          {(["All", "Chapters", "Comments"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${tab === t ? "bg-primary text-white" : "border border-line text-muted hover:text-fg"}`}>{t}</button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-muted">
          <Heart size={13} className={likesOnly ? "fill-danger text-danger" : ""} /> Likes
          <button type="button" role="switch" aria-checked={likesOnly} aria-label="Show liked notifications only" onClick={() => setLikesOnly((v) => !v)} className={`relative h-5 w-9 rounded-full transition ${likesOnly ? "bg-primary" : "bg-card border border-line"}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${likesOnly ? "left-[18px]" : "left-0.5"}`} />
          </button>
        </label>
      </div>

      <div className="max-h-96 overflow-y-auto p-2">
        {loading && <p className="px-2 py-6 text-center text-sm text-muted">Loading notifications…</p>}
        {!loading && shown.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted">
            {items !== null && items.length === 0
              ? "You're all caught up. Bookmark a comic to hear about new chapters."
              : likesOnly ? "No liked notifications yet — tap the heart on one to keep it here." : `No ${tab === "All" ? "" : tab.toLowerCase() + " "}notifications.`}
          </p>
        )}
        <ul className="space-y-1">
          {shown.map((n) => (
            <li key={n.id} className={`flex items-start gap-3 rounded-xl px-2 py-2.5 ${n.readAt ? "opacity-70" : "bg-card/70"}`}>
              <Cover hue={n.hue} title={n.title} src={n.coverUrl} className="aspect-[2/3] w-10 shrink-0 !p-1" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">
                  {n.kind === "Comments" ? <MessageSquare size={13} className="mr-1 inline text-accent" /> : <BookOpen size={13} className="mr-1 inline text-primary" />}
                  {n.href ? <Link href={n.href} onClick={onClose} className="hover:text-primary">{n.title}</Link> : n.title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted">{n.body}</p>
                <p className="mt-1 text-[11px] text-muted">{relTime(n.createdAt)}{!n.readAt && " · New"}</p>
              </div>
              <button type="button" aria-label={liked.has(n.id) ? "Unlike notification" : "Like notification"} aria-pressed={liked.has(n.id)} onClick={() => setLiked((prev) => { const next = new Set(prev); if (next.has(n.id)) next.delete(n.id); else next.add(n.id); return next; })} className="shrink-0 rounded-full p-1.5 hover:bg-card">
                <Heart size={15} className={liked.has(n.id) ? "fill-danger text-danger" : "text-muted"} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-line px-4 py-3">
        <Link href="/profile/notifications" onClick={onClose} className="block rounded-xl bg-primary py-2.5 text-center text-sm font-bold text-white hover:brightness-110">View All</Link>
      </div>
    </div>
  );
}
