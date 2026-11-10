"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, BookOpen, ChevronDown, Search, Star, X } from "lucide-react";
import { Cover } from "./ComicCard";
import { ApiError, api } from "@/lib/api";
import { coverSrc, hueOf } from "@/lib/media";
import { act } from "@/lib/useApi";
import { useAuth } from "./AuthProvider";

type Status = "READING" | "COMPLETED" | "PLAN_TO_READ" | "ON_HOLD" | "DROPPED";
type Sort = "updated" | "added" | "title";
interface Item {
  bookmarkedAt: string;
  lastUpdatedAt: string | null;
  status: Status;
  statusSource: "auto" | "manual";
  comic: {
    id: string;
    slug: string;
    title: string;
    type: string;
    status: string;
    coverUrl: string | null;
    totalChapters: number;
    latestChapter: { id: string; number: number; displayNumber: string } | null;
  };
  progress: {
    readCount: number;
    percent: number;
    lastReadAt: string | null;
    current: { chapterId: string; number: number; displayNumber: string; imageIndex: number } | null;
  };
}
interface Page {
  total: number;
  page: number;
  pageSize: number;
  counts: Record<string, number>;
  items: Item[];
}

const TABS: { key: "ALL" | Status; label: string }[] = [
  { key: "ALL", label: "All Status" },
  { key: "READING", label: "Reading" },
  { key: "COMPLETED", label: "Completed" },
  { key: "PLAN_TO_READ", label: "Plan to Read" },
  { key: "ON_HOLD", label: "On Hold" },
  { key: "DROPPED", label: "Dropped" },
];
const LABEL = Object.fromEntries(TABS.map((t) => [t.key, t.label])) as Record<string, string>;
const SORTS: { key: Sort; label: string }[] = [
  { key: "updated", label: "Recently Updated" },
  { key: "added", label: "Recently Added" },
  { key: "title", label: "Title (A–Z)" },
];

function formatSeriesStatus(raw: string): string {
  if (!raw) return "Ongoing";
  const lower = raw.toLowerCase();
  if (lower === "completed") return "Completed";
  if (lower === "hiatus") return "Hiatus";
  return "Ongoing";
}

