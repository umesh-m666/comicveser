"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ComicCard from "@/components/ComicCard";
import { BrowseQuery, Comic, GENRES, SORTS, STATUSES, browseComics } from "@/lib/comics";

function MangaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<{ items: Comic[]; total: number; page: number; pages: number }>({
    items: [],
    total: 0,
    page: 1,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [qInput, setQInput] = useState(searchParams.get("q") ?? "");

  const activeGenre = searchParams.get("genre") ?? "";
  const activeStatus = searchParams.get("status") ?? "";
  const activeSort = searchParams.get("sort") ?? "updated";

  const query: BrowseQuery = {
    q: searchParams.get("q") ?? undefined,
    genre: activeGenre || undefined,
    type: "Manga",
    status: activeStatus || undefined,
    sort: activeSort,
    page: searchParams.get("page") ?? "1",
  };
  const hasActiveFilters = Boolean(query.genre || query.status || (query.sort && query.sort !== "updated"));

  useEffect(() => {
    setQInput(searchParams.get("q") ?? "");
  }, [searchParams]);

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

  const updateParams = (patch: Record<string, string | null>, keepPage = false) => {
    const u = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (!v) u.delete(k);
      else u.set(k, v);
    });
    if (!keepPage) u.delete("page");
    const qs = u.toString();
    router.push(qs ? `/manga?${qs}` : "/manga");
  };

  return (
    <div>
      <section className="panel browse-hero" data-layer="Manga Header + Genre Chips">
        <div className="panel-h2">
          <span className="ic" aria-hidden="true">
            ▤
          </span>
          <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: "#fff" }}>
            Manga Library
          </h1>
          <span className="count-badge" style={{ marginLeft: "auto" }} id="mMangaCount">
            {loading ? "…" : `${data.total} manga`}
          </span>
        </div>

        <form
          className="browse-tools"
          onSubmit={(e) => {
            e.preventDefault();
            updateParams({ q: qInput.trim() || null });
          }}
        >
          <label className="s-search" htmlFor="manga-search-q">
            <span aria-hidden="true">⌕</span>
            <input
              id="manga-search-q"
              name="q"
              type="search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search comics, manga, manhwa..."
              aria-label="Search manga"
            />
          </label>

          <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
            STATUS&nbsp;
            <select
              value={activeStatus}
              onChange={(e) => updateParams({ status: e.target.value || null })}
              aria-label="Status"
            >
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
            SORT&nbsp;
            <select
              value={activeSort}
              onChange={(e) => updateParams({ sort: e.target.value })}
              aria-label="Sort by"
            >
              {SORTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </form>

        <div className="browse-tools" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={`chip${!activeGenre ? " on" : ""}`}
            onClick={() => updateParams({ genre: null })}
          >
            All
          </button>
          {GENRES.slice(0, 10).map((g) => (
            <button
              key={g}
              type="button"
              className={`chip${activeGenre === g ? " on" : ""}`}
              onClick={() => updateParams({ genre: activeGenre === g ? null : g })}
            >
              {g}
            </button>
          ))}
        </div>
      </section>

      <section className="panel" data-layer="Manga List" style={{ marginTop: 18 }}>
        {!loading && data.items.length === 0 ? (
          <div className="empty-note" id="mMangaEmpty">
            No manga match these filters. Try another genre or clear the search.
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => router.push("/manga")}
                className="pillbtn"
              >
                Reset filters
              </button>
            </div>
          </div>
        ) : (
          <div className="browse-grid" id="mMangaList">
            {data.items.map((c) => (
              <ComicCard key={c.slug} comic={c} />
            ))}
          </div>
        )}

        {data.pages > 1 && (
          <nav aria-label="Pagination" className="pager">
            {data.page > 1 && (
              <button
                type="button"
                onClick={() => updateParams({ page: String(data.page - 1) }, true)}
              >
                ‹ Previous
              </button>
            )}
            <button type="button" className="on">
              Page {data.page} of {data.pages}
            </button>
            {data.page < data.pages && (
              <button
                type="button"
                onClick={() => updateParams({ page: String(data.page + 1) }, true)}
              >
                Next ›
              </button>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="empty-note">Loading manga...</div>}>
      <MangaContent />
    </Suspense>
  );
}
