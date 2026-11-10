"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import Track from "@/components/Track";
import ComicCard from "@/components/ComicCard";
import EmptyState from "@/components/EmptyState";
import { CardGridSkeleton } from "@/components/LoadingSkeleton";
import { BrowseQuery, Comic, GENRES, MIN_CHAPTER_OPTIONS, SORTS, STATUSES, TYPES, browseComics } from "@/lib/comics";

type Data = { items: Comic[]; total: number; page: number; pages: number };
const EMPTY: Data = { items: [], total: 0, page: 1, pages: 1 };
const FILTER_KEYS = ["genre", "status", "type", "creator", "minChapters", "year", "minRating"] as const;

function useDebounced(value: string, ms: number, onSettle: (v: string) => void) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => onSettle(value), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ms]);
}

function BrowseContent() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const spKey = sp.toString();
  const [data, setData] = useState<Data>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const lastQ = useRef<string | null>(null); // last search text pushed to the URL, so typing is never overwritten
  const [panelOpen, setPanelOpen] = useState(false);

  const query: BrowseQuery = {
    q: sp.get("q") ?? undefined, genre: sp.get("genre") ?? undefined, type: sp.get("type") ?? undefined,
    status: sp.get("status") ?? undefined, creator: sp.get("creator") ?? undefined, minChapters: sp.get("minChapters") ?? undefined,
    minRating: sp.get("minRating") ?? undefined, year: sp.get("year") ?? undefined,
    sort: sp.get("sort") ?? "updated", page: sp.get("page") ?? "1",
  };
  const selectedGenres = (query.genre ?? "").split(",").filter(Boolean);

  const update = useCallback((patch: Record<string, string | null>, keepPage = false) => {
    const u = new URLSearchParams(window.location.search);
    Object.entries(patch).forEach(([k, v]) => { if (v === null || v === "") u.delete(k); else u.set(k, v); });
    if (!keepPage) u.delete("page");
    const qs = u.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname]);

  // Debounced text inputs. Local state keeps typing instant; the URL (and the request) updates after a pause.
  const [qInput, setQInput] = useState(query.q ?? "");
  const [creatorInput, setCreatorInput] = useState(query.creator ?? "");
  useEffect(() => {
    const urlQ = sp.get("q") ?? "";
    if (lastQ.current === null || urlQ !== lastQ.current) setQInput(urlQ); // external change (header search, reset, back button)
    setCreatorInput(sp.get("creator") ?? "");
  }, [spKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useDebounced(qInput, 350, (v) => { lastQ.current = v.trim(); if (v.trim() !== (sp.get("q") ?? "")) update({ q: v.trim() || null }); });
  useDebounced(creatorInput, 450, (v) => { if (v.trim() !== (sp.get("creator") ?? "")) update({ creator: v.trim() || null }); });

  useEffect(() => {
    let active = true;
    setLoading(true); setFailed(false);
    browseComics(query)
      .then((res) => { if (active) { setData(res); setLoading(false); } })
      .catch(() => { if (active) { setData(EMPTY); setFailed(true); setLoading(false); } });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spKey, retry]);

  const toggleGenre = (g: string) => {
    const next = selectedGenres.includes(g) ? selectedGenres.filter((x) => x !== g) : [...selectedGenres, g];
    update({ genre: next.join(",") || null });
  };
  const single = (key: "status" | "type", value: string) => update({ [key]: query[key] === value ? null : value });

  const activeFilters: { key: string; label: string; clear: () => void }[] = [
    ...selectedGenres.map((g) => ({ key: `g-${g}`, label: g, clear: () => toggleGenre(g) })),
    ...(query.status ? [{ key: "status", label: query.status, clear: () => update({ status: null }) }] : []),
    ...(query.type ? [{ key: "type", label: query.type, clear: () => update({ type: null }) }] : []),
    ...(query.creator ? [{ key: "creator", label: `Creator: ${query.creator}`, clear: () => update({ creator: null }) }] : []),
    ...(query.minChapters ? [{ key: "minChapters", label: `${query.minChapters}+ chapters`, clear: () => update({ minChapters: null }) }] : []),
    ...(query.minRating ? [{ key: "minRating", label: `Rating ${query.minRating}+`, clear: () => update({ minRating: null }) }] : []),
    ...(query.year ? [{ key: "year", label: `Year ${query.year}`, clear: () => update({ year: null }) }] : []),
  ];
  const resetAll = () => { lastQ.current = null; setQInput(""); setCreatorInput(""); const u = new URLSearchParams(); const s = sp.get("sort"); if (s) u.set("sort", s); router.replace(u.toString() ? `${pathname}?${u}` : pathname, { scroll: false }); };
  const hasAny = activeFilters.length > 0 || !!query.q;
  const goPage = (p: number) => { update({ page: String(p) }, true); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const panel = (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Genres <span className="font-normal text-muted">(select several)</span></legend>
        <div className="flex flex-wrap gap-1.5">
          {GENRES.map((g) => <button key={g} type="button" className="cv-chip" aria-pressed={selectedGenres.includes(g)} onClick={() => toggleGenre(g)}>{g}</button>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Status</legend>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => <button key={s} type="button" className="cv-chip" aria-pressed={query.status === s} onClick={() => single("status", s)}>{s}</button>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Type</legend>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => <button key={t} type="button" className="cv-chip" aria-pressed={query.type === t} onClick={() => single("type", t)}>{t}</button>)}
        </div>
      </fieldset>
      <label className="block text-sm"><span className="mb-1.5 block font-semibold">Creator</span>
        <input value={creatorInput} onChange={(e) => setCreatorInput(e.target.value)} placeholder="Author or artist" className="w-full px-3 py-2 text-sm" />
      </label>
      <label className="block text-sm"><span className="mb-1.5 block font-semibold">Minimum chapters</span>
        <select value={query.minChapters ?? ""} onChange={(e) => update({ minChapters: e.target.value || null })} className="w-full px-3 py-2 text-sm">
          <option value="">Any</option>
          {MIN_CHAPTER_OPTIONS.map((n) => <option key={n} value={n}>{n}+ chapters</option>)}
        </select>
      </label>
      <button type="button" onClick={resetAll} disabled={!hasAny} className="cv-btn w-full">Reset filters</button>
    </div>
  );

  return (
    <div>
      {query.q?.trim() && <Track type="SEARCH" query={query.q.trim().slice(0, 100)} />}
      <h1 className="text-2xl font-bold md:text-3xl">Browse Series</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2 md:gap-3">
        <div role="search" className="relative min-w-0 flex-1 basis-64">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="browse-q" className="sr-only">Search by title or alternative title</label>
          <input id="browse-q" type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search by title or alternative title..." className="w-full py-2.5 pl-10 pr-20 text-sm [&::-webkit-search-cancel-button]:hidden" />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {loading && <Loader2 size={16} className="animate-spin text-muted" aria-label="Searching" />}
            {qInput && <button type="button" aria-label="Clear search" onClick={() => { setQInput(""); lastQ.current = ""; update({ q: null }); }} className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/10"><X size={15} /></button>}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><span className="sr-only md:not-sr-only md:text-muted">Sort</span>
          <select value={query.sort} onChange={(e) => update({ sort: e.target.value })} className="px-3 py-2 text-sm" aria-label="Sort by">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button type="button" className="cv-btn lg:hidden" aria-expanded={panelOpen} aria-controls="filter-panel" onClick={() => setPanelOpen((o) => !o)}>
          <SlidersHorizontal size={16} aria-hidden />Filters{activeFilters.length > 0 && <span className="rounded-full bg-[#9333ea] px-1.5 text-xs">{activeFilters.length}</span>}
        </button>
      </div>

      {activeFilters.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {activeFilters.map((f) => (
            <button key={f.key} type="button" onClick={f.clear} className="cv-chip" data-active="true" aria-label={`Remove filter ${f.label}`}>{f.label}<X size={12} aria-hidden /></button>
          ))}
          <button type="button" onClick={resetAll} className="px-2 text-xs font-semibold text-primary hover:underline">Clear all</button>
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[17rem_1fr]">
        <aside id="filter-panel" className={`${panelOpen ? "block" : "hidden"} cv-panel h-fit p-4 lg:sticky lg:top-20 lg:block`} aria-label="Filters">{panel}</aside>
        <section aria-live="polite">
          <p className="mb-4 text-sm text-muted">{loading ? "Searching comics..." : `${data.total} ${data.total === 1 ? "comic" : "comics"} found`}</p>
          {loading && data.items.length === 0 ? <CardGridSkeleton count={12} className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 xl:grid-cols-4" /> :
            failed ? <EmptyState title="Couldn't load comics" body="Check your connection and try again." action={{ label: "Retry", onClick: () => setRetry((n) => n + 1) }} /> :
            data.items.length === 0 ? <EmptyState title="No comics match" body={query.q ? `Nothing found for “${query.q}”. Try another title or remove some filters.` : "Try removing a filter or searching a different title."} action={hasAny ? { label: "Reset filters", onClick: resetAll } : undefined} /> : (
              <div className={`grid grid-cols-2 gap-x-4 gap-y-7 transition-opacity sm:grid-cols-3 xl:grid-cols-4 ${loading ? "opacity-50" : ""}`}>
                {data.items.map((c) => <ComicCard key={c.slug} comic={c} />)}
              </div>
            )}
          {data.pages > 1 && (
            <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3 text-sm">
              <button type="button" disabled={data.page <= 1} onClick={() => goPage(data.page - 1)} className="cv-btn">Previous</button>
              <span className="text-muted">Page {data.page} of {data.pages}</span>
              <button type="button" disabled={data.page >= data.pages} onClick={() => goPage(data.page + 1)} className="cv-btn">Next</button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<CardGridSkeleton count={12} />}>
      <BrowseContent />
    </Suspense>
  );
}
