"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { act, errMsg, useLoad } from "@/lib/useApi";
import type { AlternativeSourceMatch, ExtChapter, Paged } from "@/lib/sources";
import { State, btn, btnGhost } from "./ui";

const DEFAULT_PAGE_SIZE = 500;

interface AvailableChapters {
  source: { id: string; externalId: string; title: string; state: string; displayName: string; availableLanguages: string[] } | null;
  chapters: Paged<ExtChapter & { imported: boolean }> | null;
  alternatives?: AlternativeSourceMatch[];
}

export default function AvailableSourceChapters({ comicId, onImported }: { comicId: string; onImported: () => void }) {
  const [language, setLanguage] = useState("en");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [altBusy, setAltBusy] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const params = new URLSearchParams({ language, page: String(page), limit: String(DEFAULT_PAGE_SIZE) });
  const { data, error, loading, reload } = useLoad<AvailableChapters>(`/admin/sources/comics/${comicId}/chapters?${params}`);
  const pageSize = data?.chapters?.limit ?? (data?.source?.id === "comick" ? 20 : DEFAULT_PAGE_SIZE);

  useEffect(() => {
    const languages = data?.source?.availableLanguages ?? [];
    if (languages.length && !languages.includes(language)) {
      setLanguage(languages.includes("en") ? "en" : languages[0]);
      setPage(1);
    }
  }, [data?.source?.availableLanguages, language]);

  async function importPage() {
    if (!data?.source) return;
    setBusy(true);
    setErrorMessage("");
    setNotice("");
    try {
      const { source } = data;
      const query = new URLSearchParams({ language, page: String(page), limit: String(pageSize) });
      const result = await act<{ imported: number }>(`/admin/sources/catalog/${source.id}/${encodeURIComponent(source.externalId)}/chapters/import?${query}`, "POST");
      setNotice(`${result.imported} chapter${result.imported === 1 ? "" : "s"} imported.`);
      onImported();
      reload();
    } catch (e) {
      setErrorMessage(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function importAlternative(alt: AlternativeSourceMatch) {
    const key = `${alt.sourceId}:${alt.externalId}`;
    setAltBusy(key);
    setErrorMessage("");
    setNotice("");
    try {
      const result = await act<{ imported: number; linkedExisting: number }>(
        `/admin/sources/comics/${encodeURIComponent(comicId)}/chapters/import-alternative`,
        "POST",
        { sourceId: alt.sourceId, externalId: alt.externalId, language, page: 1, limit: DEFAULT_PAGE_SIZE },
      );
      setNotice(
        `${alt.sourceName} (ID: ${alt.externalId}): ${result.imported} new chapter${result.imported === 1 ? "" : "s"} imported and ${result.linkedExisting} existing ComicK chapter${result.linkedExisting === 1 ? "" : "s"} linked to ${alt.sourceName} chapter IDs.`,
      );
      onImported();
      reload();
    } catch (e) {
      setErrorMessage(errMsg(e));
    } finally {
      setAltBusy("");
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-line bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Available source chapters</h2>
        {data?.source && <label className="text-sm">Language
          <select className="ml-2 rounded-md border border-line bg-surface px-2 py-1.5" value={language} onChange={(e) => { setLanguage(e.target.value); setPage(1); setNotice(""); }}>
            {(data.source.availableLanguages.length ? data.source.availableLanguages : ["en"]).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>}
      </div>
      <State loading={loading} error={error} />
      {data && !data.source && <p className="text-sm text-muted">This comic has no linked external source. Chapters imported through External source approval will appear here.</p>}
      {data?.source && data.chapters && <>
        <p className="mb-2 text-xs text-muted">{data.source.displayName} (ID: {data.source.externalId}) · {data.chapters.total.toLocaleString()} chapters · page {page} · {pageSize} per page</p>
        {data.chapters.items.length === 0 ? <p className="rounded-md border border-line p-3 text-sm text-muted">No chapters available in this language.</p> : (
          <ul className="max-h-96 divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {data.chapters.items.map((chapter) => <li key={chapter.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span><strong>{chapter.numberLabel ? `Chapter ${chapter.numberLabel}` : "Special"}</strong>{chapter.title ? `: ${chapter.title}` : ""}
                <span className="block text-xs text-muted">{chapter.groups.join(", ") || "Unknown group"} · ID: {chapter.id}{chapter.pageCount ? ` · ${chapter.pageCount} pages` : ""}</span>
              </span>
              <span className="text-xs text-muted">{chapter.imported ? "Imported" : chapter.publishedAt ? new Date(chapter.publishedAt).toLocaleDateString("en-IN") : "Available"}</span>
            </li>)}
          </ul>)}
        {(page > 1 || data.chapters.hasMore) && <div className="mt-3 flex justify-center gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className={`${btnGhost} disabled:opacity-40`}>Previous</button>
          <span className="py-1 text-muted">Page {page}</span>
          <button type="button" disabled={!data.chapters.hasMore || page * pageSize >= 10_000} onClick={() => setPage((value) => value + 1)} className={`${btnGhost} disabled:opacity-40`}>Next</button>
        </div>}
        {["APPROVED", "UNPUBLISHED"].includes(data.source.state) && data.chapters.items.some((chapter) => !chapter.imported) &&
          <button type="button" disabled={busy} onClick={importPage} className={`${btnGhost} mt-3 disabled:opacity-50`}>{busy ? "Importing…" : `Import available chapters on page ${page}`}</button>}
      </>}

      {data?.alternatives && data.alternatives.length > 0 && (
        <div className="mt-6 border-t border-line pt-4">
          <h3 className="text-base font-bold">Alternative chapter sources (WeebCentral &amp; Asura Scans)</h3>
          <p className="mt-1 text-xs text-muted">
            When ComicK chapters are unavailable, import or link chapters from WeebCentral or Asura Scans. Each chapter preserves the alternative source&apos;s own provider ID, chapter ID, and reader URL.
          </p>
          <div className="mt-3 space-y-3">
            {data.alternatives.map((alt) => {
              const key = `${alt.sourceId}:${alt.externalId}`;
              return (
                <div key={key} className="rounded-lg border border-line bg-surface p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{alt.sourceName} · ID: {alt.externalId}</p>
                      <p className="text-sm font-bold">{alt.title} ({alt.totalChapters} chapters)</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!!altBusy}
                        onClick={() => importAlternative(alt)}
                        className={btn}
                      >
                        {altBusy === key ? "Importing…" : `Import & link ${alt.sourceName} chapters`}
                      </button>
                      <Link href={alt.catalogUrl} className={btnGhost}>
                        Open {alt.sourceName} reader ↗
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {notice && <p role="status" className="mt-3 text-sm text-primary">{notice}</p>}
      {errorMessage && <p role="alert" className="mt-3 text-sm text-danger">{errorMessage}</p>}
    </section>
  );
}
