"use client";
import { useState } from "react";
import BarChart from "@/components/admin/BarChart";
import { State, input } from "@/components/admin/ui";
import { useLoad } from "@/lib/useApi";

interface Summary { days: number; daily: { day: string; type: string; n: number }[]; activeUsers: { day: string; n: number }[]; topSearches: { query: string; n: number }[]; topComics: { title: string; n: number }[]; topGenres: { name: string; n: number }[] }

export default function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const { data, error, loading } = useLoad<Summary>(`/admin/analytics?days=${days}`);
  const series = (type: string) => data ? Array.from({ length: data.days }, (_, i) => { const d = new Date(Date.now() - (data.days - 1 - i) * 864e5).toISOString().slice(0, 10); return { label: d, value: data.daily.find((r) => r.day === d && r.type === type)?.n ?? 0 }; }) : [];
  const dau = data ? series("PAGE_VIEW").map((p) => ({ label: p.label, value: data.activeUsers.find((r) => r.day === p.label)?.n ?? 0 })) : [];
  const List = ({ title, rows }: { title: string; rows: { k: string; n: number }[] }) => (
    <section className="rounded-lg border border-line bg-card p-4"><h2 className="mb-2 font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-muted">No data yet.</p> : <ol className="space-y-1 text-sm">{rows.map((r, i) => <li key={i} className="flex justify-between"><span className="truncate">{r.k}</span><span className="text-muted">{r.n}</span></li>)}</ol>}</section>
  );
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h1 className="text-2xl font-bold">Analytics</h1>
        <select aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))} className={input + " max-w-40"}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></div>
      <p className="mb-4 text-sm text-muted">Counts only include visitors who accepted analytics. Active readers counts logged-in accounts.</p>
      <State loading={loading} error={error} />
      {data && (<>
        <div className="grid gap-4 md:grid-cols-2">
          <BarChart title="Page views" data={series("PAGE_VIEW")} /><BarChart title="Comic views" data={series("COMIC_VIEW")} color="var(--secondary)" />
          <BarChart title="Chapter views" data={series("CHAPTER_VIEW")} /><BarChart title="Reading sessions" data={series("READ_SESSION")} color="var(--secondary)" />
          <BarChart title="Active readers (logged in)" data={dau} color="var(--success)" />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <List title="Top comics" rows={data.topComics.map((c) => ({ k: c.title, n: c.n }))} /><List title="Popular genres" rows={data.topGenres.map((g) => ({ k: g.name, n: g.n }))} /><List title="Top searches" rows={data.topSearches.map((s) => ({ k: s.query, n: s.n }))} />
        </div></>)}
    </div>
  );
}
