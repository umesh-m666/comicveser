"use client";
import Link from "next/link";
import { State } from "@/components/admin/ui";
import { useLoad } from "@/lib/useApi";

interface Dash { totals: Record<string, number>; popular: { id: string; title: string; views: number }[]; latest: { id: string; number: number; publishState: string; comic: { title: string } }[] }
type SourceAlert = { id: string; comicId: string; comicTitle: string; sourceName: string; title: string; availableCount: number; totalSourceChapters: number; url: string };
const LABELS: Record<string, string> = { users: "Users", activeUsers30d: "Active users (30 days)", comics: "Comics", chapters: "Chapters", publishedChapters: "Published chapters", readingRecords: "Reading records", pendingReports: "Pending reports" };

export default function Dashboard() {
  const { data, error, loading } = useLoad<Dash>("/admin/dashboard");
  const alerts = useLoad<SourceAlert[]>("/admin/sources/alerts");
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Dashboard</h1>
      <State loading={loading || alerts.loading} error={error ?? alerts.error} />
      {data && (<>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Object.entries(data.totals).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-line bg-card p-4"><p className="text-2xl font-bold">{v.toLocaleString()}</p><p className="text-sm text-muted">{LABELS[k] ?? k}</p></div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-lg border border-line bg-card p-4"><h2 className="mb-2 font-semibold">Most viewed</h2>
            <ol className="space-y-1 text-sm">{data.popular.map((c) => <li key={c.id} className="flex justify-between"><Link href={`/admin/comics/${c.id}/edit`} className="hover:text-primary">{c.title}</Link><span className="text-muted">{c.views.toLocaleString()}</span></li>)}</ol></section>
          <section className="rounded-lg border border-line bg-card p-4"><h2 className="mb-2 font-semibold">Latest uploads</h2>
            <ul className="space-y-1 text-sm">{data.latest.map((c) => <li key={c.id}><Link href={`/admin/chapters/${c.id}`} className="hover:text-primary">{c.comic.title} · Ch. {c.number}</Link> <span className="text-muted">({c.publishState.toLowerCase()})</span></li>)}</ul></section>
        </div>
      </>)}
      {alerts.data && (
        <section className="mt-6 rounded-lg border border-line bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Source alerts</h2>
            {alerts.data.length > 0 && <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{alerts.data.length}</span>}
          </div>
          {alerts.data.length === 0 ? <p className="text-sm text-muted">No new source chapters are pending review.</p> : (
            <ul className="space-y-2 text-sm">
              {alerts.data.slice(0, 5).map((alert) => (
                <li key={alert.id} className="rounded-md border border-line bg-surface p-3">
                  <Link href={alert.url} className="font-medium text-primary hover:underline">{alert.comicTitle}</Link>
                  <p className="mt-1 text-muted">{alert.availableCount} new chapter{alert.availableCount === 1 ? "" : "s"} available from {alert.sourceName} · {alert.title}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
