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

/**
 * Asura Admin Reviews & Reports Page (#frame-admin-reviews):
 * .a-top header, .stat-grid summary badges, filter bar, issue reports list with response composer,
 * and Recent Reader Reviews moderation.
 */
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
    <div>
      <div className="a-top" data-layer="Admin Topbar">
        <div>
          <h1>Reviews &amp; Reports</h1>
          <div className="sub">
            Moderate reader reviews and chapter issue reports in one queue.
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid" data-layer="Stat Cards">
        {[
          ["Total Reports", summary.total ?? reports.length],
          ["Open / Pending", summary.open ?? 0],
          ["Unread Alerts", summary.unread ?? 0],
          ["Resolved", summary.resolved ?? 0],
        ].map(([label, count]) => (
          <div key={String(label)} className="stat">
            <div className="k">{label}</div>
            <div className="v">{Number(count).toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="a-panel" data-layer="Reports Filter">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="s-search flex-1" style={{ background: "#242133" }}>
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              id="admin-reports-search"
              aria-label="Search issue reports by user, email, subject, description, or ID"
              placeholder="Search by user, email, subject, description, ID..."
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
            />
          </label>
          <select
            id="admin-reports-status"
            aria-label="Filter issue reports by status"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="rounded-lg border border-[#342f49] bg-[#242133] px-3 py-2 text-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open / Pending</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
          <select
            id="admin-reports-category"
            aria-label="Filter issue reports by category"
            value={categoryFilter}
            onChange={(e) => {
              setPage(1);
              setCategoryFilter(e.target.value);
            }}
            className="rounded-lg border border-[#342f49] bg-[#242133] px-3 py-2 text-white"
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
      </div>

      {/* Issue Reports List */}
      <div className="a-panel" data-layer="Reports Queue">
        <h3>Reader reports</h3>
        <div className="psub">Issues reported from the chapter reader and site</div>
        {reports.length === 0 ? (
          <p className="text-sm text-muted">No issue reports match your current filters.</p>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => {
              const draft = replyDrafts[r.id] ?? r.adminResponse ?? "";
              return (
                <div
                  key={r.id}
                  className="svc-alert space-y-2.5"
                  style={
                    !r.isRead && r.status === "OPEN"
                      ? { borderColor: "rgba(168,85,247,.55)" }
                      : undefined
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {!r.isRead && <span className="tag purple">UNREAD</span>}
                        <span className="tag grey">{r.category ?? "GENERAL"}</span>
                        <strong className="text-white">{r.subject || "Issue Report"}</strong>
                        <span
                          className={`tag ${
                            r.status === "RESOLVED"
                              ? "green"
                              : r.status === "DISMISSED"
                              ? "grey"
                              : "amber"
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted m-0">
                        Submitted by <strong className="text-white">@{r.username}</strong>{" "}
                        {r.email ? `(${r.email})` : ""} · Target: {r.targetType}:{r.targetId}
                        {r.comicId ? ` · Comic: ${r.comicId}` : ""}
                        {r.chapterId ? ` · Chapter: ${r.chapterId}` : ""} ·{" "}
                        {new Date(r.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      {r.status !== "RESOLVED" && (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => updateReport(r.id, "RESOLVED", draft || undefined)}
                          className="rowbtn"
                          style={{ background: "var(--purple)", color: "#fff" }}
                        >
                          Resolve
                        </button>
                      )}
                      {r.status !== "DISMISSED" && (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => updateReport(r.id, "DISMISSED", draft || undefined)}
                          className="rowbtn"
                        >
                          Dismiss
                        </button>
                      )}
                      {r.status !== "OPEN" && (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => updateReport(r.id, "OPEN", draft || undefined)}
                          className="rowbtn"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="rounded-lg bg-[#131118] p-3 text-xs leading-relaxed text-white whitespace-pre-wrap m-0">
                    {r.description || r.reason}
                  </p>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      aria-label={`Admin response for report ${r.id}`}
                      placeholder="Write a response to notify the reporting user..."
                      value={draft}
                      onChange={(e) => setReplyDrafts({ ...replyDrafts, [r.id]: e.target.value })}
                      className="set-input flex-1 !h-9 text-xs"
                    />
                    <button
                      type="button"
                      disabled={busyId === r.id || !draft.trim()}
                      onClick={() => updateReport(r.id, "RESOLVED", draft.trim())}
                      className="pillbtn !ml-0"
                    >
                      Send Response &amp; Resolve
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(reportsData?.pages ?? 1) > 1 && (
          <div className="pager">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹ Previous
            </button>
            <button type="button" className="on">
              Page {page} of {reportsData.pages}
            </button>
            <button
              type="button"
              disabled={page >= reportsData.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next ›
            </button>
          </div>
        )}
      </div>

      {/* Recent Reviews Moderation */}
      <div className="a-panel" data-layer="Review Moderation">
        <h3>Recent Reader Reviews</h3>
        <div className="psub">Reviews posted on comic detail pages</div>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted">No reviews yet.</p>
        ) : (
          <div className="space-y-2">
            {reviews.map((r) => (
              <div key={r.id} className="upd" style={{ alignItems: "flex-start" }}>
                <div className="u-main">
                  <h3 style={{ whiteSpace: "normal" }}>
                    {r.comic.title}{" "}
                    <span style={{ color: "var(--gold)", fontSize: 12 }}>★★★★★</span>
                  </h3>
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontSize: 13,
                      color: "#ddd9ea",
                      fontFamily: "Inter",
                    }}
                  >
                    “{r.body}”
                  </p>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    by @{r.user.username}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => delReview(r.id)}
                  className="rowbtn danger"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
