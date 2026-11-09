"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cover } from "@/components/ComicCard";
import { ApiError, api } from "@/lib/api";
import { act, errMsg, useLoad } from "@/lib/useApi";
import { ExtChapter, Paged, cap, hueOf, media } from "@/lib/sources";
import { Badge, State, btn, btnGhost, input } from "./ui";

const DEFAULT_PAGE_SIZE = 500;

interface SourceSummary {
  id: string;
  sourceId: string;
  externalId: string;
  title: string;
  sourceUrl: string;
  coverUrl: string | null;
  contentType: string;
  state: string;
  role: "PRIMARY" | "CHAPTER_FALLBACK";
  displayName: string;
  availableLanguages?: string[];
  comicSlug?: string | null;
}

type ChapterRow = ExtChapter & {
  sourceId?: string;
  sourceName?: string;
  mangaId?: string;
  imported: boolean;
  importedChapterId?: string | null;
  comicReaderUrl?: string | null;
  sourceReaderUrl?: string | null;
};

interface AvailableChaptersResponse {
  source: SourceSummary | null;
  primarySource: SourceSummary | null;
  fallbacks: SourceSummary[];
  upstreamUnavailable?: boolean;
  upstreamMessage?: string | null;
  chapters: Paged<ChapterRow> | null;
}

interface FallbackCandidateItem {
  sourceId: "weebcentral" | "asurascans";
  sourceName: string;
  externalId: string;
  title: string;
  alternativeTitles: string[];
  coverUrl: string | null;
  contentType: string;
  year: number | null;
  status: string | null;
  sourceUrl: string;
  linked: boolean;
}

function cleanSeriesTitle(title: string): string {
  return title.replace(/^Official\s+/i, "").trim() || title;
}

function formatTypeLabel(contentType?: string | null): string | null {
  if (!contentType) return null;
  const clean = contentType.trim().toLowerCase();
  if (!clean || clean === "unknown") return null;
  return cap(clean);
}

