"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, BookOpen, ChevronDown, Search, Trash2, X } from "lucide-react";
import { Cover } from "./ComicCard";
import { ApiError, api } from "@/lib/api";
import { coverSrc, hueOf } from "@/lib/media";
import { timeAgo } from "@/lib/comics";
import { act } from "@/lib/useApi";
import { useAuth } from "./AuthProvider";

type Status = "READING" | "COMPLETED" | "PLAN_TO_READ" | "ON_HOLD" | "DROPPED";
type Sort = "updated" | "added" | "title";
interface Item {
  bookmarkedAt: string; lastUpdatedAt: string | null; status: Status; statusSource: "auto" | "manual";
  comic: { id: string; slug: string; title: string; type: string; status: string; coverUrl: string | null; totalChapters: number; latestChapter: { id: string; number: number; displayNumber: string } | null };
  progress: { readCount: number; percent: number; lastReadAt: string | null; current: { chapterId: string; number: number; displayNumber: string; imageIndex: number } | null };
}
interface Page { total: number; page: number; pageSize: number; counts: Record<string, number>; items: Item[] }

const TABS: { key: "ALL" | Status; label: string }[] = [
  { key: "ALL", label: "All Status" }, { key: "READING", label: "Reading" }, { key: "COMPLETED", label: "Completed" },
  { key: "PLAN_TO_READ", label: "Plan to Read" }, { key: "ON_HOLD", label: "On Hold" }, { key: "DROPPED", label: "Dropped" },
];
const LABEL = Object.fromEntries(TABS.map((t) => [t.key, t.label])) as Record<string, string>;
const SORTS: { key: Sort; label: string }[] = [{ key: "updated", label: "Recently Updated" }, { key: "added", label: "Recently Added" }, { key: "title", label: "Title (A–Z)" }];
const PILL: Record<Status, string> = {
  READING: "bg-[rgba(168,85,247,.25)] text-[#f3e8ff]", COMPLETED: "bg-[rgba(52,211,153,.18)] text-emerald-300",
  PLAN_TO_READ: "bg-[rgba(96,165,250,.18)] text-blue-300", ON_HOLD: "bg-[rgba(251,191,36,.18)] text-amber-300", DROPPED: "bg-[rgba(251,113,133,.18)] text-rose-300",
};

