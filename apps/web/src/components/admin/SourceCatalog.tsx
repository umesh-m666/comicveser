"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Cover } from "@/components/ComicCard";
import { ApiError, api } from "@/lib/api";
import { Manga, MangaDetails, Paged, cap, hueOf, media } from "@/lib/sources";
import { act } from "@/lib/useApi";
import { Badge, btn, btnGhost } from "./ui";

type ReviewState = "APPROVED" | "REJECTED" | "UNPUBLISHED" | null;
type CatalogItem = Manga & { reviewState: ReviewState; comicSlug: string | null };
type CatalogPage = Paged<CatalogItem>;
type SearchMode = "search" | "all";
type SubmittedQuery = { q: string; type: string; mode: SearchMode };
type ActionResult = { slug?: string; importedChapters?: number; hasMoreChapters?: boolean };

const PAGE_SIZE = 20;
const MAX_BULK_SELECTION = 10; // The existing approve/republish endpoints are throttled to 10 requests per minute.
const field = "w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-primary";
const states = ["APPROVED", "REJECTED", "UNPUBLISHED"] as const;
const statusLabel = (state: ReviewState) => state ? cap(state.toLowerCase()) : "Needs review";

export default function SourceCatalog({ sourceId, sourceName, types, enabled }: { sourceId: string; sourceName: string; types: string[]; enabled: boolean }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [submitted, setSubmitted] = useState<SubmittedQuery | null>(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CatalogPage | null>(null);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [notice, setNotice] = useState("");
  const [actionErrors, setActionErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!submitted || !enabled) return;
    let live = true;
    setSearchState("loading");
    setError("");
    setSelectedIds([]);
    setNotice("");
    setActionErrors([]);

    // An empty q asks providers for their default/unfiltered catalogue listing.
    const params = new URLSearchParams({ source: sourceId, q: submitted.mode === "all" ? "" : submitted.q, page: String(page), limit: String(PAGE_SIZE) });
    if (submitted.type) params.set("type", submitted.type);

    api<CatalogPage>(`/admin/sources/catalog/search?${params}`, { credentials: "include", cache: "no-store" })
      .then((response) => { if (live) { setResult(response); setSearchState("done"); } })
      .catch((e) => {
        if (!live) return;
        setResult(null);
        setError(e instanceof ApiError ? e.message : "Could not load the provider catalogue.");
        setSearchState("error");
      });
    return () => { live = false; };
  }, [submitted, page, sourceId, enabled]);

  const visible = useMemo(() => (result?.items ?? []).filter((item) =>
    statusFilter === "ALL" || (statusFilter === "NEEDS_REVIEW" ? !item.reviewState : item.reviewState === statusFilter)
  ), [result, statusFilter]);
  const actionableVisible = visible.filter((item) => item.reviewState !== "APPROVED");
  const selectedItems = visible.filter((item) => selectedIds.includes(item.externalId) && item.reviewState !== "APPROVED");
  const allVisibleSelected = actionableVisible.length > 0 && actionableVisible.every((item) => selectedIds.includes(item.externalId));

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setPage(1);
    setSubmitted({ q: query.trim(), type, mode: "search" });
  }

  function showAllTitles() {
    setPage(1);
    setSubmitted({ q: "", type, mode: "all" });
  }

  function updateCatalogItem(externalId: string, patch: Partial<CatalogItem>) {
    setResult((current) => current ? {
      ...current,
      items: current.items.map((item) => item.externalId === externalId ? { ...item, ...patch } : item),
    } : current);
  }

  function toggleSelected(externalId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (!checked) return current.filter((id) => id !== externalId);
      if (current.includes(externalId) || current.length >= MAX_BULK_SELECTION) return current;
      return [...current, externalId];
    });
  }

  function toggleVisible(checked: boolean) {
    setSelectedIds((current) => {
      if (!checked) {
        const visibleIds = new Set(actionableVisible.map((item) => item.externalId));
        return current.filter((id) => !visibleIds.has(id));
      }
      const next = [...current];
      for (const item of actionableVisible) {
        if (next.length >= MAX_BULK_SELECTION) break;
        if (!next.includes(item.externalId)) next.push(item.externalId);
      }
      return next;
    });
  }

  async function publishOne(item: CatalogItem): Promise<string> {
    const base = `/admin/sources/catalog/${encodeURIComponent(sourceId)}/${encodeURIComponent(item.externalId)}`;
    if (item.reviewState === "APPROVED") return "already published";

    if (item.reviewState === "UNPUBLISHED") {
      await act(`${base}/republish`, "POST");
      updateCatalogItem(item.externalId, { reviewState: "APPROVED" });
      return "republished";
    }

    // Read available languages so approval imports the first chapter page in a language this title supports.
    const details = await api<MangaDetails>(base, { credentials: "include", cache: "no-store" });
    const language = details.availableLanguages.includes("en") ? "en" : details.availableLanguages[0] ?? "en";
    const published = await act<ActionResult>(`${base}/approve`, "POST", { language });
    updateCatalogItem(item.externalId, { reviewState: "APPROVED", comicSlug: published?.slug ?? item.comicSlug });
    return `published${typeof published?.importedChapters === "number" ? ` (${published.importedChapters} chapters imported)` : ""}`;
  }

  async function publishSingle(item: CatalogItem) {
    setBusyId(item.externalId);
    setNotice("");
    setActionErrors([]);
    try {
      const outcome = await publishOne(item);
      setNotice(`${item.title}: ${outcome}.`);
    } catch (e) {
      setActionErrors([`${item.title}: ${e instanceof ApiError ? e.message : "The publish action failed."}`]);
    } finally {
      setBusyId("");
    }
  }

  async function publishSelected() {
    if (!selectedItems.length || bulkBusy) return;
    setBulkBusy(true);
    setNotice("");
    setActionErrors([]);
    const failures: string[] = [];
    let completed = 0;
    const total = selectedItems.length;

    // Keep requests sequential: the existing server action route is throttled and every approval imports chapters.
    for (const item of selectedItems) {
      setBulkProgress(`Publishing ${completed + 1} of ${total}: ${item.title}`);
      try {
        await publishOne(item);
      } catch (e) {
        failures.push(`${item.title}: ${e instanceof ApiError ? e.message : "The publish action failed."}`);
      }
      completed += 1;
      setSelectedIds((current) => current.filter((id) => id !== item.externalId));
    }

    setBulkProgress("");
    setNotice(`${completed - failures.length} of ${total} selected titles published or republished${failures.length ? "; some actions failed" : " successfully"}.`);
    setActionErrors(failures);
    setBulkBusy(false);
  }

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-line bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Browse {sourceName}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
              Search by title, or use Show All Titles to load the provider’s default catalogue listing. Available titles and pagination depend on the provider API.
            </p>
          </div>
          <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">{types.length} supported {types.length === 1 ? "type" : "types"}</span>
        </div>

        {!enabled && <p role="status" className="mt-4 rounded-lg border border-line p-4 text-sm text-muted">Enable this provider in Admin → Sources before browsing.</p>}

        <form onSubmit={submitSearch} className="mt-5 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_190px_190px_auto]">
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-muted">Title search</span>
            <input className={field} value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} placeholder={`Search ${sourceName} titles`} />
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-muted">Content type</span>
            <select className={field} value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">Manga, Manhwa & Manhua</option>
              {types.map((supportedType) => <option value={supportedType} key={supportedType}>{cap(supportedType)}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-muted">Review status</span>
            <select className={field} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">All review statuses</option>
              <option value="NEEDS_REVIEW">Needs review</option>
              {states.map((state) => <option value={state} key={state}>{cap(state.toLowerCase())}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={!enabled || !query.trim() || searchState === "loading" || bulkBusy} className={`${btn} w-full px-5 py-2.5 disabled:opacity-50`}>
              {searchState === "loading" && submitted?.mode === "search" ? "Searching…" : "Search"}
            </button>
          </div>
        </form>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Browse the provider catalogue</p>
            <p className="mt-0.5 text-xs leading-5 text-muted">Load the provider's default title listing without entering a search term. Results and page count depend on the provider API.</p>
          </div>
          <button
            type="button"
            disabled={!enabled || searchState === "loading" || bulkBusy}
            onClick={showAllTitles}
            className={`${btn} shrink-0 whitespace-nowrap px-5 py-2.5 disabled:cursor-not-allowed disabled:opacity-50`}
            aria-label={`Show all available titles from ${sourceName}`}
          >
            {searchState === "loading" && submitted?.mode === "all" ? `Loading ${sourceName}…` : "Show All Titles"}
          </button>
        </div>

        {result && searchState === "done" && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <p className="text-sm text-muted">
              {result.total.toLocaleString()}{result.totalExact === false ? "+" : ""} {submitted?.mode === "all" ? "provider catalogue titles returned" : "matching titles"} · page {page}
            </p>
            <div className="flex items-center gap-3 text-sm">
              {submitted?.mode === "all" && <span className="text-xs text-muted">Default catalogue view</span>}
              <button type="button" onClick={() => setStatusFilter("ALL")} className="font-medium text-primary underline underline-offset-4">Show all statuses</button>
            </div>
          </div>
        )}
      </div>

      {error && <p role="alert" className="rounded-lg border border-danger/40 p-3 text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-primary/30 p-3 text-sm text-primary">{notice}</p>}
      {actionErrors.length > 0 && <div role="alert" className="rounded-lg border border-danger/40 p-3 text-sm text-danger"><p className="font-semibold">Some titles could not be published</p><ul className="mt-2 list-disc space-y-1 pl-5">{actionErrors.map((message) => <li key={message}>{message}</li>)}</ul></div>}

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-card p-4">
          <div>
            <p className="font-semibold">{selectedItems.length} title{selectedItems.length === 1 ? "" : "s"} selected</p>
            <p className="text-xs text-muted">Bulk publishing is limited to {MAX_BULK_SELECTION} titles per batch by the existing API rate limit.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} disabled={bulkBusy} onClick={() => setSelectedIds([])}>Clear selection</button>
            <button type="button" className={btn} disabled={bulkBusy} onClick={publishSelected}>{bulkBusy ? "Publishing…" : `Approve & publish selected (${selectedItems.length})`}</button>
          </div>
          {bulkProgress && <p className="w-full text-xs text-muted" aria-live="polite">{bulkProgress}</p>}
        </div>
      )}

      {searchState === "loading" && <div className="rounded-xl border border-line bg-card p-8 text-center text-sm text-muted" aria-busy="true">{submitted?.mode === "all" ? `Loading ${sourceName} catalogue…` : `Searching ${sourceName}…`}</div>}
      {searchState === "idle" && <div className="rounded-xl border border-dashed border-line p-10 text-center"><p className="font-semibold">Browse this provider</p><p className="mt-1 text-sm text-muted">Search a title or choose Show All Titles to request the provider's unfiltered/default catalogue. Manga, Manhwa, and Manhua filters are available when supported by the provider.</p></div>}

      {searchState === "done" && result && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={allVisibleSelected} onChange={(event) => toggleVisible(event.target.checked)} disabled={bulkBusy || actionableVisible.length === 0 || (selectedIds.length >= MAX_BULK_SELECTION && !allVisibleSelected)} className="h-4 w-4 accent-current" />
              Select visible titles
            </label>
            <p className="text-xs text-muted">{actionableVisible.length} titles on this page can be published or republished</p>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-xl border border-line bg-card p-10 text-center"><p className="font-semibold">No titles found</p><p className="mt-1 text-sm text-muted">Try another search term or choose a different content type or review status.</p></div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {visible.map((item) => {
                const isSelected = selectedIds.includes(item.externalId);
                const isBusy = busyId === item.externalId;
                const isAlreadyPublished = item.reviewState === "APPROVED";
                return (
                  <article key={item.externalId} className="flex min-w-0 gap-3 rounded-xl border border-line bg-card p-3 transition hover:border-primary/50">
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        aria-label={`Select ${item.title}`}
                        checked={isSelected}
                        disabled={bulkBusy || isAlreadyPublished || (!isSelected && selectedIds.length >= MAX_BULK_SELECTION)}
                        onChange={(event) => toggleSelected(item.externalId, event.target.checked)}
                        className="h-4 w-4 accent-current"
                      />
                    </div>
                    <Cover hue={hueOf(item.externalId)} title={item.title} src={media(item.coverUrl)} className="h-32 w-[5.5rem] shrink-0 rounded-lg" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 flex-1 font-semibold leading-5">{item.title}</h3><Badge v={item.reviewState ?? "PENDING"} /></div>
                      <p className="mt-1 text-xs text-muted">{cap(item.contentType)}{item.status ? ` · ${cap(item.status)}` : ""} · {item.language ?? "Unknown language"}</p>
                      {item.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted">{item.description}</p>}
                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                        <Link href={`/admin/comics/new/${encodeURIComponent(sourceId)}/${encodeURIComponent(item.externalId)}`} className={btnGhost}>Inspect title</Link>
                        {!isAlreadyPublished && (
                          <button type="button" disabled={bulkBusy || !!busyId} onClick={() => publishSingle(item)} className={btn}>
                            {isBusy ? (item.reviewState === "UNPUBLISHED" ? "Republishing…" : "Publishing…") : item.reviewState === "UNPUBLISHED" ? "Republish" : "Approve & publish"}
                          </button>
                        )}
                        {item.comicSlug && item.reviewState !== "REJECTED" && <Link href={`/comics/${item.comicSlug}`} className="text-xs text-primary underline underline-offset-4">View publication</Link>}
                      </div>
                      {item.reviewState && <p className="mt-2 text-[11px] text-muted">Status: {statusLabel(item.reviewState)}</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {(page > 1 || result.hasMore) && <nav aria-label="Provider catalogue pagination" className="mt-5 flex items-center justify-center gap-3 text-sm">
            <button type="button" disabled={page <= 1 || bulkBusy} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-md border border-line px-3 py-2 disabled:opacity-40">Previous</button>
            <span className="text-muted">Page {page}</span>
            <button type="button" disabled={!result.hasMore || page * PAGE_SIZE >= 10_000 || bulkBusy} onClick={() => setPage((current) => current + 1)} className="rounded-md border border-line px-3 py-2 disabled:opacity-40">Next</button>
          </nav>}
        </section>
      )}
    </section>
  );
}
