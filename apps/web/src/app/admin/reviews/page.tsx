"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

const CATEGORIES = [
  "ALL",
  "BROKEN_CHAPTER",
  "CONTENT_ISSUE",
  "BUG",
  "LOGIN_ISSUE",
  "ABUSE",
  "FEATURE_REQUEST",
  "GENERAL",
];

export default function AdminReviews() {
  const [reportsData, setReportsData] = useState<any>({ items: [], summary: {} });
  const [reviews, setReviews] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (q.trim()) params.set("q", q.trim());
    if (statusFilter !== "ALL") params.set("reportStatus", statusFilter);
    if (categoryFilter !== "ALL") params.set("category", categoryFilter);
    if (unreadOnly) params.set("unreadOnly", "true");

    api(`/admin/reports?${params.toString()}`)
      .then((d) => setReportsData(d))
      .catch(() => {});
    api("/admin/reviews")
      .then((d) => setReviews(d.items ?? []))
      .catch(() => {});
  }, [page, q, statusFilter, categoryFilter, unreadOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const updateReport = async (
    id: string,
    status: "OPEN" | "RESOLVED" | "DISMISSED",
    adminResponse?: string,
  ) => {
    setBusyId(id);
    try {
      await api(`/admin/reports/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          status,
          ...(adminResponse !== undefined ? { adminResponse } : {}),
          isRead: true,
        }),
      });
      load();
    } finally {
      setBusyId(null);
    }
  };

  const delReview = async (id: string) => {
    await api(`/reviews/${id}`, { method: "DELETE" });
    load();
  };

  const summary = reportsData?.summary ?? {};
  const reports: any[] = reportsData?.items ?? [];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Issue Reports, Admin Messages &amp; Reviews</h1>
        <p className="text-sm text-muted">
          Review user-submitted bug reports, broken chapter alerts, login issues, and send direct responses back to readers.
        </p>
      </div>

      {/* Summary Badges */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Total Reports", summary.total ?? reports.length],
          ["Open / Pending", summary.open ?? 0],
          ["Unread Alerts", summary.unread ?? 0],
          ["Resolved", summary.resolved ?? 0],
          ["Dismissed", summary.dismissed ?? 0],
        ].map(([label, count]) => (
          <div key={String(label)} className="rounded-xl border border-line bg-card p-3.5">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-xl font-bold">{Number(count).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card p-4 text-xs">
        <input
          type="search"
          placeholder="Search by user, email, subject, description, ID..."
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          className="min-w-[220px] flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-fg outline-none focus:border-primary"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-fg"
        >
          <option value="ALL">All Statuses</option>
          <option value="OPEN">Open / Pending</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setPage(1);
            setCategoryFilter(e.target.value);
          }}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-fg"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === "ALL" ? "All Categories" : c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => {
              setPage(1);
              setUnreadOnly(e.target.checked);
            }}
          />
          Unread only
        </label>
      </div>

      {/* Issue Reports List */}
      <div className="space-y-3">
        {reports.length === 0 ? (
          <p className="rounded-xl border border-line bg-card p-8 text-center text-sm text-muted">
            No issue reports match your current filters.
          </p>
        ) : (
          reports.map((r) => {
            const draft = replyDrafts[r.id] ?? r.adminResponse ?? "";
            return (
              <div
                key={r.id}
                className={`rounded-xl border p-4 space-y-3 text-sm ${
                  !r.isRead && r.status === "OPEN"
                    ? "border-primary/50 bg-card"
                    : "border-line bg-card/70"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {!r.isRead && (
                        <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                          UNREAD
                        </span>
                      )}
                      <span className="rounded bg-surface px-2 py-0.5 text-xs font-semibold text-primary">
                        {r.category ?? "GENERAL"}
                      </span>
                      <span className="font-bold text-fg">{r.subject || "Issue Report"}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          r.status === "RESOLVED"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : r.status === "DISMISSED"
                            ? "bg-zinc-500/15 text-muted"
                            : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      Submitted by <strong className="text-fg">@{r.username}</strong>{" "}
                      {r.email ? `(${r.email})` : ""} · Target: {r.targetType}:{r.targetId}
                      {r.comicId ? ` · Comic: ${r.comicId}` : ""}
                      {r.chapterId ? ` · Chapter: ${r.chapterId}` : ""} ·{" "}
                      {new Date(r.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {r.status !== "RESOLVED" && (
                      <button
                        disabled={busyId === r.id}
                        onClick={() => updateReport(r.id, "RESOLVED", draft || undefined)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        Resolve
                      </button>
                    )}
                    {r.status !== "DISMISSED" && (
                      <button
                        disabled={busyId === r.id}
                        onClick={() => updateReport(r.id, "DISMISSED", draft || undefined)}
                        className="rounded-lg border border-line px-3 py-1.5 text-muted hover:text-fg disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    )}
                    {r.status !== "OPEN" && (
                      <button
                        disabled={busyId === r.id}
                        onClick={() => updateReport(r.id, "OPEN", draft || undefined)}
                        className="rounded-lg border border-line px-3 py-1.5 text-amber-400 hover:bg-surface disabled:opacity-50"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>

                <p className="rounded-lg bg-surface p-3 text-xs leading-relaxed text-fg whitespace-pre-wrap">
                  {r.description || r.reason}
                </p>

                {/* Admin Response Composer */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    placeholder="Write a response to notify the reporting user..."
                    value={draft}
                    onChange={(e) => setReplyDrafts({ ...replyDrafts, [r.id]: e.target.value })}
                    className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-fg outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    disabled={busyId === r.id || !draft.trim()}
                    onClick={() => updateReport(r.id, "RESOLVED", draft.trim())}
                    className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    Send Response &amp; Resolve
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {(reportsData?.pages ?? 1) > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-line px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-muted">
            Page {page} of {reportsData.pages}
          </span>
          <button
            disabled={page >= reportsData.pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-line px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Recent Reviews Moderation */}
      <div className="space-y-3 pt-4 border-t border-line">
        <h2 className="text-xl font-bold">Recent Reader Reviews</h2>
        {reviews.map((r) => (
          <div
            key={r.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-line bg-card p-3 text-sm"
          >
            <div>
              <p className="text-xs text-muted">
                @{r.user.username} on <strong>{r.comic.title}</strong>
              </p>
              <p>{r.body}</p>
            </div>
            <button onClick={() => delReview(r.id)} className="text-xs text-danger">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
