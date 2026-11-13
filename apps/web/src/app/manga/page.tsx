"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import ComicCard from "@/components/ComicCard";
import { BrowseQuery, Comic, GENRES, SORTS, STATUSES, browseComics } from "@/lib/comics";

const sel = "w-full rounded-md border border-line bg-surface px-2 py-2 text-sm";

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: readonly (string | readonly [string, string])[] }) {
  return (
    <label className="block text-sm"><span className="mb-1 block text-muted">{label}</span>
      <select name={name} defaultValue={value ?? ""} className={sel}>
        {name !== "sort" && <option value="">Any</option>}
        {options.map((o) => { const [v, l] = typeof o === "string" ? [o, o] : o; return <option key={v} value={v}>{l}</option>; })}
      </select>
    </label>
  );
}

function MangaContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<{ items: Comic[]; total: number; page: number; pages: number }>({
    items: [],
    total: 0,
    page: 1,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query: BrowseQuery = {
    q: searchParams.get("q") ?? undefined,
    genre: searchParams.get("genre") ?? undefined,
    type: "Manga",
    status: searchParams.get("status") ?? undefined,
    sort: searchParams.get("sort") ?? "updated",
    page: searchParams.get("page") ?? "1",
  };
  const hasActiveFilters = Boolean(query.genre || query.status || (query.sort && query.sort !== "updated"));

  useEffect(() => {
    let active = true;
    setLoading(true);
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
    u.set("type", "Manga");
    return `/manga?${u}`;
  };

  const pages: number[] = [];
  for (let p = 1; p <= data.pages; p++) {
    if (p === 1 || p === data.pages || Math.abs(p - data.page) <= 2) pages.push(p);
    else if (pages[pages.length - 1] !== -1) pages.push(-1);
  }

  return (
    <div>
      {/* Hero */}
      <section className="cv-feature rounded-3xl p-6 md:p-8">
        <p className="cv-eyebrow">Japanese classics & new hits</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Manga</h1>
        <p className="mt-2 text-sm text-muted md:text-base" aria-live="polite">
          {loading ? "Searching manga..." : `${data.total} ${data.total === 1 ? "manga title" : "manga titles"} in the library`}
        </p>
        <form action="/manga" role="search" className="mt-5 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input name="q" defaultValue={query.q} placeholder="Search manga…" aria-label="Search manga" className="w-full rounded-full border-line bg-card py-3 pl-11 pr-4" />
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
          <form action="/manga" className="cv-panel mt-3 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select name="genre" label="Genre" value={query.genre} options={GENRES} />
            <Select name="status" label="Status" value={query.status} options={STATUSES} />
            <Select name="sort" label="Sort by" value={query.sort ?? "updated"} options={SORTS} />
            <input type="hidden" name="type" value="Manga" />
            <input type="hidden" name="q" value={query.q ?? ""} />
            <div className="flex items-end gap-2 sm:col-span-2">
              <button className="flex-1 rounded-md bg-primary py-2 text-sm font-semibold">Apply filters</button>
              <Link href="/manga" className="rounded-md border border-line px-3 py-2 text-sm hover:bg-card">Reset</Link>
            </div>
          </form>
        )}
      </div>

      <section className="mt-6">
        {!loading && data.items.length === 0 ? (
          <div className="rounded-lg border border-line bg-card py-16 text-center">
            <p className="font-semibold">No manga match these filters</p>
            <p className="mt-1 text-sm text-muted">Try removing a filter or searching a different title.</p>
            <Link href="/manga" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold">Reset filters</Link>
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
    <Suspense fallback={<div className="p-8 text-center text-muted">Loading manga...</div>}>
      <MangaContent />
    </Suspense>
  );
}