function BookmarkGridCard({
  it,
  busy,
  onStatus,
  onRemove,
}: {
  it: Item;
  busy: boolean;
  onStatus: (s: Status | "AUTO") => void;
  onRemove: () => void;
}) {
  const c = it.comic;
  const cur = it.progress.current;
  const readHref = cur ? `/comics/${c.slug}/chapter/${cur.chapterId}` : `/comics/${c.slug}`;
  const statusLabel = formatSeriesStatus(c.status);

  return (
    <li
      className="cv-card-hover group relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-[#2B243B] bg-[#181424] shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition duration-200 hover:border-[#A855F7]/60"
      style={busy ? { opacity: 0.6, pointerEvents: "none" } : undefined}
    >
      <Link href={`/comics/${c.slug}`} className="block" aria-label={`Open ${c.title}`}>
        <div className="relative aspect-[2/3] w-full overflow-hidden">
          <Cover
            hue={hueOf(c.slug)}
            title={c.title}
            src={coverSrc(c.coverUrl)}
            className="h-full w-full rounded-none border-0"
          />
          <span className="absolute right-2 top-2 z-30 flex items-center gap-1 rounded-md border border-white/10 bg-[#100E16]/85 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-xs">
            <Star size={11} className="fill-[#FBBF24] text-[#FBBF24]" aria-hidden />
            9.5
          </span>
          {cur && (
            <span className="absolute bottom-2 left-2 z-30 rounded-md bg-[#9333EA]/90 px-2 py-0.5 text-[10px] font-bold text-white">
              Ch. {cur.displayNumber} · {it.progress.percent}%
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col justify-between p-3 sm:p-3.5">
        <div>
          <Link
            href={`/comics/${c.slug}`}
            className="block truncate text-sm font-bold text-white transition-colors group-hover:text-[#C084FC]"
            title={c.title}
          >
            {c.title}
          </Link>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-[#262135] px-2 py-0.5 text-[11px] font-semibold text-[#D4D0DC]">
              {c.totalChapters} {c.totalChapters === 1 ? "Chapter" : "Chapters"}
            </span>
            <span className="rounded-md bg-[#9333EA]/25 px-2 py-0.5 text-[11px] font-semibold text-[#C084FC]">
              {statusLabel}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <label className="relative inline-flex w-full items-center">
              <span className="sr-only">Reading shelf status for {c.title}</span>
              <select
                aria-label={`Reading status for ${c.title}`}
                value={it.statusSource === "manual" ? it.status : "AUTO"}
                onChange={(e) => onStatus(e.target.value as Status | "AUTO")}
                className="w-full cursor-pointer appearance-none rounded-md border border-[#322A42] bg-[#100E16] py-1 pl-2 pr-6 text-[11px] font-semibold text-[#A8A1B5] hover:border-[#A855F7] hover:text-white"
              >
                <option value="AUTO" className="bg-[#100E16] text-white">
                  {LABEL[it.status]} (auto)
                </option>
                {TABS.slice(1).map((t) => (
                  <option key={t.key} value={t.key} className="bg-[#100E16] text-white">
                    {t.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2 text-[#A8A1B5]" aria-hidden />
            </label>
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${c.title} from bookmarks`}
            className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#2A253B] px-3 py-2 text-xs font-bold text-[#E2DFEC] transition hover:bg-[#352F49]"
          >
            <Bookmark size={14} className="fill-white text-white" aria-hidden />
            <span>Bookmarked</span>
          </button>
          <Link
            href={readHref}
            className="inline-flex min-h-8 w-full items-center justify-center gap-1 rounded-lg border border-[#322A42] bg-[#100E16] px-2.5 py-1.5 text-[11px] font-semibold text-[#C084FC] transition hover:border-[#A855F7] hover:text-white"
          >
            <BookOpen size={12} aria-hidden />
            <span>{cur ? `Continue Ch. ${cur.displayNumber}` : "Start reading"}</span>
          </Link>
        </div>
      </div>
    </li>
  );
}

/** Bookmarks page: unified vertical card grid, search, status tabs, sorting, and real reading progress. */
export default function BookmarksView() {
  const { user, status: sessionStatus } = useAuth();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [tab, setTab] = useState<"ALL" | Status>("ALL");
  const [sort, setSort] = useState<Sort>("updated");
  const [pageNo, setPageNo] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setDq(q.trim());
      setPageNo(1);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!user || sessionStatus === "loading") return;
    const controller = new AbortController();
    const p = new URLSearchParams({ sort, page: String(pageNo), limit: "24" });
    if (tab !== "ALL") p.set("status", tab);
    if (dq) p.set("q", dq);
    setState((s) => (data ? s : "loading"));

    api<Page>(`/user/bookmarks?${p}`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => {
        if (controller.signal.aborted) return;
        if (r.items.length === 0 && pageNo > 1) {
          setPageNo(pageNo - 1);
          return;
        }
        setData(r);
        setState("ok");
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        if (!(e instanceof ApiError && e.status === 401)) setState("error");
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sessionStatus, tab, sort, dq, pageNo, reloadTick]);

  const reload = useCallback(() => setReloadTick((n) => n + 1), []);

  const remove = async (it: Item) => {
    setBusy(it.comic.id);
    setErr("");
    try {
      await act(`/user/bookmarks/${it.comic.id}`, "DELETE");
      setData((d) =>
        d ? { ...d, total: d.total - 1, items: d.items.filter((x) => x.comic.id !== it.comic.id) } : d,
      );
      reload();
      window.dispatchEvent(new Event("cv:bookmarks"));
    } catch {
      setErr("Couldn't remove that bookmark. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const setStatus = async (it: Item, s: Status | "AUTO") => {
    setBusy(it.comic.id);
    setErr("");
    try {
      await act(`/user/bookmarks/${it.comic.id}/status`, "PUT", { status: s });
      reload();
    } catch {
      setErr("Couldn't change the status. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const counts = data?.counts ?? {};
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const total = counts.ALL ?? 0;
  const filtered = tab !== "ALL" || !!dq;

  const skeleton = useMemo(
    () => (
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="skeleton aspect-[2/3] w-full rounded-xl" />
        ))}
      </ul>
    ),
    [],
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            <Bookmark className="text-[#A855F7]" size={28} aria-hidden />
            Bookmarks
          </h1>
          <p className="mt-1 text-sm text-[#A8A1B5]" aria-live="polite">
            {data ? `${total} bookmarked ${total === 1 ? "comic" : "comics"}` : "Loading your library…"}
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <label htmlFor="bm-q" className="sr-only">
            Search your bookmarks
          </label>
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8A1B5]"
            aria-hidden
          />
          <input
            id="bm-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search bookmarks…"
            className="cv-search w-full py-2.5 pl-10 pr-9 text-sm"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A8A1B5] hover:text-white"
            >
              <X size={16} aria-hidden />
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filter by status"
          className="no-scrollbar -mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-1"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => {
                setTab(t.key);
                setPageNo(1);
              }}
              className="cv-chip shrink-0 !px-3.5 !py-1.5 text-[13px]"
              data-active={tab === t.key}
            >
              {t.label}
              {data && <span className="ml-1 opacity-70">{counts[t.key] ?? 0}</span>}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-[#A8A1B5]">
          Sort
          <select
            aria-label="Sort bookmarks"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as Sort);
              setPageNo(1);
            }}
            className="cv-select"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {err && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {err}
        </p>
      )}

      <div className="mt-5">
        {state === "loading" && skeleton}
        {state === "error" && (
          <div role="alert" className="cv-panel p-8 text-center">
            <p className="text-danger">We couldn&apos;t load your bookmarks.</p>
            <button type="button" onClick={reload} className="cv-btn mt-4">
              Try again
            </button>
          </div>
        )}
        {state === "ok" && data && data.items.length === 0 && (
          <div className="cv-panel flex flex-col items-center px-6 py-14 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#9333EA]/20 text-[#A855F7]">
              <Bookmark size={30} aria-hidden />
            </span>
            <h2 className="mt-4 text-xl font-bold text-white">
              {filtered ? "No bookmarks match" : "Your shelf is empty"}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-[#A8A1B5]">
              {filtered
                ? "Try a different status or search term."
                : "Click Bookmark on any comic card to save it here and track your reading progress."}
            </p>
            {filtered ? (
              <button
                type="button"
                onClick={() => {
                  setTab("ALL");
                  setQ("");
                }}
                className="cv-btn mt-5"
              >
                Clear filters
              </button>
            ) : (
              <Link href="/browse" className="cv-btn cv-btn-primary mt-5">
                Browse comics
              </Link>
            )}
          </div>
        )}
        {state === "ok" && data && data.items.length > 0 && (
          <>
            <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {data.items.map((it) => (
                <BookmarkGridCard
                  key={it.comic.id}
                  it={it}
                  busy={busy === it.comic.id}
                  onRemove={() => void remove(it)}
                  onStatus={(s) => void setStatus(it, s)}
                />
              ))}
            </ul>
            {pages > 1 && (
              <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-3 text-sm">
                <button
                  type="button"
                  className="cv-btn !min-h-9"
                  disabled={pageNo <= 1}
                  onClick={() => setPageNo((p) => p - 1)}
                >
                  Previous
                </button>
                <span className="text-[#A8A1B5]">
                  Page {pageNo} of {pages}
                </span>
                <button
                  type="button"
                  className="cv-btn !min-h-9"
                  disabled={pageNo >= pages}
                  onClick={() => setPageNo((p) => p + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
