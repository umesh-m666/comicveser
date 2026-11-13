"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, Info, Minus, Plus, Trash2, X } from "lucide-react";
import { Cover } from "./ComicCard";
import { ActivityRow, type ActivityItem } from "./ProfileActivity";
import { dayLabel } from "./ProfileStats";
import { ApiError, api } from "@/lib/api";

interface Row {
  slug: string; title: string; sub: string; href: string; cta: string;
  /** History only: the chapter that was read. */
  chapterId?: string; chapterNumber?: string; chapterTitle?: string; lastReadAt?: string;
  /** Bookmarks only. */
  comicId?: string; type?: string; bookmarkedAt?: string;
  latestId?: string; latestNumber?: number; latestDisplay?: string;
  /** Bookmarks only, derived from reading history when available. */
  readChapter?: number;
}
const hue = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

type LibStatus = "Reading" | "Plan to Read" | "On Hold" | "Completed";
const STATUS_STYLES: Record<LibStatus, string> = {
  Reading: "border-emerald-400/40 bg-emerald-400/90 text-black",
  "Plan to Read": "border-violet-400/40 bg-violet-500/90 text-white",
  "On Hold": "border-amber-400/40 bg-amber-400/90 text-black",
  Completed: "border-sky-400/40 bg-sky-500/90 text-white",
};
function deriveStatus(read: number | undefined, total: number): LibStatus {
  if (read === undefined || read <= 0) return "Plan to Read";
  if (total > 0 && read >= total) return "Completed";
  return "Reading";
}

