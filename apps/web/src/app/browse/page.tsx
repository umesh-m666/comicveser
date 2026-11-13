"use client";

<<<<<<< HEAD
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
=======
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
>>>>>>> 44714f483b778704646c40bf4db1fe37e116786e
import Track from "@/components/Track";
import ComicCard from "@/components/ComicCard";
import { CardGridSkeleton } from "@/components/LoadingSkeleton";
import {
  BrowseQuery,
  Comic,
  GENRES,
  MIN_CHAPTER_OPTIONS,
  SORTS,
  STATUSES,
  TYPES,
  browseComics,
} from "@/lib/comics";

type Data = { items: Comic[]; total: number; page: number; pages: number };
const EMPTY: Data = { items: [], total: 0, page: 1, pages: 1 };

function useDebounced(value: string, ms: number, onSettle: (v: string) => void) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
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
<<<<<<< HEAD
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const lastQ = useRef<string | null>(null);
=======
>>>>>>> 44714f483b778704646c40bf4db1fe37e116786e
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query: BrowseQuery = {
    q: sp.get("q") ?? undefined,
    genre: sp.get("genre") ?? undefined,
    type: sp.get("type") ?? undefined,
    status: sp.get("status") ?? undefined,
    creator: sp.get("creator") ?? undefined,
    minChapters: sp.get("minChapters") ?? undefined,
    minRating: sp.get("minRating") ?? undefined,
    year: sp.get("year") ?? undefined,
    sort: sp.get("sort") ?? "updated",
    page: sp.get("page") ?? "1",
  };
