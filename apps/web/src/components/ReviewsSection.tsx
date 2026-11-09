"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";

interface Rev { id: string; body: string; helpfulCount: number; createdAt: string; rating: number | null; user: { id: string; username: string } }
const call = <T,>(p: string, method = "GET", json?: unknown) => api<T>(p, { method, json, credentials: "include", cache: "no-store" });

export default function ReviewsSection({ comicId }: { comicId: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ average: number | null; ratingCount: number; total: number; pages: number; items: Rev[] } | null>(null);
  const [me, setMe] = useState<{ id: string } | null>(null); const [mine, setMine] = useState<{ rating: number | null; review: { id: string; body: string } | null } | null>(null);
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);

  const load = () => call<any>(`/comics/${comicId}/reviews?page=${page}`).then(setData).catch(() => setMsg("Couldn't load reviews."));
  const loadMine = () => call<any>(`/comics/${comicId}/mine`).then(setMine).catch(() => setMine(null));
  useEffect(() => { load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { call<{ id: string }>("/auth/me").then((u) => { setMe(u); loadMine(); }).catch(() => setMe(null)); }, [comicId]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn: () => Promise<unknown>, after?: () => void) => { setMsg(""); setBusy(true); try { await fn(); after?.(); load(); loadMine(); } catch (e) { setMsg(e instanceof ApiError ? (e.details?.join(" ") ?? e.message) : "Something went wrong."); } finally { setBusy(false); } };
  const btn = "rounded-md border border-line px-2 py-1 text-xs hover:bg-card disabled:opacity-50";

  return (
    <section className="mt-10" aria-labelledby="rev-h">
      <h2 id="rev-h" className="text-xl font-bold">Ratings and reviews</h2>
      <p className="mt-1 text-sm text-muted">{data?.average ? `${data.average.toFixed(1)} / 10 from ${data.ratingCount} rating${data.ratingCount === 1 ? "" : "s"}` : "No ratings yet."}</p>

      {me ? (
        <div className="mt-4 rounded-lg border border-line bg-card p-4">
          <p className="mb-2 text-sm">Your rating</p>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Your rating">{Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
            <button key={v} disabled={busy} aria-pressed={mine?.rating === v} onClick={() => act(() => call(`/comics/${comicId}/rating`, "PUT", { value: v }))}
              className={`h-8 w-8 rounded-md border text-sm ${mine?.rating === v ? "border-primary bg-primary" : "border-line hover:bg-surface"}`}>{v}</button>))}</div>
          <form className="mt-4" onSubmit={(e) => { e.preventDefault(); const body = String(new FormData(e.currentTarget).get("body")); act(() => mine?.review ? call(`/reviews/${mine.review.id}`, "PUT", { body }) : call(`/comics/${comicId}/reviews`, "POST", { body })); }}>
            <label className="block text-sm"><span className="mb-1 block text-muted">{mine?.review ? "Edit your review" : "Write a review"} (10+ characters)</span>
              <textarea key={mine?.review?.id ?? "new"} name="body" required minLength={10} maxLength={3000} rows={3} defaultValue={mine?.review?.body ?? ""} className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm" /></label>
            <div className="mt-2 flex gap-2"><button disabled={busy} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold disabled:opacity-60">{mine?.review ? "Save review" : "Post review"}</button>
              {mine?.review && <button type="button" disabled={busy} className={btn + " !text-sm"} onClick={() => confirm("Delete your review?") && act(() => call(`/reviews/${mine.review!.id}`, "DELETE"))}>Delete</button>}</div>
          </form>
        </div>
      ) : <p className="mt-3 text-sm"><Link href="/login" className="text-primary">Log in</Link> to rate and review.</p>}
      {msg && <p role="alert" className="mt-2 text-sm text-danger">{msg}</p>}

      <ul className="mt-4 space-y-3">{data?.items.map((r) => (
        <li key={r.id} className="rounded-lg border border-line bg-card p-4">
          <div className="flex items-center justify-between text-sm"><span className="font-medium">{r.user.username}{r.rating && <span className="ml-2 text-muted">{r.rating}/10</span>}</span><span className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString("en-IN")}</span></div>
          <p className="mt-2 whitespace-pre-wrap text-sm">{r.body}</p>
          {me && me.id !== r.user.id && (
            <div className="mt-3 flex gap-2">
              <button className={btn} disabled={busy} onClick={() => act(() => call(`/reviews/${r.id}/helpful`, "POST"))}>Helpful ({r.helpfulCount})</button>
              <button className={btn} disabled={busy} onClick={() => { const reason = prompt("Why are you reporting this review?"); if (reason && reason.trim().length >= 5) act(() => call("/reports", "POST", { targetType: "REVIEW", targetId: r.id, reason: reason.trim() }), () => setMsg("Thanks, we'll take a look.")); }}>Report</button>
            </div>)}
          {(!me || me.id === r.user.id) && <p className="mt-2 text-xs text-muted">{r.helpfulCount} found this helpful</p>}
        </li>))}</ul>
      {data && data.total === 0 && <p className="mt-3 text-sm text-muted">No reviews yet. Be the first.</p>}
      {data && data.pages > 1 && <div className="mt-4 flex items-center gap-3 text-sm"><button className={btn} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span className="text-muted">Page {page} of {data.pages}</span><button className={btn} disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button></div>}
    </section>
  );
}
