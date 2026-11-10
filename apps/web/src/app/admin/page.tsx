"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AdminDashboard() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");

  const load = () => {
    setErr("");
    api("/admin/dashboard")
      .then(setD)
      .catch((e) => setErr(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  if (err) {
    return (
      <div className="rounded-xl border border-line bg-card p-6 text-sm text-danger">
        Could not load dashboard: {err}
      </div>
    );
  }
  if (!d) return <div className="skeleton h-64 rounded-xl" />;

  const stats: [string, number][] = [
    ["Users", d.totals.users ?? 0],
    ["Active (30d)", d.totals.activeUsers30d ?? 0],
    ["Comics", d.totals.comics ?? 0],
    ["Chapters", d.totals.chapters ?? 0],
    ["Published ch.", d.totals.publishedChapters ?? 0],
    ["Pending reports", d.totals.pendingReports ?? 0],
    ["Unread messages", d.totals.unreadReports ?? 0],
    ["Resolved reports", d.totals.resolvedReports ?? 0],
  ];

  const recentReports: any[] = d.issueReports?.recent ?? [];
  const pubErrors: any[] = d.operationalAlerts?.publishingErrors ?? [];
  const provFailures: any[] = d.operationalAlerts?.providerFailures ?? [];
  const authFailures: any[] = d.operationalAlerts?.authFailures ?? [];
  const mailStatus = d.operationalAlerts?.mailStatus;
  const authConfig = d.operationalAlerts?.authConfig;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted">
            Real-time overview of readers, catalogue publishing, user issue reports, and system health.
          </p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-semibold hover:bg-surface"
        >
          Refresh Metrics
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([l, v]) => (
          <div key={l} className="rounded-xl border border-line bg-card p-4">
            <p className="text-xs text-muted">{l}</p>
            <p className="mt-1 text-2xl font-bold">{Number(v).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* User Issue Reports & Unread Admin Messages */}
      <div className="rounded-xl border border-line bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">User Issue Reports &amp; Admin Messages</h2>
            <p className="text-xs text-muted">
              {d.issueReports?.unread ?? 0} unread · {d.issueReports?.open ?? 0} open ·{" "}
              {d.issueReports?.resolved ?? 0} resolved
            </p>
          </div>
          <Link
            href="/admin/reviews"
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
          >
            Manage All Issue Reports →
          </Link>
        </div>

        {recentReports.length === 0 ? (
          <p className="text-xs text-muted">No user issue reports submitted yet.</p>
        ) : (
          <div className="space-y-2">
            {recentReports.slice(0, 5).map((r) => (
              <div
                key={r.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-xs ${
                  !r.isRead && r.status === "OPEN"
                    ? "border-primary/50 bg-surface"
                    : "border-line bg-surface/40"
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {!r.isRead && (
                      <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                        NEW
                      </span>
                    )}
                    <span className="rounded bg-card px-2 py-0.5 font-semibold text-primary">
                      {r.category}
                    </span>
                    <span className="font-semibold text-fg">{r.subject}</span>
                    <span className="text-muted">
                      by @{r.username} {r.email ? `(${r.email})` : ""}
                    </span>
                  </div>
                  <p className="text-muted line-clamp-1">{r.description || r.reason}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      r.status === "RESOLVED"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : r.status === "DISMISSED"
                        ? "bg-zinc-500/15 text-muted"
                        : "bg-amber-500/15 text-amber-400"
                    }`}
                  >
                    {r.status}
                  </span>
                  <Link href="/admin/reviews" className="text-primary hover:underline">
                    Review
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Operational Health: Auth, Resend Mail, Publishing & Provider Errors */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-card p-5 space-y-3">
          <h2 className="font-semibold">Authentication &amp; Email Service Status</h2>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-lg border border-line bg-surface p-2.5">
              <span>Google OAuth Sign-In</span>
              <span
                className={
                  authConfig?.googleEnabled
                    ? "font-semibold text-emerald-400"
                    : "font-semibold text-amber-400"
                }
              >
                {authConfig?.googleEnabled ? "Configured & Active" : "Set GOOGLE_CLIENT_ID"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-line bg-surface p-2.5">
              <span>Email Provider ({mailStatus?.provider ?? "log"})</span>
              <span
                className={
                  mailStatus?.configured
                    ? "font-semibold text-emerald-400"
                    : "font-semibold text-amber-400"
                }
              >
                {mailStatus?.configured ? "Configured" : "Attention Needed"}
              </span>
            </div>
          </div>

          {authFailures.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <p className="text-xs font-semibold text-muted">Recent Authentication Alerts</p>
              {authFailures.slice(0, 4).map((f, idx) => (
                <div key={idx} className="rounded border border-line bg-surface/60 p-2 text-xs">
                  <span className="font-semibold text-danger">[{f.method}]</span> {f.reason}:{" "}
                  {f.email ?? ""} · <span className="text-muted">{new Date(f.at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-line bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Publishing &amp; Source Provider Alerts</h2>
            <Link href="/admin/sources" className="text-xs text-primary hover:underline">
              Open Sources →
            </Link>
          </div>
          {pubErrors.length === 0 && provFailures.length === 0 ? (
            <p className="text-xs text-muted">
              No recent publishing errors or upstream provider failures recorded.
            </p>
          ) : (
            <div className="space-y-2 text-xs max-h-56 overflow-y-auto">
              {pubErrors.slice(0, 5).map((errItem, idx) => (
                <div key={`pub-${idx}`} className="rounded border border-danger/30 bg-danger/10 p-2.5">
                  <p className="font-semibold text-danger">
                    Publish Error [{errItem.sourceId}:{errItem.externalId}] ({errItem.code})
                  </p>
                  <p className="text-muted">{errItem.message}</p>
                </div>
              ))}
              {provFailures.slice(0, 5).map((pf, idx) => (
                <div key={`prov-${idx}`} className="rounded border border-line bg-surface p-2.5">
                  <p className="font-semibold text-amber-400">
                    Provider Warning [{pf.sourceId}] ({pf.code})
                  </p>
                  <p className="text-muted">{pf.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-card p-4 space-y-2">
          <h2 className="font-semibold">Top comics by views</h2>
          {d.popular.map((c: any) => (
            <div key={c.id} className="flex justify-between text-sm">
              <span>{c.title}</span>
              <span className="text-muted">{c.views.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-line bg-card p-4 space-y-2">
          <h2 className="font-semibold">Latest chapters</h2>
          {d.latest.map((c: any) => (
            <div key={c.id} className="flex justify-between text-sm">
              <span>
                {c.comic.title} · Ch. {c.number}
              </span>
              <span className="text-xs text-muted">{c.publishState}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
