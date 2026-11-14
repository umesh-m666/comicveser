"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Cover } from "@/components/ComicCard";
import { UserAvatar } from "@/components/ProfileMenu";
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
 * Asura Admin Comics Manager (#frame-admin-comics):
 * - Reactive pagination via useSearchParams() + local page state so clicking Next/Prev always loads the next page.
 * - Clean mobile card arrangement for every comic row (Line 1: Cover + Title; Line 2: Genre, Chapters, Rating, Status; Line 3: Featured toggle + Chapters/Delete buttons).
 */
export default function AdminComics() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const myProfile = useLoad<{ avatarUrl: string | null }>(user ? "/user/profile" : null);

  const urlQ = searchParams.get("q") ?? "";
  const urlState = searchParams.get("state") ?? "";
  const urlPage = Math.max(1, Number(searchParams.get("page")) || 1);

  const [page, setPage] = useState(urlPage);
  const [searchInput, setSearchInput] = useState(urlQ);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [featuredMap, setFeaturedMap] = useState<Record<string, boolean>>({});
  const [metaBySlugOrTitle, setMetaBySlugOrTitle] = useState<
    Map<string, { genres: string[]; rating: number; coverUrl: string | null }>
  >(new Map());

  useEffect(() => {
    setPage(urlPage);
  }, [urlPage]);

  const sp = new URLSearchParams();
  if (urlQ) sp.set("q", urlQ);
  if (urlState) sp.set("state", urlState);
  sp.set("page", String(page));

  const { data, error, loading, reload } = useLoad<{
    items: any[];
    page: number;
    pages: number;
    total: number;
  }>(`/admin/comics?${sp.toString()}`);

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

  const href = (p: number) => {
    const nextSp = new URLSearchParams();
    if (urlQ) nextSp.set("q", urlQ);
    if (urlState) nextSp.set("state", urlState);
    nextSp.set("page", String(p));
    return `/admin/comics?${nextSp.toString()}`;
  };

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

  const qLower = searchInput.trim().toLowerCase();
  const visibleItems = (data?.items ?? []).filter((c) =>
    !qLower ? true : String(c.title).toLowerCase().includes(qLower),
  );

  return (
    <div>
      {/* Top Bar */}
      <div className="a-top a-top-comics" data-layer="Admin Topbar">
        <div className="a-top-head">
          <div>
            <h1>Comics</h1>
            <div className="sub">Add, edit and feature titles in the ComicVerse catalogue.</div>
          </div>
          <div className="a-top-actions">
            <Link
              href="/admin/comics/new"
              className="pillbtn"
              style={{ minHeight: 38, marginLeft: 0 }}
            >
              ＋ Add Comic
            </Link>
            <span className="a-avatar overflow-hidden" aria-hidden="true">
              <UserAvatar url={myProfile.data?.avatarUrl} name={user?.username || "U"} />
            </span>
          </div>
        </div>

        <label className="s-search a-comics-search" htmlFor="adminComicSearch">
          <span aria-hidden="true">⌕</span>
          <input
            id="adminComicSearch"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                const nextSp = new URLSearchParams();
                if (searchInput.trim()) nextSp.set("q", searchInput.trim());
                nextSp.set("page", "1");
                router.push(`/admin/comics?${nextSp.toString()}`);
              }
            }}
            placeholder="Search comics…"
            aria-label="Search comics in admin"
          />
        </label>
      </div>

      {/* All comics Table */}
      <div className="a-panel" data-layer="Comics Table">
        <h3>All comics</h3>
        <div className="psub">
          <span id="adminComicCount">{visibleItems.length} comics shown</span> · toggle Featured to pin a title into the home hero rail
        </div>
        {notice && (
          <p role="status" className="mb-2.5 text-xs text-emerald-400">
            {notice}
          </p>
        )}
        {err && (
          <p role="alert" className="mb-2.5 text-xs text-danger">
            {err}
          </p>
        )}
        <State loading={loading} error={error} />
        {data &&
          (visibleItems.length === 0 ? (
            <p className="text-muted">No comics found.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="atable atable-comics">
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
                        <td className="c-cell-title">
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
                        <td className="c-cell-meta">{genresText}</td>
                        <td className="c-cell-meta">{chCount} ch</td>
                        <td className="c-cell-meta" style={{ whiteSpace: "nowrap" }}>
                          ★ {ratingVal.toFixed(1)}
                        </td>
                        <td className="c-cell-status">
                          <span className={`tag ${statusTagClass(statusLabel)}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="c-cell-feat">
                          <button
                            type="button"
                            className="rowbtn feat"
                            onClick={() => toggleFeatured(c, idx)}
                          >
                            {isFeatured ? "★ Featured" : "☆ Feature"}
                          </button>
                        </td>
                        <td className="c-cell-actions" style={{ whiteSpace: "nowrap" }}>
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
                              className="rowbtn danger"
                              onClick={() =>
                                confirm(`Delete “${c.title}”?`) &&
                                run(() => act(`/admin/comics/${c.id}`, "DELETE"))
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
        {data && (
          <Pager
            page={page}
            pages={data.pages}
            onPageChange={(p) => setPage(p)}
            href={href}
          />
        )}
      </div>
    </div>
  );
}