function Card({ it, busy, onStatus, onRemove }: { it: Item; busy: boolean; onStatus: (s: Status | "AUTO") => void; onRemove: () => void }) {
  const c = it.comic; const cur = it.progress.current;
  const href = cur ? `/comics/${c.slug}/chapter/${cur.chapterId}` : `/comics/${c.slug}`;
  const cta = cur ? `Continue Ch. ${cur.displayNumber}` : "Start reading";
  return (
    <li className="cv-bm-card" style={busy ? { opacity: 0.6, pointerEvents: "none" } : undefined}>
      <Link href={`/comics/${c.slug}`} className="block w-24 shrink-0 sm:w-28" aria-label={`Open ${c.title}`}>
        <Cover hue={hueOf(c.slug)} title={c.title} src={coverSrc(c.coverUrl)} className="aspect-[2/3] w-full" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/comics/${c.slug}`} className="line-clamp-2 text-base font-bold leading-snug text-white hover:text-[#c084fc]">{c.title}</Link>
          <button type="button" onClick={onRemove} aria-label={`Remove ${c.title} from bookmarks`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#a8a1b5] hover:bg-[rgba(251,113,133,.14)] hover:text-rose-300"><Trash2 size={16} aria-hidden /></button>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#a8a1b5]">
          <span className="rounded-md bg-black/30 px-1.5 py-0.5 font-semibold">{c.type}</span>
          <label className="relative inline-flex items-center">
            <span className="sr-only">Bookmark status for {c.title}</span>
            <select value={it.statusSource === "manual" ? it.status : "AUTO"} onChange={(e) => onStatus(e.target.value as Status | "AUTO")}
              className={`cursor-pointer appearance-none rounded-md !border-0 !min-h-0 py-0.5 pl-1.5 pr-5 text-[11px] font-bold ${PILL[it.status]}`}>
              <option value="AUTO" className="bg-[#191522] text-white">{LABEL[it.status]} (auto)</option>
              {TABS.slice(1).map((t) => <option key={t.key} value={t.key} className="bg-[#191522] text-white">{t.label}</option>)}
            </select>
            <ChevronDown size={11} className="pointer-events-none absolute right-1 text-current opacity-80" aria-hidden />
          </label>
        </div>
        <p className="mt-2 text-sm text-[#d9d4e2]">
          {cur ? <>Current: <span className="font-semibold text-[#c084fc]">Ch. {cur.displayNumber}</span></> : <span className="text-[#a8a1b5]">Not started</span>}
          {c.totalChapters > 0 && <span className="text-[#a8a1b5]"> · {c.totalChapters} {c.totalChapters === 1 ? "chapter" : "chapters"}{c.latestChapter ? ` (latest ${c.latestChapter.displayNumber})` : ""}</span>}
        </p>
        <div className="mt-2" title={`${it.progress.readCount} of ${c.totalChapters} chapters read`}>
          <div className="mb-1 flex justify-between text-[11px] font-semibold text-[#a8a1b5]"><span>{it.progress.readCount} / {c.totalChapters || "?"} read</span><span className="text-[#c084fc]">{it.progress.percent}%</span></div>
          <div className="cv-progress" role="progressbar" aria-label={`${c.title} reading progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={it.progress.percent}><span style={{ width: `${it.progress.percent}%` }} /></div>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
          <span className="text-[11px] text-[#a8a1b5]">{it.lastUpdatedAt ? `Updated ${timeAgo(it.lastUpdatedAt)}` : `Added ${timeAgo(it.bookmarkedAt)}`}</span>
          <Link href={href} className="cv-btn cv-btn-primary !min-h-9 !px-3.5 text-xs"><BookOpen size={14} aria-hidden />{cta}</Link>
        </div>
      </div>
    </li>
  );
}

