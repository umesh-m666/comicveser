"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cover } from "@/components/ComicCard";
import { ApiError, api } from "@/lib/api";
import { ExtChapter, MangaDetails, Paged, cap, hueOf, media } from "@/lib/sources";
import { act } from "@/lib/useApi";
import AvailableSourceChapters from "./AvailableSourceChapters";
import { Badge, btn, btnGhost } from "./ui";

type Review = { state: "APPROVED" | "REJECTED" | "UNPUBLISHED"; role?: string; reviewNote: string | null; comic: { id: string; slug: string; publishState: string } | null } | null;
type Details = MangaDetails & { review: Review };
type CatalogChapters = Paged<ExtChapter> & { upstreamUnavailable?: boolean; upstreamMessage?: string };

export default function SourceTitleReview({ sourceId, sourceName, externalId, enabled }: { sourceId: string; sourceName: string; externalId: string; enabled: boolean }) {
  const CHAPTER_SIZE = sourceId === "comick" ? 20 : 500;
  const [details, setDetails] = useState<Details | null>(null);
  const [detailError, setDetailError] = useState("");
  const [language, setLanguage] = useState("en");
  const [chapterPage, setChapterPage] = useState(1);
  const [chapters, setChapters] = useState<CatalogChapters | null>(null);
  const [chapterError, setChapterError] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!enabled || !externalId) return;
    let live = true;
    setDetails(null);
    setDetailError("");
    api<Details>(`/admin/sources/catalog/${sourceId}/${encodeURIComponent(externalId)}`, { credentials: "include", cache: "no-store" })
      .then((response) => {
        if (!live) return;
        setDetails(response);
        setLanguage(response.availableLanguages.includes("en") ? "en" : response.availableLanguages[0] ?? "en");
      })
      .catch((error) => live && setDetailError(error instanceof ApiError ? error.message : "Could not load title details."));
    return () => { live = false; };
  }, [sourceId, externalId, enabled]);

  useEffect(() => {
    if ((!details && !detailError) || !enabled || !externalId || sourceId === "comick") return;
    let live = true;
    setChapters(null);
    setChapterError("");
    const params = new URLSearchParams({ language, page: String(chapterPage), limit: String(CHAPTER_SIZE) });
    api<CatalogChapters>(`/admin/sources/catalog/${sourceId}/${encodeURIComponent(externalId)}/chapters?${params}`, { credentials: "include", cache: "no-store" })
      .then((response) => live && setChapters(response))
      .catch((error) => live && setChapterError(error instanceof ApiError ? error.message : "Could not load chapters."));
    return () => { live = false; };
  }, [sourceId, externalId, details, detailError, language, chapterPage, enabled, CHAPTER_SIZE]);

  async function action(name: string, method: string, body?: unknown) {
    if (!externalId) return;
    setBusy(name);
    setNotice("");
    setActionError("");
    try {
      const url = `/admin/sources/catalog/${sourceId}/${encodeURIComponent(externalId)}/${name}`;
      const result = await act<{ slug?: string; importedChapters?: number; imported?: number; hasMoreChapters?: boolean; requiresFallback?: boolean }>(url, method, body);
      if (name === "approve" && result?.slug) {
        if ((result.importedChapters ?? 0) > 0) {
          setNotice(`Published and imported ${result.importedChapters} chapters${sourceId === "comick" ? " via automatic alternative source match." : "."}`);
        } else if (sourceId === "comick" || result.requiresFallback) {
          setNotice("ComicK title published. Select a matching WeebCentral or Asura Scans series below to import chapters.");
        } else {
          setNotice(`Published. ${result.importedChapters ?? 0} chapters imported.`);
        }
      } else if (name.startsWith("chapters/import")) setNotice(`${result?.imported ?? 0} chapters imported.`);
      else setNotice(name === "republish" ? "Title republished." : name === "unpublish" ? "Title unpublished." : name === "reject" ? "Title rejected." : "Updated.");
      const updated = await api<Details>(`/admin/sources/catalog/${sourceId}/${encodeURIComponent(externalId)}`, { credentials: "include", cache: "no-store" }).catch(() => null);
      if (updated) setDetails(updated);
      if (sourceId !== "comick" && (name.startsWith("chapters/import") || name === "approve")) {
        const params = new URLSearchParams({ language, page: String(chapterPage), limit: String(CHAPTER_SIZE) });
        const refreshed = await api<CatalogChapters>(`/admin/sources/catalog/${sourceId}/${encodeURIComponent(externalId)}/chapters?${params}`, { credentials: "include", cache: "no-store" }).catch(() => null);
        if (refreshed) setChapters(refreshed);
      }
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "The action failed.");
    } finally {
      setBusy("");
    }
  }

  const currentState = details?.review?.state ?? null;
  const approvedComicId = details?.review?.comic?.id ?? null;
  const actionLabel = (name: string, idle: string, working: string) => busy === name ? working : idle;
  const languageOptions = Array.from(new Set(["en", ...(details?.availableLanguages ?? [])]));

  if (!enabled) return <p role="status" className="rounded-lg border border-line p-5 text-sm text-muted">This provider is disabled. Enable it in Admin → Sources to inspect this title.</p>;

  return (
    <section className="space-y-5">
      <header className="rounded-xl border border-line bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{sourceName} · title review</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-2xl font-bold">Inspect title</h1><p className="mt-1 text-xs text-muted">Provider ID: {externalId}</p></div>
          <Link href={`/admin/comics/new/${encodeURIComponent(sourceId)}`} className={btnGhost}>← Back to search results</Link>
        </div>
      </header>

      {detailError && <p role="alert" className="rounded-lg border border-danger/40 p-3 text-sm text-danger">{detailError}</p>}
      {!details && !detailError && <div className="rounded-xl border border-line bg-card p-8 text-center text-sm text-muted" aria-busy="true">Loading title details from {sourceName}…</div>}
      {details && (
        <section className="grid gap-5 rounded-xl border border-line bg-card p-5 sm:grid-cols-[150px_minmax(0,1fr)]">
          <Cover hue={hueOf(details.externalId)} title={details.title} src={media(details.coverUrl)} className="aspect-[2/3] w-36 rounded-lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-2xl font-bold">{details.title}</h2><Badge v={currentState ?? "PENDING"} /></div>
            {details.alternativeTitles.length > 0 && <p className="mt-1 text-sm text-muted">{details.alternativeTitles.join(" · ")}</p>}
            <p className="mt-3 text-sm text-muted">{cap(details.contentType)}{details.status ? ` · ${cap(details.status)}` : ""}{details.year ? ` · ${details.year}` : ""} · {details.language ?? "en"}</p>
            <p className="mt-2 text-sm">Author: {details.authors.join(", ") || "Unknown"} <span className="text-muted">·</span> Artist: {details.artists.join(", ") || "Unknown"}</p>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted">{details.description || "No description is available from this provider."}</p>
            {details.genres.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{details.genres.map((genre) => <span key={genre} className="rounded-full border border-line px-2 py-1 text-xs text-muted">{genre}</span>)}</div>}
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <a className="text-primary underline underline-offset-4" href={details.sourceUrl} target="_blank" rel="noopener noreferrer">Open source title ↗</a>
              {details.review?.comic?.slug && <Link className="text-primary underline underline-offset-4" href={`/comics/${details.review.comic.slug}`} target="_blank">Open ComicVerse publication ↗</Link>}
              {approvedComicId && <Link className="text-primary underline underline-offset-4" href={`/admin/chapters?comicId=${approvedComicId}`}>Manage chapters in Admin ↗</Link>}
            </div>
            {details.review?.reviewNote && <p className="mt-3 rounded-md border border-line p-3 text-sm text-muted">Review note: {details.review.reviewNote}</p>}
          </div>
        </section>
      )}

      {(details || detailError) && (
        <>
          <section className="rounded-xl border border-line bg-card p-5">
            <div>
              <h2 className="text-lg font-bold">Publication actions</h2>
              <p className="mt-1 text-sm text-muted">
                {sourceId === "comick"
                  ? "Approving saves the ComicK metadata and automatically links & imports chapters from WeebCentral or Asura Scans."
                  : "Approval publishes the ComicVerse title and imports its first chapter page."}
              </p>
            </div>
            {notice && <p role="status" className="mt-4 rounded-md border border-primary/30 p-3 text-sm text-primary">{notice}</p>}
            {actionError && <p role="alert" className="mt-4 rounded-md border border-danger/40 p-3 text-sm text-danger">{actionError}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {(!currentState || currentState === "REJECTED") && <>
                <button type="button" disabled={!!busy} className={btn} onClick={() => action("approve", "POST", { language })}>
                  {actionLabel("approve", "Approve & publish", "Publishing…")}
                </button>
                <button type="button" disabled={!!busy} className={btnGhost} onClick={() => action("reject", "POST", {})}>{actionLabel("reject", "Reject title", "Rejecting…")}</button>
              </>}
              {currentState === "APPROVED" && <button type="button" disabled={!!busy} onClick={() => action("unpublish", "POST")} className={btnGhost}>{actionLabel("unpublish", "Unpublish", "Unpublishing…")}</button>}
              {currentState === "UNPUBLISHED" && <button type="button" disabled={!!busy} onClick={() => action("republish", "POST")} className={btn}>{actionLabel("republish", "Republish", "Republishing…")}</button>}
              {sourceId !== "comick" && (currentState === "APPROVED" || currentState === "UNPUBLISHED") && chapters && (chapters.items.length > 0 || chapterPage > 1 || chapters.hasMore) && (
                <button type="button" disabled={!!busy} onClick={() => action(`chapters/import?page=${chapterPage}&language=${encodeURIComponent(language)}&limit=${CHAPTER_SIZE}`, "POST")}>
                  {busy.startsWith("chapters/import") ? "Importing…" : `Import chapter page ${chapterPage}`}
                </button>
              )}
            </div>
          </section>

          {approvedComicId ? (
            <AvailableSourceChapters comicId={approvedComicId} onImported={() => {}} />
          ) : sourceId !== "comick" && (
            <section className="rounded-xl border border-line bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-lg font-bold">Chapter catalogue</h2><p className="mt-1 text-sm text-muted">Review the source chapters before importing them into ComicVerse.</p></div>
                <label className="text-sm text-muted">Language <select className="ml-2 rounded-md border border-line bg-surface px-3 py-2 text-foreground" value={language} onChange={(event) => { setLanguage(event.target.value); setChapterPage(1); }}>{languageOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              </div>
              {chapterError && <p role="alert" className="mt-4 text-sm text-danger">{chapterError}</p>}
              {!chapters && !chapterError && <p className="mt-5 text-sm text-muted" aria-busy="true">Checking chapter catalogue…</p>}
              {chapters && (
                <>
                  <p className="mt-4 text-xs text-muted">{chapters.total.toLocaleString()} chapters · page {chapterPage} · up to {CHAPTER_SIZE} per page</p>
                  {chapters.items.length === 0 ? <p className="mt-3 rounded-lg border border-line p-5 text-center text-sm text-muted">No chapters were returned for this language.</p> : (
                    <div className="mt-3 overflow-hidden rounded-lg border border-line">
                      <ul className="divide-y divide-line">{chapters.items.map((chapter) => (
                        <li key={chapter.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                          <div className="min-w-0"><p className="font-medium">{chapter.numberLabel ? `Chapter ${chapter.numberLabel}` : "Special chapter"}{chapter.title ? `: ${chapter.title}` : ""}</p><p className="mt-1 text-xs text-muted">{chapter.groups.join(", ") || "Unknown group"}{chapter.pageCount ? ` · ${chapter.pageCount} pages` : ""}{chapter.language ? ` · ${chapter.language}` : ""}</p></div>
                          <span className="text-xs text-muted">{chapter.publishedAt ? new Date(chapter.publishedAt).toLocaleDateString() : "Date unknown"}</span>
                        </li>
                      ))}</ul>
                    </div>
                  )}
                  {(chapterPage > 1 || chapters.hasMore) && <div className="mt-4 flex items-center justify-center gap-3 text-sm"><button type="button" disabled={chapterPage <= 1} onClick={() => setChapterPage((page) => Math.max(1, page - 1))} className="rounded-md border border-line px-3 py-2 disabled:opacity-40">Previous</button><span className="text-muted">Page {chapterPage}</span><button type="button" disabled={!chapters.hasMore || chapterPage * CHAPTER_SIZE >= 10_000} onClick={() => setChapterPage((page) => page + 1)} className="rounded-md border border-line px-3 py-2 disabled:opacity-40">Next</button></div>}
                </>
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}
