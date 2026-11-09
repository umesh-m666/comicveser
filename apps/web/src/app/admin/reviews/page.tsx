"use client";
import { useState } from "react";
import { Badge, State, btn, btnDanger, btnGhost, table } from "@/components/admin/ui";
import { act, errMsg, useLoad } from "@/lib/useApi";

export default function AdminReviews() {
  const reports = useLoad<{ items: any[] }>("/admin/reports"); const reviews = useLoad<{ items: any[] }>("/admin/reviews"); const [err, setErr] = useState("");
  const run = async (fn: () => Promise<unknown>) => { setErr(""); try { await fn(); reports.reload(); reviews.reload(); } catch (e) { setErr(errMsg(e)); } };
  return (
    <div className="space-y-8"><h1 className="text-2xl font-bold">Reviews and reports</h1>{err && <p role="alert" className="text-danger">{err}</p>}
      <section><h2 className="mb-2 font-semibold">Reports</h2><State loading={reports.loading} error={reports.error} />
        {reports.data && (reports.data.items.length === 0 ? <p className="text-muted">No reports.</p> : <table className={table}><thead><tr><th>Target</th><th>Reason</th><th>Status</th><th /></tr></thead>
          <tbody>{reports.data.items.map((r) => (<tr key={r.id}><td>{r.targetType}</td><td className="max-w-sm">{r.reason}</td><td><Badge v={r.status} /></td>
            <td className="flex flex-wrap justify-end gap-2">{r.status === "OPEN" && <>
              {r.targetType === "REVIEW" && <button className={btnDanger} onClick={() => confirm("Delete the reported review?") && run(async () => { await act(`/reviews/${r.targetId}`, "DELETE").catch(() => {}); await act(`/admin/reports/${r.id}`, "PUT", { status: "RESOLVED" }); })}>Delete review</button>}
              <button className={btn} onClick={() => run(() => act(`/admin/reports/${r.id}`, "PUT", { status: "RESOLVED" }))}>Resolve</button>
              <button className={btnGhost} onClick={() => run(() => act(`/admin/reports/${r.id}`, "PUT", { status: "DISMISSED" }))}>Dismiss</button></>}</td></tr>))}</tbody></table>)}</section>
      <section><h2 className="mb-2 font-semibold">Recent reviews</h2><State loading={reviews.loading} error={reviews.error} />
        {reviews.data && (reviews.data.items.length === 0 ? <p className="text-muted">No reviews yet.</p> : <table className={table}><thead><tr><th>Comic</th><th>User</th><th>Review</th><th /></tr></thead>
          <tbody>{reviews.data.items.map((r) => (<tr key={r.id}><td>{r.comic.title}</td><td>{r.user.username}</td><td className="max-w-md truncate">{r.body}</td>
            <td className="text-right"><button className={btnDanger} onClick={() => confirm("Delete this review?") && run(() => act(`/reviews/${r.id}`, "DELETE"))}>Delete</button></td></tr>))}</tbody></table>)}</section>
    </div>
  );
}