<<<<<<< HEAD
  const selectedGenres = (query.genre ?? "").split(",").filter(Boolean);

  const update = useCallback(
    (patch: Record<string, string | null>, keepPage = false) => {
      const u = new URLSearchParams(window.location.search);
      Object.entries(patch).forEach(([k, v]) => {
        if (v === null || v === "") u.delete(k);
        else u.set(k, v);
      });
      if (!keepPage) u.delete("page");
      const qs = u.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const [qInput, setQInput] = useState(query.q ?? "");
  const [creatorInput, setCreatorInput] = useState(query.creator ?? "");

  useEffect(() => {
    const urlQ = sp.get("q") ?? "";
    if (lastQ.current === null || urlQ !== lastQ.current) setQInput(urlQ);
    setCreatorInput(sp.get("creator") ?? "");
  }, [spKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useDebounced(qInput, 300, (v) => {
    lastQ.current = v.trim();
    if (v.trim() !== (sp.get("q") ?? "")) update({ q: v.trim() || null });
  });
  useDebounced(creatorInput, 400, (v) => {
    if (v.trim() !== (sp.get("creator") ?? "")) update({ creator: v.trim() || null });
  });
=======
  const hasActiveFilters = Boolean(query.genre || query.type || query.status || query.minRating || query.year || (query.sort && query.sort !== "updated"));
>>>>>>> 44714f483b778704646c40bf4db1fe37e116786e

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    browseComics(query)
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
<<<<<<< HEAD
          setData(EMPTY);
          setFailed(true);
=======
          setData({ items: [], total: 0, page: 1, pages: 1 });
>>>>>>> 44714f483b778704646c40bf4db1fe37e116786e
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

<<<<<<< HEAD
  const toggleGenre = (g: string) => {
    const next = selectedGenres.includes(g)
      ? selectedGenres.filter((x) => x !== g)
      : [...selectedGenres, g];
    update({ genre: next.join(",") || null });
=======
  const href = (page: number) => {
    const u = new URLSearchParams(searchParams.toString());
    u.set("page", String(page));
    return `/browse?${u}`;
>>>>>>> 44714f483b778704646c40bf4db1fe37e116786e
  };
  const single = (key: "status" | "type", value: string) =>
    update({ [key]: query[key] === value ? null : value });

  const resetAll = () => {
    lastQ.current = null;
    setQInput("");
    setCreatorInput("");
    const u = new URLSearchParams();
    const s = sp.get("sort");
    if (s) u.set("sort", s);
    router.replace(u.toString() ? `${pathname}?${u}` : pathname, { scroll: false });
  };

  const hasFilters =
    selectedGenres.length > 0 ||
    !!query.status ||
    !!query.type ||
    !!query.creator ||
    !!query.minChapters ||
    !!query.q;

  const goPage = (p: number) => {
    update({ page: String(p) }, true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pages: number[] = [];
  for (let p = 1; p <= data.pages; p++) {
    if (p === 1 || p === data.pages || Math.abs(p - data.page) <= 2) pages.push(p);
    else if (pages[pages.length - 1] !== -1) pages.push(-1);
  }

  return (
    <div>
      {query.q?.trim() && <Track type="SEARCH" query={query.q.trim().slice(0, 100)} />}

<<<<<<< HEAD
      {/* Asura Browse Series Hero Panel */}
      <section className="panel browse-hero" data-layer="Filters / Genre · Status · Sort">
        <div className="panel-h2">
          <span className="ic" aria-hidden="true">
            ▦
          </span>
          <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: "#fff" }}>
            Browse Series
          </h1>
          <span className="count-badge" style={{ marginLeft: "auto" }} id="browseCount">
            {loading ? "…" : data.total}
          </span>
        </div>

        <div className="browse-tools">
          <label className="s-search" htmlFor="browse-q">
            <span aria-hidden="true">⌕</span>
            <input
              id="browse-q"
              type="search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search by title…"
              aria-label="Search by title"
            />
            {qInput && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQInput("");
                  lastQ.current = "";
                  update({ q: null });
                }}
                style={{
                  background: "none",
                  border: 0,
                  color: "var(--muted)",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                ✕
              </button>
            )}
          </label>

          <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
            SORT&nbsp;
            <select
              value={query.sort}
              onChange={(e) => update({ sort: e.target.value })}
              aria-label="Sort comics"
            >
              {SORTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="browse-tools" style={{ marginBottom: filtersOpen ? 14 : 0 }}>
          <button
            type="button"
            className="filters-btn"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            Filters <span aria-hidden="true">⚙</span>
            {hasFilters && (
              <span className="np-count" style={{ marginLeft: 4 }}>
                Active
              </span>
            )}
          </button>
        </div>

        {filtersOpen && (
          <div className="space-y-3 border-t border-[rgba(255,255,255,.08)] pt-3.5">
            <div className="browse-tools" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>GENRES</span>
              <button
                type="button"
                className={`chip${selectedGenres.length === 0 ? " on" : ""}`}
                onClick={() => update({ genre: null })}
              >
                All
              </button>
              {GENRES.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`chip${selectedGenres.includes(g) ? " on" : ""}`}
                  aria-pressed={selectedGenres.includes(g)}
                  onClick={() => toggleGenre(g)}
                >
                  {g}
                </button>
              ))}
            </div>

            <div className="browse-tools" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>STATUS</span>
              <button
                type="button"
                className={`chip${!query.status ? " on" : ""}`}
                onClick={() => update({ status: null })}
              >
                All
              </button>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip${query.status === s ? " on" : ""}`}
                  aria-pressed={query.status === s}
                  onClick={() => single("status", s)}
                >
                  {s}
                </button>
              ))}

              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginLeft: 10 }}>
                TYPE
              </span>
              <button
                type="button"
                className={`chip${!query.type ? " on" : ""}`}
                onClick={() => update({ type: null })}
              >
                All
              </button>
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`chip${query.type === t ? " on" : ""}`}
                  aria-pressed={query.type === t}
                  onClick={() => single("type", t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="browse-tools" style={{ marginBottom: 0 }}>
              <label className="s-search" style={{ minWidth: 200 }}>
                <input
                  value={creatorInput}
                  onChange={(e) => setCreatorInput(e.target.value)}
                  placeholder="Creator / author…"
                  aria-label="Filter by creator"
                />
              </label>
              <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                MIN CHAPTERS&nbsp;
                <select
                  value={query.minChapters ?? ""}
                  onChange={(e) => update({ minChapters: e.target.value || null })}
                >
                  <option value="">Any</option>
                  {MIN_CHAPTER_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}+ chapters
                    </option>
                  ))}
                </select>
              </label>
              {hasFilters && (
                <button type="button" onClick={resetAll} className="pillbtn ghost">
                  Reset filters
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Asura 4-Column Desktop / 2-Column Mobile Unified Comic Grid */}
      <section className="panel" data-layer="Comic Grid" style={{ marginTop: 18 }}>
        {loading && data.items.length === 0 ? (
          <CardGridSkeleton count={12} className="browse-grid" />
        ) : failed ? (
          <div className="empty-note">
            Couldn&apos;t load comics.{" "}
            <button
              type="button"
              onClick={() => setRetry((n) => n + 1)}
              className="pillbtn"
              style={{ marginLeft: 8 }}
            >
              Retry
            </button>
          </div>
        ) : data.items.length === 0 ? (
          <div className="empty-note" id="browseEmpty">
            No comics match those filters. Try a different genre or clear the search.
            {hasFilters && (
              <div style={{ marginTop: 12 }}>
                <button type="button" onClick={resetAll} className="pillbtn">
                  Reset filters
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className={`browse-grid ${loading ? "opacity-60" : ""}`} id="browseGrid">
            {data.items.map((c) => (
              <ComicCard key={c.slug} comic={c} />
            ))}
          </div>
        )}

        {data.pages > 1 && (
          <nav aria-label="Pagination" className="pager">
            <button
              type="button"
              disabled={data.page <= 1}
              onClick={() => goPage(data.page - 1)}
            >
              ‹ Prev
            </button>
            <button type="button" className="on">
              {data.page} / {data.pages}
            </button>
            <button
              type="button"
              disabled={data.page >= data.pages}
              onClick={() => goPage(data.page + 1)}
            >
              Next ›
            </button>
=======
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
>>>>>>> 44714f483b778704646c40bf4db1fe37e116786e
          </nav>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<CardGridSkeleton count={12} className="browse-grid" />}>
      <BrowseContent />
    </Suspense>
  );
}