function BookmarkDetailModal({ row, onClose, onRemoved, onProgress }: {
  row: Row;
  onClose: () => void;
  onRemoved: (slug: string) => void;
  onProgress: (slug: string, read: number) => void;
}) {
  const total = row.latestNumber ?? 0;
  const [read, setRead] = useState(row.readChapter ?? 0);
  const [status, setStatus] = useState<LibStatus>(deriveStatus(row.readChapter, total));
  const [chapters, setChapters] = useState<{ id: string; number: number; displayNumber?: string }[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Resolve chapter ids (needed to save progress / link the next chapter).
  // Uses the same chapters endpoint the comic detail page uses.
  useEffect(() => {
    if (!row.comicId) return;
    let live = true;
    api<{ id: string; number: number; displayNumber?: string }[]>(`/comics/${row.comicId}/chapters?order=asc`, { cache: "no-store" })
      .then((list) => live && setChapters(list))
      .catch(() => live && setChapters([]));
    return () => { live = false; };
  }, [row.comicId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const behind = Math.max(total - read, 0);
  const pct = total > 0 ? Math.min(100, Math.round((read / total) * 100)) : 0;
  const nextChapter = chapters?.find((c) => c.number > read) ?? (row.latestId && total > read ? { id: row.latestId, number: total, displayNumber: row.latestDisplay } : null);
  const targetChapter = chapters?.find((c) => c.number === read);

  async function setToChapter() {
    if (!row.comicId || read <= 0) { setErr("Pick a chapter above 0 first."); return; }
    if (!targetChapter) { setErr("That chapter isn't available for this comic."); return; }
    setSaving(true); setErr(""); setMsg("");
    try {
      await api("/user/progress", { method: "POST", json: { comicId: row.comicId, chapterId: targetChapter.id, imageIndex: 0, scrollY: 0 }, credentials: "include" });
      onProgress(row.slug, read);
      setMsg(`Progress saved at Chapter ${targetChapter.displayNumber ?? targetChapter.number}.`);
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Couldn't save progress."); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!row.comicId) return;
    setDeleting(true);
    try {
      await api(`/user/bookmarks/${row.comicId}`, { method: "DELETE", credentials: "include" });
      onRemoved(row.slug);
      onClose();
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Couldn't remove bookmark."); setDeleting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={row.title} onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-line bg-[#17141f] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <div className="flex gap-4 p-5">
            <Cover hue={hue(row.slug)} title={row.title} className="aspect-[2/3] w-24 shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black leading-tight">{row.title}</h2>
              <p className="mt-1 text-xs text-muted">
                {row.bookmarkedAt ? `Bookmarked ${new Date(row.bookmarkedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : "Bookmarked"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {row.type && <span className="rounded-full border border-line bg-card px-2.5 py-1 text-[11px] font-bold">{row.type}</span>}
                <span className="rounded-full border border-line bg-card px-2.5 py-1 text-[11px] font-bold text-muted">{total > 0 ? `${total} chapters` : "No chapters yet"}</span>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="h-fit rounded-full border border-line p-2 text-muted hover:bg-card hover:text-fg"><X size={16} /></button>
          </div>
        </div>

        <div className="space-y-4 px-5 pb-5">
          {/* Chapter stepper */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Your chapter</p>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Previous chapter" disabled={read <= 0} onClick={() => setRead((v) => Math.max(0, v - 1))} className="rounded-full border border-line p-2.5 hover:bg-card disabled:opacity-40"><Minus size={16} /></button>
              <span className="min-w-16 text-center text-lg font-black">Ch. {read}</span>
              <button type="button" aria-label="Next chapter" disabled={total > 0 && read >= total} onClick={() => setRead((v) => (total > 0 ? Math.min(total, v + 1) : v + 1))} className="rounded-full border border-line p-2.5 hover:bg-card disabled:opacity-40"><Plus size={16} /></button>
              <button type="button" onClick={setToChapter} disabled={saving || read <= 0} className="ml-auto rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Set to Chapter {read}</button>
            </div>
          </div>

          {/* Progress */}
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-black text-warn">{total > 0 ? `${read}/${total}` : `${read} read`}</span>
              <span className="text-xs text-muted">{behind > 0 ? `${behind} behind` : total > 0 ? "Caught up" : ""}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-card" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-warn transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Status selector */}
          <div>
            <label htmlFor="lib-status" className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">Status</label>
            <select id="lib-status" value={status} onChange={(e) => setStatus(e.target.value as LibStatus)} className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm font-semibold">
              {(["Reading", "Plan to Read", "On Hold", "Completed"] as LibStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-muted">Status is kept on this device for now — there is no library-status endpoint yet.</p>
          </div>

          {msg && <p role="status" className="text-sm text-success">{msg}</p>}
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}

          {/* Next chapter + info/delete */}
          <div className="flex items-center gap-2">
            {nextChapter ? (
              <Link href={`/comics/${row.slug}/chapter/${nextChapter.id}`} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black text-white hover:brightness-110">
                <BookOpen size={16} /> {read > 0 ? `Continue: Ch. ${nextChapter.displayNumber ?? nextChapter.number}` : `Start: Ch. ${nextChapter.displayNumber ?? nextChapter.number}`}
              </Link>
            ) : (
              <Link href={row.href} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black text-white hover:brightness-110">
                <BookOpen size={16} /> Open comic
              </Link>
            )}
            <Link href={row.href} aria-label="Comic info" className="rounded-xl border border-line p-3 text-muted hover:bg-card hover:text-fg"><Info size={18} /></Link>
            <button type="button" onClick={remove} disabled={deleting} aria-label="Remove bookmark" className="rounded-xl border border-line p-3 text-danger hover:bg-danger/10 disabled:opacity-50"><Trash2 size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Library({ kind }: { kind: "bookmarks" | "history" }) {
  const [rows, setRows] = useState<Row[] | null>(null); const [state, setState] = useState<"loading" | "anon" | "error" | "ok">("loading");
  const [selected, setSelected] = useState<Row | null>(null);
  useEffect(() => {
    api<any>(`/user/${kind}`, { credentials: "include" }).then((r) => {
      setRows(kind === "bookmarks"
        ? r.items.map((b: any) => ({
            slug: b.comic.slug, title: b.comic.title, sub: b.comic.latestChapter ? `Latest: Ch. ${b.comic.latestChapter.displayNumber ?? b.comic.latestChapter.number}` : "No chapters yet",
            href: `/comics/${b.comic.slug}`, cta: "Open",
            comicId: b.comic.id, type: b.comic.type, bookmarkedAt: b.bookmarkedAt,
            latestId: b.comic.latestChapter?.id, latestNumber: b.comic.latestChapter?.number, latestDisplay: b.comic.latestChapter?.displayNumber,
          }))
        : r.map((h: any) => ({ slug: h.comic.slug, title: h.comic.title, sub: `Ch. ${h.chapter.number} · page ${h.imageIndex + 1}`, href: `/comics/${h.comic.slug}/chapter/${h.chapter.id}`, cta: "Continue reading",
          chapterId: h.chapter.id, chapterNumber: h.chapter.displayNumber ?? String(h.chapter.number), chapterTitle: h.chapter.title, lastReadAt: h.lastReadAt })));
      setState("ok");
      // Bookmarks only: merge reading history so the library can show a real
      // read/total fraction and a derived status. History is best-effort —
      // bookmarks still render if it fails.
      if (kind === "bookmarks") {
        api<any[]>("/user/history", { credentials: "include" }).then((hist) => {
          const bySlug = new Map<string, number>();
          for (const h of hist) if (h?.comic?.slug && typeof h.chapter?.number === "number") bySlug.set(h.comic.slug, h.chapter.number);
          setRows((prev) => prev?.map((row) => ({ ...row, readChapter: bySlug.get(row.slug) })) ?? prev);
        }).catch(() => {});
      }
    }).catch((e) => setState(e instanceof ApiError && e.status === 401 ? "anon" : "error"));
  }, [kind]);

  // History only: removing an entry hides it on this device. There is no
  // delete-history endpoint in the API, so nothing is removed server-side.
  const removeRow = (slug: string) => setRows((prev) => (prev ? prev.filter((r) => r.slug !== slug) : prev));

  // History only: group rows by the day they were last read (newest first;
  // the API already returns them in that order).
  const historyGroups: { label: string; items: ActivityItem[] }[] = [];
  if (kind === "history" && rows) {
    for (const r of rows) {
      const item: ActivityItem = {
        slug: r.slug, title: r.title, chapterId: r.chapterId ?? "", chapterNumber: r.chapterNumber ?? "",
        chapterTitle: r.chapterTitle ?? "", lastReadAt: r.lastReadAt ?? "",
      };
      const label = dayLabel(item.lastReadAt);
      const g = historyGroups.find((x) => x.label === label);
      if (g) g.items.push(item); else historyGroups.push({ label, items: [item] });
    }
  }

  return (
    <div>
      <nav aria-label="Library" className="mb-6 flex gap-4 text-sm">
        <Link href="/profile/bookmarks" className={kind === "bookmarks" ? "font-semibold" : "text-muted"}>Bookmarks</Link>
        <Link href="/profile/history" className={kind === "history" ? "font-semibold" : "text-muted"}>History</Link>
        <Link href="/profile/reviews" className="text-muted">Reviews</Link>
        <Link href="/profile/notifications" className="text-muted">Alerts</Link>
        <Link href="/profile/settings" className="text-muted">Settings</Link>
      </nav>
      {state === "loading" && <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20" />)}</div>}
      {state === "anon" && <p>Please <Link href="/login" className="text-primary">log in</Link> to see your {kind}.</p>}
      {state === "error" && <p className="text-danger">We couldn't load your {kind}. Refresh to try again.</p>}
      {state === "ok" && rows!.length === 0 && <p className="text-muted">{kind === "bookmarks" ? "No bookmarks yet. Open a comic and choose Bookmark." : "Nothing read yet. Your place in each comic is saved as you read."}</p>}
      {state === "ok" && rows!.length > 0 && kind === "history" && (
        <div className="space-y-6">
          <p className="text-sm text-[#A8A1B5]">Removing an entry only hides it here — history can&apos;t be deleted on the server yet.</p>
          {historyGroups.map((g) => (
            <section key={g.label} aria-label={`Read ${g.label}`}>
              <h2 className="mb-3 text-lg font-bold text-white">{g.label}</h2>
              <ul className="space-y-2">{g.items.map((item) => (
                <ActivityRow key={`${item.slug}-${item.chapterId}`} item={item} onDelete={() => removeRow(item.slug)} />
              ))}</ul>
            </section>
          ))}
        </div>
      )}
      {state === "ok" && rows!.length > 0 && kind === "bookmarks" && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
          {rows!.map((r) => {
            const total = r.latestNumber ?? 0;
            const read = r.readChapter;
            const status = deriveStatus(read, total);
            return (
              <article key={r.slug} className="group">
                <button type="button" onClick={() => setSelected(r)} aria-label={`${r.title} — library details`} className="relative block w-full text-left">
                  <Cover hue={hue(r.slug)} title={r.title} className="aspect-[2/3] w-full transition duration-300 group-hover:border-primary group-hover:shadow-[0_12px_35px_rgba(147,51,234,.25)]" />
                  <span className={`absolute left-2 top-2 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${STATUS_STYLES[status]}`}>{status}</span>
                  {read !== undefined && total > 0 && (
                    <span className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2 py-1 text-[11px] font-black text-warn backdrop-blur">{read}/{total}</span>
                  )}
                </button>
                <h3 className="mt-2.5 line-clamp-1 text-sm font-bold">
                  <button type="button" onClick={() => setSelected(r)} className="hover:text-primary">{r.title}</button>
                </h3>
                <p className="mt-0.5 text-xs text-muted">{r.sub}{read !== undefined && total > 0 ? ` · ${total - read > 0 ? `${total - read} behind` : "Caught up"}` : ""}</p>
              </article>
            );
          })}
        </div>
      )}
      {selected && kind === "bookmarks" && (
        <BookmarkDetailModal
          row={selected}
          onClose={() => setSelected(null)}
          onRemoved={(slug) => setRows((prev) => (prev ? prev.filter((r) => r.slug !== slug) : prev))}
          onProgress={(slug, read) => setRows((prev) => prev?.map((r) => (r.slug === slug ? { ...r, readChapter: read } : r)) ?? prev)}
        />
      )}
    </div>
  );
}