export default function AvailableSourceChapters({ comicId, onImported }: { comicId: string; onImported: () => void }) {
  const [language, setLanguage] = useState("en");
  const [page, setPage] = useState(1);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [showFinder, setShowFinder] = useState(false);

  // Fallback candidate search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchProvider, setSearchProvider] = useState<"" | "weebcentral" | "asurascans">("");
  const [candidates, setCandidates] = useState<FallbackCandidateItem[]>([]);
  const [searchingCandidates, setSearchingCandidates] = useState(false);
  const [candidateSearched, setCandidateSearched] = useState(false);

  const params = new URLSearchParams({
    language,
    page: String(page),
    limit: String(DEFAULT_PAGE_SIZE),
    ...(selectedSourceId ? { sourceId: selectedSourceId } : {}),
  });
  const { data, error, loading, reload } = useLoad<AvailableChaptersResponse>(
    `/admin/sources/comics/${encodeURIComponent(comicId)}/chapters?${params}`,
  );
  const pageSize = data?.chapters?.limit ?? DEFAULT_PAGE_SIZE;

  useEffect(() => {
    if (data?.primarySource?.title && !searchQuery) {
      setSearchQuery(cleanSeriesTitle(data.primarySource.title));
    }
  }, [data?.primarySource?.title, searchQuery]);

  useEffect(() => {
    const languages = data?.source?.availableLanguages ?? [];
    if (languages.length && !languages.includes(language)) {
      setLanguage(languages.includes("en") ? "en" : languages[0]);
      setPage(1);
    }
  }, [data?.source?.availableLanguages, language]);

  // Automatically open and search fallback candidates only when ComicK has no linked fallback yet.
  useEffect(() => {
    if (!data?.primarySource || data.primarySource.sourceId !== "comick") return;
    if (data.fallbacks.length === 0) {
      setShowFinder(true);
      if (!candidateSearched && !searchingCandidates) {
        void searchFallbackCandidates(cleanSeriesTitle(data.primarySource.title), "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.primarySource?.sourceId, data?.primarySource?.title, data?.fallbacks.length]);

  useEffect(() => {
    setSelectedChapterIds([]);
  }, [page, language, data?.source?.sourceId, data?.source?.externalId]);

  async function searchFallbackCandidates(customQuery?: string, customProvider?: "" | "weebcentral" | "asurascans") {
    const qVal = (customQuery ?? searchQuery).trim();
    const pVal = customProvider !== undefined ? customProvider : searchProvider;
    setSearchingCandidates(true);
    setCandidateSearched(true);
    setErrorMessage("");
    try {
      const qs = new URLSearchParams({
        ...(qVal ? { q: qVal } : {}),
        ...(pVal ? { sourceId: pVal } : {}),
        page: "1",
        limit: "12",
      });
      const res = await api<{ query: string; items: FallbackCandidateItem[] }>(
        `/admin/sources/comics/${encodeURIComponent(comicId)}/fallback-candidates?${qs}`,
        { credentials: "include", cache: "no-store" },
      );
      setCandidates(res.items ?? []);
      if (res.query && !searchQuery) setSearchQuery(cleanSeriesTitle(res.query));
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : "Could not search alternative sources.");
    } finally {
      setSearchingCandidates(false);
    }
  }

  async function confirmAndImportFallback(candidate: FallbackCandidateItem, importImmediately: boolean) {
    const key = `${importImmediately ? "import" : "link"}:${candidate.sourceId}:${candidate.externalId}`;
    setLinkBusy(key);
    setErrorMessage("");
    setNotice("");
    try {
      if (importImmediately) {
        const res = await act<{ imported: number }>(
          `/admin/sources/comics/${encodeURIComponent(comicId)}/chapters/import-alternative`,
          "POST",
          {
            sourceId: candidate.sourceId,
            externalId: candidate.externalId,
            language,
            page: 1,
            limit: DEFAULT_PAGE_SIZE,
          },
        );
        setNotice(
          `Linked ${candidate.sourceName} ("${cleanSeriesTitle(candidate.title)}") and imported ${res?.imported ?? 0} chapters.`,
        );
        onImported();
      } else {
        await act(
          `/admin/sources/comics/${encodeURIComponent(comicId)}/fallbacks`,
          "POST",
          { sourceId: candidate.sourceId, externalId: candidate.externalId },
        );
        setNotice(`Linked ${candidate.sourceName} ("${cleanSeriesTitle(candidate.title)}") as alternative chapter source.`);
      }
      setSelectedSourceId(candidate.sourceId);
      setPage(1);
      setShowFinder(false);
      setCandidates((prev) =>
        prev.map((item) =>
          item.sourceId === candidate.sourceId
            ? { ...item, linked: item.externalId === candidate.externalId }
            : item,
        ),
      );
      reload();
    } catch (e) {
      setErrorMessage(errMsg(e));
    } finally {
      setLinkBusy("");
    }
  }

  async function unlinkFallback(sourceId: string, displayName: string) {
    const key = `unlink:${sourceId}`;
    setLinkBusy(key);
    setErrorMessage("");
    setNotice("");
    try {
      await act(
        `/admin/sources/comics/${encodeURIComponent(comicId)}/fallbacks/${encodeURIComponent(sourceId)}`,
        "DELETE",
      );
      setNotice(`Unlinked ${displayName} fallback source.`);
      if (selectedSourceId === sourceId) setSelectedSourceId("");
      setPage(1);
      setCandidates((prev) =>
        prev.map((item) => (item.sourceId === sourceId ? { ...item, linked: false } : item)),
      );
      onImported();
      reload();
    } catch (e) {
      setErrorMessage(errMsg(e));
    } finally {
      setLinkBusy("");
    }
  }

  async function importChapters(onlySelected: boolean) {
    if (!data?.source || data.source.sourceId === "comick") return;
    const idsToImport = onlySelected ? selectedChapterIds : undefined;
    if (onlySelected && (!idsToImport || idsToImport.length === 0)) return;
    setBusy(true);
    setErrorMessage("");
    setNotice("");
    try {
      const { source } = data;
      const query = new URLSearchParams({
        language,
        page: String(page),
        limit: String(pageSize),
      });
      const result = await act<{ imported: number }>(
        `/admin/sources/catalog/${encodeURIComponent(source.sourceId)}/${encodeURIComponent(source.externalId)}/chapters/import?${query}`,
        "POST",
        idsToImport ? { chapterIds: idsToImport } : {},
      );
      setNotice(
        `${result.imported} chapter${result.imported === 1 ? "" : "s"} imported from ${source.displayName}.`,
      );
      setSelectedChapterIds([]);
      onImported();
      reload();
    } catch (e) {
      setErrorMessage(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const unimportedOnPage = (data?.chapters?.items ?? []).filter((ch) => !ch.imported);
  const allUnimportedSelected =
    unimportedOnPage.length > 0 && unimportedOnPage.every((ch) => selectedChapterIds.includes(ch.id));

  function toggleChapterSelection(chapterId: string) {
    setSelectedChapterIds((prev) =>
      prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId],
    );
  }

  function toggleSelectAllOnPage() {
    if (allUnimportedSelected) {
      setSelectedChapterIds([]);
    } else {
      setSelectedChapterIds(unimportedOnPage.map((ch) => ch.id));
    }
  }

  const isComickPrimary = data?.primarySource?.sourceId === "comick";
  const hasFallbacks = (data?.fallbacks?.length ?? 0) > 0;

  return (
    <section className="mt-6 space-y-5 rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Chapter Sources &amp; Catalogue</h2>
          <p className="text-xs text-muted">
            {isComickPrimary
              ? "ComicK provides canonical metadata; chapters are served through linked WeebCentral or Asura Scans sources."
              : "Manage the external source and import available chapters."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isComickPrimary && hasFallbacks && (
            <button
              type="button"
              onClick={() => {
                const next = !showFinder;
                setShowFinder(next);
                if (next && !candidateSearched && !searchingCandidates) {
                  void searchFallbackCandidates(cleanSeriesTitle(data?.primarySource?.title ?? ""), "");
                }
              }}
              className={`${btnGhost} text-xs`}
            >
              {showFinder ? "Hide source search" : "Change / add alternative source"}
            </button>
          )}
          {data?.source && data.source.sourceId !== "comick" && (
            <label className="text-sm">
              Language
              <select
                className="ml-2 rounded-md border border-line bg-surface px-2 py-1.5"
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setPage(1);
                  setNotice("");
                }}
              >
                {(data.source.availableLanguages?.length ? data.source.availableLanguages : ["en"]).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      <State loading={loading} error={error} />

      {notice && (
        <div role="status" className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          {notice}
        </div>
      )}
      {errorMessage && (
        <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {errorMessage}
        </div>
      )}

      {data && !data.primarySource && (
        <p className="text-sm text-muted">
          This comic has no linked external source. Chapters imported through external source approval will appear here.
        </p>
      )}

      {/* Linked Sources Summary */}
      {data?.primarySource && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{data.primarySource.displayName}</span>
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  PRIMARY · Metadata
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-muted">
                {cleanSeriesTitle(data.primarySource.title)} · ID: {data.primarySource.externalId}
              </p>
            </div>
            <a
              href={data.primarySource.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs font-medium text-primary hover:underline"
            >
              Open ↗
            </a>
          </div>

          {data.fallbacks.map((fb) => {
            const isSelected = data.source?.sourceId === fb.sourceId;
            return (
              <div
                key={`${fb.sourceId}:${fb.externalId}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{fb.displayName}</span>
                    <span className="rounded-full border border-primary/30 bg-card px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                      CHAPTER SOURCE
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted">
                    {cleanSeriesTitle(fb.title)} · ID: {fb.externalId}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {data.fallbacks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSourceId(fb.sourceId);
                        setPage(1);
                      }}
                      className={isSelected ? btn : btnGhost}
                    >
                      {isSelected ? "Active" : "Select"}
                    </button>
                  )}
                  <a
                    href={fb.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    Open ↗
                  </a>
                  <button
                    type="button"
                    disabled={linkBusy === `unlink:${fb.sourceId}`}
                    onClick={() => unlinkFallback(fb.sourceId, fb.displayName)}
                    className="rounded-md border border-danger/40 px-2 py-1 text-danger hover:bg-danger/10 disabled:opacity-50"
                  >
                    {linkBusy === `unlink:${fb.sourceId}` ? "…" : "Unlink"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Alternative Series Finder (Redesigned UI) */}
      {isComickPrimary && (!hasFallbacks || showFinder) && (
        <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold">
                Select Alternative Chapter Source (WeebCentral / Asura Scans)
              </h3>
              <p className="mt-0.5 text-xs text-muted">
                Choose the matching series below to link and import chapters in one click.
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void searchFallbackCandidates();
            }}
            className="mt-3 flex flex-wrap items-center gap-2.5"
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search series title…"
              className={`${input} min-w-[200px] flex-1 sm:max-w-xs`}
            />
            <select
              value={searchProvider}
              onChange={(e) => {
                const next = e.target.value as "" | "weebcentral" | "asurascans";
                setSearchProvider(next);
                void searchFallbackCandidates(searchQuery, next);
              }}
              className="rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">WeebCentral &amp; Asura Scans</option>
              <option value="weebcentral">WeebCentral only</option>
              <option value="asurascans">Asura Scans only</option>
            </select>
            <button type="submit" disabled={searchingCandidates} className={btn}>
              {searchingCandidates ? "Searching…" : "Search"}
            </button>
          </form>

          {searchingCandidates && (
            <p className="mt-4 text-sm text-muted" aria-busy="true">
              Searching WeebCentral &amp; Asura Scans…
            </p>
          )}

          {!searchingCandidates && candidateSearched && candidates.length === 0 && (
            <p className="mt-4 rounded-lg border border-line bg-card p-4 text-sm text-muted">
              No matching series found for &ldquo;{searchQuery}&rdquo;. Try a shorter title keyword above.
            </p>
          )}

          {candidates.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {candidates.map((cand) => {
                const importKey = `import:${cand.sourceId}:${cand.externalId}`;
                const linkKey = `link:${cand.sourceId}:${cand.externalId}`;
                const displayTitle = cleanSeriesTitle(cand.title);
                const typeLabel = formatTypeLabel(cand.contentType) ?? formatTypeLabel(data?.primarySource?.contentType);
                return (
                  <div
                    key={`${cand.sourceId}:${cand.externalId}`}
                    className="flex gap-3.5 rounded-xl border border-line bg-card p-3.5 transition hover:border-primary/50"
                  >
                    <Cover
                      hue={hueOf(cand.externalId)}
                      title={displayTitle}
                      src={media(cand.coverUrl)}
                      className="aspect-[2/3] w-20 shrink-0 rounded-lg object-cover shadow-sm"
                    />
                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            {cand.sourceName}
                          </span>
                          {typeLabel && (
                            <span className="rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] text-muted">
                              {typeLabel}
                            </span>
                          )}
                          {cand.year && (
                            <span className="text-xs text-muted">· {cand.year}</span>
                          )}
                        </div>

                        <h4 className="mt-1.5 truncate text-base font-bold" title={displayTitle}>
                          {displayTitle}
                        </h4>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          <span className="truncate font-mono text-[11px]">ID: {cand.externalId}</span>
                          <a
                            href={cand.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline"
                          >
                            View on {cand.sourceName} ↗
                          </a>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {cand.linked ? (
                          <>
                            <Badge v="APPROVED" />
                            <button
                              type="button"
                              onClick={() => unlinkFallback(cand.sourceId, cand.sourceName)}
                              disabled={linkBusy === `unlink:${cand.sourceId}`}
                              className="rounded-md border border-danger/40 px-2.5 py-1 text-xs text-danger hover:bg-danger/10"
                            >
                              Unlink
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={!!linkBusy}
                              onClick={() => confirmAndImportFallback(cand, true)}
                              className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
                            >
                              {linkBusy === importKey ? "Importing chapters…" : `Use ${cand.sourceName} & import chapters`}
                            </button>
                            <button
                              type="button"
                              disabled={!!linkBusy}
                              onClick={() => confirmAndImportFallback(cand, false)}
                              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-muted hover:text-fg disabled:opacity-50"
                            >
                              {linkBusy === linkKey ? "Linking…" : "Link only"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Chapter List & Selection from Active Source */}
      {data?.source && data.chapters && data.source.sourceId !== "comick" && (
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                {data.source.displayName} Chapter Catalogue
              </span>
              <h3 className="text-base font-bold">
                {cleanSeriesTitle(data.source.title)} ({data.chapters.total.toLocaleString()} chapters)
              </h3>
              <p className="text-xs text-muted">
                Source: <strong>{data.source.displayName}</strong> · ID: {data.source.externalId} · Page {page}
              </p>
            </div>

            {unimportedOnPage.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAllOnPage}
                  className={`${btnGhost} text-xs`}
                >
                  {allUnimportedSelected ? "Deselect all" : `Select all (${unimportedOnPage.length})`}
                </button>
                <button
                  type="button"
                  disabled={busy || selectedChapterIds.length === 0}
                  onClick={() => importChapters(true)}
                  className={`${btn} text-xs disabled:opacity-50`}
                >
                  {busy ? "Importing…" : `Import selected (${selectedChapterIds.length})`}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => importChapters(false)}
                  className={`${btnGhost} text-xs disabled:opacity-50`}
                >
                  {busy ? "Importing…" : `Import all on page ${page}`}
                </button>
              </div>
            )}
          </div>

          {data.chapters.items.length === 0 ? (
            <p className="rounded-md border border-line bg-card p-3 text-sm text-muted">
              No chapters available in this language on {data.source.displayName}.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto rounded-lg border border-line bg-card">
              {data.chapters.items.map((chapter) => {
                const checked = selectedChapterIds.includes(chapter.id);
                return (
                  <li key={chapter.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        disabled={chapter.imported}
                        checked={chapter.imported || checked}
                        onChange={() => toggleChapterSelection(chapter.id)}
                        className="mt-1 h-4 w-4 rounded border-line"
                      />
                      <span className="min-w-0">
                        <span className="font-semibold">
                          {chapter.numberLabel ? `Chapter ${chapter.numberLabel}` : "Special"}
                        </span>
                        {chapter.title ? `: ${chapter.title}` : ""}
                        <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                          {chapter.sourceName ?? data.source.displayName}
                        </span>
                        <span className="block text-xs text-muted">
                          ID: {chapter.id} · {chapter.groups.join(", ") || data.source.displayName}
                          {chapter.pageCount ? ` · ${chapter.pageCount} pages` : ""}
                        </span>
                      </span>
                    </label>
                    <div className="flex items-center gap-3 text-xs">
                      {chapter.imported ? (
                        <>
                          <span className="font-semibold text-primary">Imported</span>
                          {chapter.comicReaderUrl && (
                            <Link
                              href={chapter.comicReaderUrl}
                              target="_blank"
                              className="rounded border border-line px-2 py-1 font-semibold text-primary hover:bg-surface"
                            >
                              Open reader ↗
                            </Link>
                          )}
                        </>
                      ) : (
                        <span className="text-muted">
                          {chapter.publishedAt ? new Date(chapter.publishedAt).toLocaleDateString("en-IN") : "Available"}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {(page > 1 || data.chapters.hasMore) && (
            <div className="mt-3 flex justify-center gap-3 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className={`${btnGhost} disabled:opacity-40`}
              >
                Previous
              </button>
              <span className="py-1 text-muted">Page {page}</span>
              <button
                type="button"
                disabled={!data.chapters.hasMore || page * pageSize >= 10_000}
                onClick={() => setPage((value) => value + 1)}
                className={`${btnGhost} disabled:opacity-40`}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