/** Premium bookmarks page: search, status tabs, sorting and real progress for every saved comic. */
export default function BookmarksView() {
  const { status: auth } = useAuth();
  const [q, setQ] = useState(""); const [dq, setDq] = useState("");
  const [tab, setTab] = useState<"ALL" | Status>("ALL"); const [sort, setSort] = useState<Sort>("updated"); const [pageNo, setPageNo] = useState(1);
  const [data, setData] = useState<Page | null>(null); const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState("");
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);

  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPageNo(1); }, 250); return () => clearTimeout(t); }, [q]);

  useEffect(() => {
    if (auth !== "authenticated") return;
    const mine = ++seq.current;
    const p = new URLSearchParams({ sort, page: String(pageNo), limit: "24" });
    if (tab !== "ALL") p.set("status", tab);
    if (dq) p.set("q", dq);
    setState((s) => (data ? s : "loading"));
    api<Page>(`/user/bookmarks?${p}`, { credentials: "include", cache: "no-store" })
      .then((r) => {
        if (mine !== seq.current) return;
        if (r.items.length === 0 && pageNo > 1) { setPageNo(pageNo - 1); return; } // removed the last card on this page
        setData(r); setState("ok");
      })
      .catch((e) => { if (mine === seq.current && !(e instanceof ApiError && e.status === 401)) setState("error"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, tab, sort, dq, pageNo, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const remove = async (it: Item) => {
    setBusy(it.comic.id); setErr("");
    try { await act(`/user/bookmarks/${it.comic.id}`, "DELETE"); setData((d) => (d ? { ...d, total: d.total - 1, items: d.items.filter((x) => x.comic.id !== it.comic.id) } : d)); reload(); window.dispatchEvent(new Event("cv:bookmarks")); }
    catch { setErr("Couldn't remove that bookmark. Please try again."); } finally { setBusy(null); }
  };
  const setStatus = async (it: Item, s: Status | "AUTO") => {
    setBusy(it.comic.id); setErr("");
    try { await act(`/user/bookmarks/${it.comic.id}/status`, "PUT", { status: s }); reload(); }
    catch { setErr("Couldn't change the status. Please try again."); } finally { setBusy(null); }
  };

  const counts = data?.counts ?? {};
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const total = counts.ALL ?? 0;
  const filtered = tab !== "ALL" || !!dq;

  const skeleton = useMemo(() => <ul className="grid gap-3 md:grid-cols-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <li key={i} className="skeleton h-44" />)}</ul>, []);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-3xl font-extrabold tracking-tight text-white"><Bookmark className="text-[#c084fc]" size={28} aria-hidden />Bookmarks</h1>
          <p className="mt-1 text-sm text-[#a8a1b5]" aria-live="polite">{data ? `${total} bookmarked ${total === 1 ? "comic" : "comics"}` : "Loading your library…"}</p>
        </div>
        <div className="relative w-full sm:w-80">
          <label htmlFor="bm-q" className="sr-only">Search your bookmarks</label>
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a8a1b5]" aria-hidden />
          <input id="bm-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bookmarks…" className="cv-search w-full py-2.5 pl-10 pr-9 text-sm" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a8a1b5] hover:text-white"><X size={16} aria-hidden /></button>}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Filter by status" className="no-scrollbar -mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-1">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => { setTab(t.key); setPageNo(1); }} className="cv-chip shrink-0 !px-3.5 !py-1.5 text-[13px]" data-active={tab === t.key}>
              {t.label}{data && <span className="ml-1 opacity-70">{counts[t.key] ?? 0}</span>}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-[#a8a1b5]">Sort
          <select value={sort} onChange={(e) => { setSort(e.target.value as Sort); setPageNo(1); }} className="cv-select">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>

      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}

      <div className="mt-5">
        {state === "loading" && skeleton}
        {state === "error" && (
          <div role="alert" className="cv-panel p-8 text-center"><p className="text-danger">We couldn&apos;t load your bookmarks.</p><button type="button" onClick={reload} className="cv-btn mt-4">Try again</button></div>
        )}
        {state === "ok" && data && data.items.length === 0 && (
          <div className="cv-panel flex flex-col items-center px-6 py-14 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[rgba(147,51,234,.18)] text-[#c084fc]"><Bookmark size={30} aria-hidden /></span>
            <h2 className="mt-4 text-xl font-bold text-white">{filtered ? "No bookmarks match" : "Your shelf is empty"}</h2>
            <p className="mt-1 max-w-sm text-sm text-[#a8a1b5]">{filtered ? "Try a different status or search term." : "Tap the bookmark icon on any comic to keep track of it here with your reading progress."}</p>
            {filtered
              ? <button type="button" onClick={() => { setTab("ALL"); setQ(""); }} className="cv-btn mt-5">Clear filters</button>
              : <Link href="/browse" className="cv-btn cv-btn-primary mt-5">Browse comics</Link>}
          </div>
        )}
        {state === "ok" && data && data.items.length > 0 && (
          <>
            <ul className="grid gap-3 lg:grid-cols-2">{data.items.map((it) => <Card key={it.comic.id} it={it} busy={busy === it.comic.id} onRemove={() => void remove(it)} onStatus={(s) => void setStatus(it, s)} />)}</ul>
            {pages > 1 && (
              <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-3 text-sm">
                <button type="button" className="cv-btn !min-h-9" disabled={pageNo <= 1} onClick={() => setPageNo((p) => p - 1)}>Previous</button>
                <span className="text-[#a8a1b5]">Page {pageNo} of {pages}</span>
                <button type="button" className="cv-btn !min-h-9" disabled={pageNo >= pages} onClick={() => setPageNo((p) => p + 1)}>Next</button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
