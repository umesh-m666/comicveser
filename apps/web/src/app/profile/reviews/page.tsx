"use client";
import Link from "next/link";
import ProfileNav from "@/components/ProfileNav";
import { State } from "@/components/admin/ui";
import { ApiError } from "@/lib/api";
import { act, useLoad } from "@/lib/useApi";

export default function MyReviews() {
  const { data, error, loading, reload } = useLoad<{ id: string; body: string; rating: number | null; createdAt: string; comic: { slug: string; title: string } }[]>("/user/reviews");
  if (error instanceof ApiError && error.status === 401) return <p>Please <Link href="/login" className="text-primary">log in</Link> to see your reviews.</p>;
  return (
    <div><ProfileNav active="/profile/reviews" /><State loading={loading} error={error} />
      {data && (data.length === 0 ? <p className="text-muted">You haven't written any reviews yet.</p> : (
        <ul className="space-y-3">{data.map((r) => (
          <li key={r.id} className="rounded-lg border border-line bg-card p-4">
            <div className="flex items-center justify-between"><Link href={`/comics/${r.comic.slug}`} className="font-semibold hover:text-primary">{r.comic.title}</Link><span className="text-sm text-muted">{r.rating ? `${r.rating}/10 · ` : ""}{new Date(r.createdAt).toLocaleDateString("en-IN")}</span></div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{r.body}</p>
            <button className="mt-2 rounded-md border border-line px-2 py-1 text-xs hover:bg-surface" onClick={async () => { if (confirm("Delete this review?")) { await act(`/reviews/${r.id}`, "DELETE").catch(() => {}); reload(); } }}>Delete</button>
          </li>))}</ul>))}
    </div>
  );
}
