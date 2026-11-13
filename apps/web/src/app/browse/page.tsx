"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
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
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query: BrowseQuery = {
    q: sp.get("q") ?? undefined, genre: sp.get("genre") ?? undefined, type: sp.get("type") ?? undefined,
    status: sp.get("status") ?? undefined, creator: sp.get("creator") ?? undefined, minChapters: sp.get("minChapters") ?? undefined,
    minRating: sp.get("minRating") ?? undefined, year: sp.get("year") ?? undefined,
    sort: sp.get("sort") ?? "updated", page: sp.get("page") ?? "1",
  };
  const hasActiveFilters = Boolean(query.genre || query.type || query.status || query.minRating || query.year || (query.sort && query.sort !== "updated"));

  useEffect(() => {
    let active = true;
    setLoading(true); setFailed(false);
    browseComics(query)
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setData({ items: [], total: 0, page: 1, pages: 1 });
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  const href = (page: number) => {
    const u = new URLSearchParams(searchParams.toString());
    u.set("page", String(page));
    return `/browse?${u}`;
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

  const pages: number[] = [];
  for (let p = 1; p <= data.pages; p++) {
    if (p === 1 || p === data.pages || Math.abs(p - data.page) <= 2) pages.push(p);
    else if (pages[pages.length - 1] !== -1) pages.push(-1);
  }

  return (
    <div>
      {query.q?.trim() && <Track type="SEARCH" query={query.q.trim().slice(0, 100)} />}

      {/* Hero */}
      <section className="cv-feature rounded-3xl p-6 md:p-8">
        <p className="cv-eyebrow">Discover your next obsession</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Browse Series</h1>
        <p className="mt-2 text-sm text-muted md:text-base" aria-live="polite">
          {loading ? "Searching comics..." : `${data.total} ${data.total === 1 ? "series" : "series"} in the library`}
        </p>
        <form action="/browse" role="search" className="mt-5 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input name="q" defaultValue={query.q} placeholder="Search comics, manga, manhwa…" aria-label="Search series" className="w-full rounded-full border-line bg-card py-3 pl-11 pr-4" />
          </div>
          <button className="shrink-0 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white">Search</button>
        </form>
      </section>

      {/* Collapsible filters (same filter form as before, inside the panel) */}
      <div className="mt-5">
        <button type="button" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen} className="flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2.5 text-sm font-bold hover:border-primary">
          <SlidersHorizontal size={15} className="text-primary" /> Filters
          {hasActiveFilters && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-black text-white">On</span>}
          <ChevronDown size={15} className={`text-muted transition ${filtersOpen ? "rotate-180" : ""}`} />
        </button>
        {filtersOpen && (
          <form action="/browse" className="cv-panel mt-3 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select name="genre" label="Genre" value={query.genre} options={GENRES} />
            <Select name="type" label="Type" value={query.type} options={TYPES} />
            <Select name="status" label="Status" value={query.status} options={STATUSES} />
            <Select name="minRating" label="Minimum rating" value={query.minRating} options={["9", "8", "7", "6"]} />
            <Select name="year" label="Release year" value={query.year} options={years().map(String)} />
            <Select name="sort" label="Sort by" value={query.sort ?? "updated"} options={SORTS} />
            <input type="hidden" name="q" value={query.q ?? ""} />
            <div className="flex items-end gap-2 sm:col-span-2">
              <button className="flex-1 rounded-md bg-primary py-2 text-sm font-semibold">Apply filters</button>
              <Link href="/browse" className="rounded-md border border-line px-3 py-2 text-sm hover:bg-card">Reset</Link>
            </div>
          </form>
        )}
      </div>

      <section className="mt-6">
        {!loading && data.items.length === 0 ? (
          <div className="rounded-lg border border-line bg-card py-16 text-center">
            <p className="font-semibold">No comics match these filters</p>
            <p className="mt-1 text-sm text-muted">Try removing a filter or searching a different title.</p>
            <Link href="/browse" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold">Reset filters</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 lg:grid-cols-4">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton aspect-[2/3]" />)
              : data.items.map((c) => <ComicCard key={c.slug} comic={c} />)}
          </div>
        )}
        {data.pages > 1 && (
          <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-1.5 text-sm">
            {data.page > 1 && <Link href={href(data.page - 1)} className="rounded-full border border-line px-3.5 py-2 font-semibold hover:bg-card">← Prev</Link>}
            {pages.map((p, i) => p === -1 ? (
              <span key={`gap-${i}`} className="px-1 text-muted">…</span>
            ) : (
              <Link key={p} href={href(p)} aria-current={p === data.page ? "page" : undefined} className={`rounded-full px-3.5 py-2 font-bold ${p === data.page ? "bg-primary text-white" : "border border-line hover:bg-card"}`}>{p}</Link>
            ))}
            {data.page < data.pages && <Link href={href(data.page + 1)} className="rounded-full border border-line px-3.5 py-2 font-semibold hover:bg-card">Next →</Link>}
          </nav>
        )}
      </section>
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
