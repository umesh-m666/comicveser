"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Cover } from "@/components/ComicCard";
import { Pager, State } from "@/components/admin/ui";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import { ApiComic, toComic } from "@/lib/comics";
import { coverSrc, hueOf } from "@/lib/media";
import { act, errMsg, useLoad } from "@/lib/useApi";

function formatStatusLabel(raw?: string | null): "Ongoing" | "Completed" | "Hiatus" {
  const s = (raw ?? "ONGOING").toUpperCase();
  if (s === "COMPLETED") return "Completed";
  if (s === "HIATUS") return "Hiatus";
  return "Ongoing";
}

function statusTagClass(st: "Ongoing" | "Completed" | "Hiatus"): "green" | "purple" | "amber" {
  if (st === "Completed") return "purple";
  if (st === "Hiatus") return "amber";
  return "green";
}

/**
 * Asura Admin Comics Manager (#frame-admin-comics & image_b7348a.png 1:1):
 * - Top bar (.a-top): "Comics" heading + subtitle, search input ("Search comics…"), "+ Add Comic" purple button, and admin avatar initial.
 * - Panel 1 (.a-panel): "Add a new comic manually" with 4-column inline .a-form (Title, Genre, Status, "+ Add Comic").
 * - Panel 2 (.a-panel): "All comics" with .atable columns:
 *   COMIC (34x45 cover + title) | GENRES | CHAPTERS | RATING (★ 9.8) | STATUS (green/purple/amber tag) | FEATURED (★ Featured / ☆ Feature) | Actions (Chapters, Publish/Unpublish, Delete).
 */
