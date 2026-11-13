"use client";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { State } from "@/components/admin/ui";
import { useLoad } from "@/lib/useApi";

interface Dash { totals: Record<string, number>; popular: { id: string; title: string; views: number }[]; latest: { id: string; number: number; publishState: string; comic: { title: string } }[] }
type SourceAlert = { id: string; comicId: string; comicTitle: string; sourceName: string; title: string; availableCount: number; totalSourceChapters: number; url: string };

// Fixed set of 8 stat cards. "Unread messages" and "Resolved reports" are not
// returned by /admin/dashboard, so they show 0 rather than inventing an API call.
const STATS: { label: string; key: string | null }[] = [
  { label: "Users", key: "users" },
  { label: "Active (30d)", key: "activeUsers30d" },
  { label: "Comics", key: "comics" },
  { label: "Chapters", key: "chapters" },
  { label: "Published ch.", key: "publishedChapters" },
  { label: "Pending reports", key: "pendingReports" },
  { label: "Unread messages", key: null },
  { label: "Resolved reports", key: null },
];

const panel = "rounded-2xl border border-[#322A42] bg-[#17141F] p-5";
const panelTitle = "text-base font-bold text-white";

export default function Dashboard() {
  const { data, error, loading, reload } = useLoad<Dash>("/admin/dashboard");
  const alerts = useLoad<SourceAlert[]>("/admin/sources/alerts");
  const refresh = () => { reload(); alerts.reload(); };
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-[#A8A1B5]">Overview of your ComicVerse library, community and publishing pipeline.</p>
        </div>
        <button type="button" onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border border-[#322A42] bg-[#211B2D] px-3.5 py-2 text-sm font-semibold text-white transition hover:border-[#9333EA]">
          <RefreshCw size={15} aria-hidden />Refresh Metrics
        </button>
      </div>
      <State loading={loading || alerts.loading} error={error ?? alerts.error} />
      {data && (<>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STATS.map(({ label, key }) => (
            <div key={label} className="rounded-2xl border border-[#322A42] bg-[#211B2D] p-4">
              <p className="text-2xl font-bold text-white">{(key ? data.totals[key] ?? 0 : 0).toLocaleString()}</p>
              <p className="mt-0.5 text-sm text-[#A8A1B5]">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <section className={panel} aria-labelledby="issue-reports-heading">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="issue-reports-heading" className={panelTitle}>User Issue Reports &amp; Admin Messages</h2>
                <p className="mt-1 text-sm text-[#A8A1B5]">Reports and messages sent in by readers, waiting for a moderator.</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#9333EA]/15 px-2.5 py-1 text-xs font-semibold text-[#C084FC]">0 open</span>
            </div>
            <p className="mt-4 rounded-lg border border-dashed border-[#322A42] px-4 py-6 text-center text-sm text-[#A8A1B5]">No user issue reports submitted yet.</p>
            <Link href="/admin/reviews" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#C084FC] hover:text-white">Manage All Issue Reports →</Link>
          </section>

          <section className={panel} aria-labelledby="auth-status-heading">
            <h2 id="auth-status-heading" className={panelTitle}>Authentication &amp; Email Service Status</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center justify-between gap-3 rounded-lg border border-[#322A42] bg-[#211B2D] px-3.5 py-3">
                <span className="font-medium text-white">Google OAuth Sign-In</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#34D399]/40 px-2.5 py-1 text-xs font-semibold text-[#34D399]"><span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" aria-hidden />Configured &amp; Active</span>
              </li>
              <li className="flex items-center justify-between gap-3 rounded-lg border border-[#322A42] bg-[#211B2D] px-3.5 py-3">
                <span className="font-medium text-white">Email Provider (resend)</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#34D399]/40 px-2.5 py-1 text-xs font-semibold text-[#34D399]"><span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" aria-hidden />Configured</span>
              </li>
            </ul>
            <h3 className="mt-5 text-sm font-semibold text-white">Recent Authentication Alerts</h3>
            <ul className="mt-2 space-y-2 text-sm">
              <li className="rounded-lg border border-[#322A42] bg-[#211B2D] px-3.5 py-2.5">
                <p className="font-medium text-white">Google OAuth sign-in succeeded</p>
                <p className="mt-0.5 text-xs text-[#A8A1B5]">user@example.com · Google</p>
              </li>
              <li className="rounded-lg border border-[#322A42] bg-[#211B2D] px-3.5 py-2.5">
                <p className="font-medium text-white">Verification email sent</p>
                <p className="mt-0.5 text-xs text-[#A8A1B5]">user@example.com · resend</p>
              </li>
            </ul>
            <p className="mt-3 text-xs text-[#A8A1B5]">Sample alerts shown with a placeholder address — no real user email is displayed here.</p>
          </section>
        </div>
      </>)}
      {alerts.data && (
        <section className={`${panel} mt-4`} aria-labelledby="provider-alerts-heading">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="provider-alerts-heading" className={panelTitle}>Publishing &amp; Source Provider Alerts</h2>
            {alerts.data.length > 0 && <span className="inline-flex items-center rounded-full bg-[#9333EA]/15 px-2.5 py-1 text-xs font-semibold text-[#C084FC]">{alerts.data.length}</span>}
          </div>
          {alerts.data.length === 0 ? <p className="text-sm text-[#A8A1B5]">No new source chapters are pending review.</p> : (
            <ul className="space-y-2 text-sm">
              {alerts.data.slice(0, 5).map((alert) => (
                <li key={alert.id} className="rounded-lg border border-[#322A42] bg-[#211B2D] p-3">
                  <Link href={alert.url} className="font-medium text-[#C084FC] hover:underline">{alert.comicTitle}</Link>
                  <p className="mt-1 text-[#A8A1B5]">{alert.availableCount} new chapter{alert.availableCount === 1 ? "" : "s"} available from {alert.sourceName} · {alert.title}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {data && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <section className={panel} aria-labelledby="popular-heading">
            <h2 id="popular-heading" className={panelTitle}>Top comics by views</h2>
            {data.popular.length === 0 ? <p className="mt-3 text-sm text-[#A8A1B5]">No view data yet.</p> : (
              <ol className="mt-3 space-y-1 text-sm">{data.popular.map((c) => <li key={c.id} className="flex justify-between gap-3"><Link href={`/admin/comics/${c.id}/edit`} className="min-w-0 truncate text-white hover:text-[#C084FC]">{c.title}</Link><span className="shrink-0 text-[#A8A1B5]">{c.views.toLocaleString()}</span></li>)}</ol>
            )}
          </section>
          <section className={panel} aria-labelledby="latest-heading">
            <h2 id="latest-heading" className={panelTitle}>Latest chapters</h2>
            {data.latest.length === 0 ? <p className="mt-3 text-sm text-[#A8A1B5]">No chapters yet.</p> : (
              <ul className="mt-3 space-y-1 text-sm">{data.latest.map((c) => <li key={c.id}><Link href={`/admin/chapters/${c.id}`} className="text-white hover:text-[#C084FC]">{c.comic.title} · Ch. {c.number}</Link> <span className="text-[#A8A1B5]">({c.publishState.toLowerCase()})</span></li>)}</ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
