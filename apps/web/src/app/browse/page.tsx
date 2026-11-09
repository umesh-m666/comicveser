"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Track from "@/components/Track";
import ComicCard from "@/components/ComicCard";
import { BrowseQuery, Comic, GENRES, SORTS, STATUSES, TYPES, browseComics, years } from "@/lib/comics";

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

function BrowseContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<{ items: Comic[]; total: number; page: number; pages: number }>({
    items: [],
    total: 0,
    page: 1,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);

  const query: BrowseQuery = {
    q: searchParams.get("q") ?? undefined,
    genre: searchParams.get("genre") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    minRating: searchParams.get("minRating") ?? undefined,
    year: searchParams.get("year") ?? undefined,
    sort: searchParams.get("sort") ?? "updated",
    page: searchParams.get("page") ?? "1",
  };

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
  }, [searchParams.toString()]);

  const href = (page: number) => {
    const u = new URLSearchParams(searchParams.toString());
    u.set("page", String(page));
    return `/browse?${u}`;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      {query.q?.trim() && <Track type="SEARCH" query={query.q.trim().slice(0, 100)} />}
      <form action="/browse" className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <label className="block text-sm"><span className="mb-1 block text-muted">Search</span>
          <input name="q" defaultValue={query.q} placeholder="Title, author, artist" className={sel} />
        </label>
        <Select name="genre" label="Genre" value={query.genre} options={GENRES} />
        <Select name="type" label="Type" value={query.type} options={TYPES} />
        <Select name="status" label="Status" value={query.status} options={STATUSES} />
        <Select name="minRating" label="Minimum rating" value={query.minRating} options={["9", "8", "7", "6"]} />
        <Select name="year" label="Release year" value={query.year} options={years().map(String)} />
        <Select name="sort" label="Sort by" value={query.sort ?? "updated"} options={SORTS} />
        <div className="flex gap-2">
          <button className="flex-1 rounded-md bg-primary py-2 text-sm font-semibold">Apply filters</button>
          <Link href="/browse" className="rounded-md border border-line px-3 py-2 text-sm hover:bg-card">Reset</Link>
        </div>
      </form>

      <section>
        <p className="mb-4 text-sm text-muted" aria-live="polite">
          {loading ? "Searching comics..." : `${data.total} ${data.total === 1 ? "comic" : "comics"} found`}
        </p>
        {!loading && data.items.length === 0 ? (
          <div className="rounded-lg border border-line bg-card py-16 text-center">
            <p className="font-semibold">No comics match these filters</p>
            <p className="mt-1 text-sm text-muted">Try removing a filter or searching a different title.</p>
            <Link href="/browse" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold">Reset filters</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {data.items.map((c) => <ComicCard key={c.slug} comic={c} />)}
          </div>
        )}
        {data.pages > 1 && (
          <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3 text-sm">
            {data.page > 1 && <Link href={href(data.page - 1)} className="rounded-md border border-line px-3 py-1.5 hover:bg-card">Previous</Link>}
            <span className="text-muted">Page {data.page} of {data.pages}</span>
            {data.page < data.pages && <Link href={href(data.page + 1)} className="rounded-md border border-line px-3 py-1.5 hover:bg-card">Next</Link>}
          </nav>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted">Loading comics...</div>}>
      <BrowseContent />
    </Suspense>
  );
}
