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
const MAX_BULK_SELECTION = 10;
const states = ["APPROVED", "REJECTED", "UNPUBLISHED"] as const;
const statusLabel = (state: ReviewState) => (state ? cap(state.toLowerCase()) : "Needs review");

/**
 * Asura Provider Catalogue Browser (#provCatView / #provPanel in Figma HTML):
 * Uses .a-panel, .prov-form, "Show All Titles" .pillbtn, and .prov-results / .prov-result cards.
 */
export default function SourceCatalog({
  sourceId,
  sourceName,
  types,
  enabled,
}: {
  sourceId: string;
  sourceName: string;
  types: string[];
  enabled: boolean;
}) {
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

    const params = new URLSearchParams({
      source: sourceId,
      q: submitted.mode === "all" ? "" : submitted.q,
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (submitted.type) params.set("type", submitted.type);

    api<CatalogPage>(`/admin/sources/catalog/search?${params}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((response) => {
        if (live) {
          setResult(response);
          setSearchState("done");
        }
      })
      .catch((e) => {
        if (!live) return;
        setResult(null);
        setError(e instanceof ApiError ? e.message : "Could not load the provider catalogue.");
        setSearchState("error");
      });
    return () => {
      live = false;
    };
  }, [submitted, page, sourceId, enabled]);

  const visible = useMemo(
    () =>
      (result?.items ?? []).filter(
        (item) =>
          statusFilter === "ALL" ||
          (statusFilter === "NEEDS_REVIEW" ? !item.reviewState : item.reviewState === statusFilter),
      ),
    [result, statusFilter],
  );
  const actionableVisible = visible.filter((item) => item.reviewState !== "APPROVED");
  const selectedItems = visible.filter(
    (item) => selectedIds.includes(item.externalId) && item.reviewState !== "APPROVED",
  );
  const allVisibleSelected =
    actionableVisible.length > 0 &&
    actionableVisible.every((item) => selectedIds.includes(item.externalId));

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
    setResult((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.externalId === externalId ? { ...item, ...patch } : item,
            ),
          }
        : current,
    );
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
    const base = `/admin/sources/catalog/${encodeURIComponent(sourceId)}/${encodeURIComponent(
      item.externalId,
    )}`;
    if (item.reviewState === "APPROVED") return "already published";

    if (item.reviewState === "UNPUBLISHED") {
      await act(`${base}/republish`, "POST");
      updateCatalogItem(item.externalId, { reviewState: "APPROVED" });
      return "republished";
    }

    const details = await api<MangaDetails>(base, { credentials: "include", cache: "no-store" });
    const language = details.availableLanguages.includes("en")
      ? "en"
      : details.availableLanguages[0] ?? "en";
    const published = await act<ActionResult>(`${base}/approve`, "POST", { language });
    updateCatalogItem(item.externalId, {
      reviewState: "APPROVED",
      comicSlug: published?.slug ?? item.comicSlug,
    });
    return `published${
      typeof published?.importedChapters === "number"
        ? ` (${published.importedChapters} chapters imported)`
        : ""
    }`;
  }

  async function publishSingle(item: CatalogItem) {
    setBusyId(item.externalId);
    setNotice("");
    setActionErrors([]);
    try {
      const outcome = await publishOne(item);
      setNotice(`${item.title}: ${outcome}.`);
    } catch (e) {
      setActionErrors([
        `${item.title}: ${e instanceof ApiError ? e.message : "The publish action failed."}`,
      ]);
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

    for (const item of selectedItems) {
      setBulkProgress(`Publishing ${completed + 1} of ${total}: ${item.title}`);
      try {
        await publishOne(item);
      } catch (e) {
        failures.push(
          `${item.title}: ${e instanceof ApiError ? e.message : "The publish action failed."}`,
        );
      }
      completed += 1;
      setSelectedIds((current) => current.filter((id) => id !== item.externalId));
    }

    setBulkProgress("");
    setNotice(
      `${completed - failures.length} of ${total} selected titles published or republished${
        failures.length ? "; some actions failed" : " successfully"
      }.`,
    );
    setActionErrors(failures);
    setBulkBusy(false);
  }

  return (
    <section className="space-y-4">
      <div className="a-panel" data-layer="Browse Provider Catalogue">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#fff" }}>
              Browse {sourceName}
            </h2>
            <p className="psub" style={{ lineHeight: 1.6, marginTop: 4 }}>
              Search by title, or use Show All Titles to load the provider’s default catalogue listing. Available titles and pagination depend on the provider API.
            </p>
          </div>
          <span className="tag grey">
            {types.length} supported {types.length === 1 ? "type" : "types"}
          </span>
        </div>

        {!enabled && (
          <p role="status" className="svc-alert mt-3">
            Enable this provider in Admin → Sources before browsing.
          </p>
        )}

        <form onSubmit={submitSearch} className="prov-form" id="provForm">
          <label>
            Title search
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              maxLength={100}
              placeholder={`Search ${sourceName} titles`}
              aria-label="Search provider titles"
            />
          </label>
          <label>
            Content type
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">Manga, Manhwa &amp; Manhua</option>
              {types.map((supportedType) => (
                <option value={supportedType} key={supportedType}>
                  {cap(supportedType)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Review status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">All review statuses</option>
              <option value="NEEDS_REVIEW">Needs review</option>
              {states.map((state) => (
                <option value={state} key={state}>
                  {cap(state.toLowerCase())}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={!enabled || !query.trim() || searchState === "loading" || bulkBusy}
            className="pillbtn"
            style={{ justifyContent: "center", minHeight: 40, fontSize: 13.5, marginLeft: 0 }}
          >
            {searchState === "loading" && submitted?.mode === "search" ? "Searching…" : "Search"}
          </button>
        </form>

        <div
          style={{
            border: "1px solid #3a3650",
            borderRadius: 10,
            padding: "14px 16px",
            marginTop: 14,
          }}
        >
          <b style={{ fontSize: 13.5, display: "block", marginBottom: 3, color: "#fff" }}>
            Browse the provider catalogue
          </b>
          <span
            style={{
              fontSize: 12,
              color: "var(--muted)",
              lineHeight: 1.55,
              display: "block",
              marginBottom: 11,
            }}
          >
            Load the provider&apos;s default title listing without entering a search term. Results and page count depend on the provider API.
          </span>
          <button
            type="button"
            disabled={!enabled || searchState === "loading" || bulkBusy}
            onClick={showAllTitles}
            className="pillbtn"
            style={{ minHeight: 36, marginLeft: 0 }}
            aria-label={`Show all available titles from ${sourceName}`}
          >
            {searchState === "loading" && submitted?.mode === "all"
              ? `Loading ${sourceName}…`
              : "Show All Titles"}
          </button>
        </div>

        {result && searchState === "done" && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[rgba(255,255,255,.06)] pt-4 text-xs text-muted">
            <p>
              {result.total.toLocaleString()}
              {result.totalExact === false ? "+" : ""}{" "}
              {submitted?.mode === "all" ? "provider catalogue titles returned" : "matching titles"}{" "}
              · page {page}
            </p>
            <div className="flex items-center gap-3">
              {submitted?.mode === "all" && <span>Default catalogue view</span>}
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                style={{ color: "var(--purple-2)", fontWeight: 600 }}
              >
                Show all statuses
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="svc-alert text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="svc-alert" style={{ borderColor: "var(--purple-2)" }}>
          {notice}
        </p>
      )}
      {actionErrors.length > 0 && (
        <div role="alert" className="svc-alert text-danger">
          <p className="font-semibold">Some titles could not be published</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {actionErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {selectedItems.length > 0 && (
        <div className="a-panel flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-white">
              {selectedItems.length} title{selectedItems.length === 1 ? "" : "s"} selected
            </p>
            <p className="text-xs text-muted">
              Bulk publishing is limited to {MAX_BULK_SELECTION} titles per batch by the existing API rate limit.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnGhost}
              disabled={bulkBusy}
              onClick={() => setSelectedIds([])}
            >
              Clear selection
            </button>
            <button
              type="button"
              className={btn}
              disabled={bulkBusy}
              onClick={publishSelected}
            >
              {bulkBusy
                ? "Publishing…"
                : `Approve & publish selected (${selectedItems.length})`}
            </button>
          </div>
          {bulkProgress && (
            <p className="w-full text-xs text-muted" aria-live="polite">
              {bulkProgress}
            </p>
          )}
        </div>
      )}

      {searchState === "loading" && (
        <div className="a-panel text-center text-sm text-muted" aria-busy="true">
          {submitted?.mode === "all"
            ? `Loading ${sourceName} catalogue…`
            : `Searching ${sourceName}…`}
        </div>
      )}

      {searchState === "idle" && (
        <div className="a-panel text-center" style={{ padding: "28px 16px" }}>
          <b style={{ fontSize: 14.5, display: "block", marginBottom: 5, color: "#fff" }}>
            Browse this provider
          </b>
          <span
            style={{
              fontSize: 12.5,
              color: "var(--muted)",
              lineHeight: 1.6,
              display: "block",
              maxWidth: 560,
              margin: "0 auto",
            }}
          >
            Search a title or choose Show All Titles to request the provider&apos;s unfiltered/default catalogue. Manga, Manhwa, and Manhua filters are available when supported by the provider.
          </span>
        </div>
      )}

      {searchState === "done" && result && (
        <section className="a-panel">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={(event) => toggleVisible(event.target.checked)}
                disabled={
                  bulkBusy ||
                  actionableVisible.length === 0 ||
                  (selectedIds.length >= MAX_BULK_SELECTION && !allVisibleSelected)
                }
                className="h-4 w-4 accent-current"
              />
              Select visible titles
            </label>
            <p className="text-xs text-muted">
              {actionableVisible.length} titles on this page can be published or republished
            </p>
          </div>

          {visible.length === 0 ? (
            <div className="empty-note">
              No titles found. Try another search term or choose a different content type or review status.
            </div>
          ) : (
            <div className="prov-results" id="provResults">
              {visible.map((item) => {
                const isSelected = selectedIds.includes(item.externalId);
                const isBusy = busyId === item.externalId;
                const isAlreadyPublished = item.reviewState === "APPROVED";
                return (
                  <article key={item.externalId} className="prov-result">
                    <Cover
                      hue={hueOf(item.externalId)}
                      title={item.title}
                      src={media(item.coverUrl)}
                      className="pr-cov border-0 !p-0.5"
                    />
                    <div style={{ minWidth: 0 }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.title}`}
                          checked={isSelected}
                          disabled={
                            bulkBusy ||
                            isAlreadyPublished ||
                            (!isSelected && selectedIds.length >= MAX_BULK_SELECTION)
                          }
                          onChange={(event) => toggleSelected(item.externalId, event.target.checked)}
                          className="h-3.5 w-3.5 accent-current"
                        />
                        <span className="pt truncate">{item.title}</span>
                        <Badge v={item.reviewState ?? "PENDING"} />
                      </div>
                      <span className="pm2">
                        {cap(item.contentType)}
                        {item.status ? ` · ${cap(item.status)}` : ""} · via {sourceName}
                      </span>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/comics/new/${encodeURIComponent(sourceId)}/${encodeURIComponent(
                            item.externalId,
                          )}`}
                          className="rowbtn"
                        >
                          Inspect title
                        </Link>
                        {item.comicSlug && item.reviewState !== "REJECTED" && (
                          <Link
                            href={`/comics/${item.comicSlug}`}
                            style={{ fontSize: 11.5, color: "var(--purple-2)", fontWeight: 600 }}
                          >
                            View publication ↗
                          </Link>
                        )}
                      </div>
                      {item.reviewState && (
                        <span style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 3 }}>
                          Status: {statusLabel(item.reviewState)}
                        </span>
                      )}
                    </div>
                    <div>
                      {isAlreadyPublished ? (
                        <span className="prov-add added">✓ Added</span>
                      ) : (
                        <button
                          type="button"
                          disabled={bulkBusy || !!busyId}
                          onClick={() => publishSingle(item)}
                          className="prov-add"
                        >
                          {isBusy
                            ? item.reviewState === "UNPUBLISHED"
                              ? "Republishing…"
                              : "Publishing…"
                            : item.reviewState === "UNPUBLISHED"
                            ? "Republish"
                            : "Approve & publish"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {(page > 1 || result.hasMore) && (
            <nav aria-label="Provider catalogue pagination" className="pager">
              <button
                type="button"
                disabled={page <= 1 || searchState === "loading" || bulkBusy}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                ‹ Previous
              </button>
              <button type="button" className="on">
                Page {page}
              </button>
              <button
                type="button"
                disabled={!result.hasMore || page * PAGE_SIZE >= 10_000 || searchState === "loading" || bulkBusy}
                onClick={() => setPage((current) => current + 1)}
              >
                Next ›
              </button>
            </nav>
          )}
        </section>
      )}
    </section>
  );
}