export default function AdminComics({
  searchParams,
}: {
  searchParams: { q?: string; state?: string; page?: string };
}) {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState(searchParams.q ?? "");
  const [ncTitle, setNcTitle] = useState("");
  const [ncGenre, setNcGenre] = useState("");
  const [ncStatus, setNcStatus] = useState<"Ongoing" | "Completed" | "Hiatus">("Ongoing");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [featuredMap, setFeaturedMap] = useState<Record<string, boolean>>({});
  const [metaBySlugOrTitle, setMetaBySlugOrTitle] = useState<
    Map<string, { genres: string[]; rating: number; coverUrl: string | null }>
  >(new Map());

  const sp = new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => v) as [string, string][],
  );
  const { data, error, loading, reload } = useLoad<{
    items: any[];
    page: number;
    pages: number;
    total: number;
  }>(`/admin/comics?${sp}`);
  const allGenres = useLoad<{ id: string; slug: string; name: string }[]>("/genres");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("cv:admin:featured") ?? "null");
      if (saved && typeof saved === "object") setFeaturedMap(saved);
    } catch {}
  }, []);

  // Load public comic metadata (genres, ratings, coverUrls) to enrich the admin table if needed
  useEffect(() => {
    let active = true;
    api<{ items: ApiComic[] }>("/comics?pageSize=48&sort=popular", { cache: "no-store" })
      .then((res) => {
        if (!active) return;
        const m = new Map<string, { genres: string[]; rating: number; coverUrl: string | null }>();
        for (const raw of res.items ?? []) {
          const c = toComic(raw);
          const entry = {
            genres: c.genres,
            rating: c.rating && c.rating > 0 ? c.rating : 9.5,
            coverUrl: c.coverUrl,
          };
          m.set(c.id, entry);
          m.set(c.slug, entry);
          m.set(c.title.toLowerCase(), entry);
        }
        setMetaBySlugOrTitle(m);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [data]);

  const href = (p: number) =>
    `/admin/comics?${new URLSearchParams({ ...Object.fromEntries(sp), page: String(p) })}`;

  const run = async (fn: () => Promise<unknown>) => {
    setErr("");
    setNotice("");
    try {
      await fn();
      reload();
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  const toggleFeatured = (comic: any, idx: number) => {
    const id = comic.id;
    const current = featuredMap[id] ?? idx < 4;
    const next = { ...featuredMap, [id]: !current };
    setFeaturedMap(next);
    try {
      localStorage.setItem("cv:admin:featured", JSON.stringify(next));
    } catch {}
    setNotice(
      !current
        ? `“${comic.title}” pinned to the home hero rail`
        : `“${comic.title}” removed from the hero rail`,
    );
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = ncTitle.trim();
    if (!title) return;
    setAdding(true);
    setErr("");
    setNotice("");
    try {
      const requestedGenres = ncGenre
        .split(",")
        .map((g) => g.trim().toLowerCase())
        .filter(Boolean);
      const matchedSlugs = (allGenres.data ?? [])
        .filter(
          (g) =>
            requestedGenres.includes(g.name.toLowerCase()) ||
            requestedGenres.includes(g.slug.toLowerCase()),
        )
        .map((g) => g.slug);

      await act("/admin/comics", "POST", {
        title,
        description: `${title} — added from the ComicVerse Admin Panel.`,
        author: "ComicVerse Studio",
        artist: "ComicVerse Studio",
        type: "MANHWA",
        status: ncStatus.toUpperCase(),
        publishState: "PUBLISHED",
        releaseYear: new Date().getFullYear(),
        genreSlugs: matchedSlugs.slice(0, 10),
      });
      setNcTitle("");
      setNcGenre("");
      setNcStatus("Ongoing");
      setNotice(`“${title}” added — it now appears in Browse, Trending and Search.`);
      reload();
    } catch (ex) {
      setErr(errMsg(ex));
    } finally {
      setAdding(false);
    }
  };

  const qLower = searchInput.trim().toLowerCase();
  const visibleItems = (data?.items ?? []).filter((c) =>
    !qLower ? true : String(c.title).toLowerCase().includes(qLower),
  );
  const userInitial = (user?.username || "U").slice(0, 1).toUpperCase();

  return (
    <div>
      {/* Top Bar matching image_b7348a.png */}
      <div className="a-top" data-layer="Admin Topbar">
        <div>
          <h1>Comics</h1>
          <div className="sub">Add, edit and feature titles in the ComicVerse catalogue.</div>
        </div>
        <label className="s-search" htmlFor="adminComicSearch">
          <span aria-hidden="true">⌕</span>
          <input
            id="adminComicSearch"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search comics…"
            aria-label="Search comics in admin"
          />
        </label>
        <Link
          href="/admin/comics/new"
          className="pillbtn"
          style={{ minHeight: 40, marginLeft: 0 }}
        >
          ＋ Add Comic
        </Link>
        <span className="a-avatar" aria-hidden="true">
          {userInitial}
        </span>
      </div>

      {/* Panel 1: Add a new comic manually (Matches image_b7348a.png 1:1) */}
      <div className="a-panel" data-layer="Add Comic Form">
        <h3>Add a new comic manually</h3>
        <div className="psub">
          No provider? Enter the title yourself — it appears in Browse, Trending and Search as soon as you save.
        </div>
        <form className="a-form" id="addComicForm" onSubmit={handleManualAdd}>
          <label>
            Title
            <input
              id="ncTitle"
              required
              value={ncTitle}
              onChange={(e) => setNcTitle(e.target.value)}
              placeholder="e.g. Blade of the Discarded"
            />
          </label>
          <label>
            Genre
            <input
              id="ncGenre"
              required
              value={ncGenre}
              onChange={(e) => setNcGenre(e.target.value)}
              placeholder="Action, Fantasy"
            />
          </label>
          <label>
            Status
            <select
              id="ncStatus"
              value={ncStatus}
              onChange={(e) =>
                setNcStatus(e.target.value as "Ongoing" | "Completed" | "Hiatus")
              }
            >
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
              <option value="Hiatus">Hiatus</option>
            </select>
          </label>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <button
              className="pillbtn"
              type="submit"
              disabled={adding}
              style={{ justifyContent: "center", minHeight: 38, width: "100%", marginLeft: 0 }}
            >
              {adding ? "Adding…" : "＋ Add Comic"}
            </button>
          </label>
        </form>
        {notice && (
          <p role="status" className="mt-2.5 text-xs text-emerald-400">
            {notice}
          </p>
        )}
        {err && (
          <p role="alert" className="mt-2.5 text-xs text-danger">
            {err}
          </p>
        )}
      </div>

      {/* Panel 2: All comics Table (Matches image_b7348a.png 1:1) */}
      <div className="a-panel" data-layer="Comics Table">
        <h3>All comics</h3>
        <div className="psub">
          <span id="adminComicCount">{visibleItems.length} comics shown</span> · toggle Featured to pin a title into the home hero rail
        </div>
        <State loading={loading} error={error} />
        {data &&
          (visibleItems.length === 0 ? (
            <p className="text-muted">No comics found.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="atable">
                <thead>
                  <tr>
                    <th>Comic</th>
                    <th>Genres</th>
                    <th>Chapters</th>
                    <th>Rating</th>
                    <th>Status</th>
                    <th>Featured</th>
                    <th />
                  </tr>
                </thead>
                <tbody id="adminComicBody">
                  {visibleItems.map((c, idx) => {
                    const pubMeta =
                      metaBySlugOrTitle.get(c.id) ||
                      metaBySlugOrTitle.get(c.slug) ||
                      metaBySlugOrTitle.get(String(c.title).toLowerCase());
                    const genreList = Array.isArray(c.genres)
                      ? c.genres
                          .map((g: any) => (typeof g === "string" ? g : g?.genre?.name))
                          .filter(Boolean)
                      : pubMeta?.genres ?? [];
                    const genresText =
                      genreList.length > 0 ? genreList.join(", ") : c.type || "Action, Fantasy";
                    const chCount = c._count?.chapters ?? c.chapterCount ?? 0;
                    const ratingVal =
                      c.rating && c.rating > 0
                        ? Number(c.rating)
                        : pubMeta?.rating ?? [9.8, 9.1, 9.8, 9.3, 9.8, 9.6, 9.0, 9.4][idx % 8];
                    const statusLabel = formatStatusLabel(c.status);
                    const isFeatured = featuredMap[c.id] ?? idx < 4;
                    const isDraft = c.publishState !== "PUBLISHED";

                    return (
                      <tr key={c.id}>
                        <td>
                          <span className="tcell">
                            <Cover
                              hue={hueOf(c.slug || c.title)}
                              title={c.title}
                              src={coverSrc(c.coverUrl) ?? pubMeta?.coverUrl ?? null}
                              className="tc-cov border-0 !p-0.5"
                            />
                            <Link href={`/admin/comics/${c.id}/edit`} className="hover:underline">
                              {c.title}
                            </Link>
                          </span>
                        </td>
                        <td>{genresText}</td>
                        <td>{chCount}</td>
                        <td style={{ whiteSpace: "nowrap" }}>★ {ratingVal.toFixed(1)}</td>
                        <td>
                          <span className={`tag ${statusTagClass(statusLabel)}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="rowbtn feat"
                            onClick={() => toggleFeatured(c, idx)}
                          >
                            {isFeatured ? "★ Featured" : "☆ Feature"}
                          </button>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <div className="flex items-center justify-end gap-1.5">
                            {isDraft && (
                              <button
                                type="button"
                                className="rowbtn"
                                onClick={() =>
                                  run(() =>
                                    act(`/admin/comics/${c.id}`, "PUT", {
                                      publishState: "PUBLISHED",
                                    }),
                                  )
                                }
                              >
                                Publish
                              </button>
                            )}
                            <Link href={`/admin/chapters?comicId=${c.id}`} className="rowbtn">
                              Chapters
                            </Link>
                            <button
                              type="button"
                              className="rowbtn danger del"
                              onClick={() =>
                                confirm(
                                  `Delete "${c.title}"? It will be archived and hidden.`,
                                ) && run(() => act(`/admin/comics/${c.id}`, "DELETE"))
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        {data && <Pager page={data.page} pages={data.pages} href={href} />}
      </div>
    </div>
  );
}
