"use client";
import { useState } from "react";
import { State, btn, btnDanger, input } from "@/components/admin/ui";
import { act, errMsg, useLoad } from "@/lib/useApi";

export default function AdminAnnouncements() {
  const { data, error, loading, reload } = useLoad<{ id: string; title: string; body: string; publishAt: string | null }[]>("/admin/announcements");
  const [err, setErr] = useState("");
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); const form = e.currentTarget; const f = new FormData(form); const at = String(f.get("publishAt") ?? "");
    try { await act("/admin/announcements", "POST", { title: f.get("title"), body: f.get("body"), publishAt: at ? new Date(at).toISOString() : undefined }); form.reset(); reload(); } catch (x) { setErr(errMsg(x)); }
  }
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Announcements</h1>
      <form onSubmit={create} className="mb-6 max-w-xl space-y-2">
        <input name="title" required maxLength={200} placeholder="Title" className={input} aria-label="Title" />
        <textarea name="body" required maxLength={2000} rows={3} placeholder="Message" className={input} aria-label="Message" />
        <label className="block text-sm text-muted">Show from (optional, leave empty to show now)<input name="publishAt" type="datetime-local" className={input + " mt-1"} /></label>
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}<button className={btn}>Publish announcement</button>
      </form>
      <State loading={loading} error={error} />
      {data && (data.length === 0 ? <p className="text-muted">No announcements yet.</p> : <ul className="space-y-2">{data.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-card p-3"><div><p className="font-medium">{a.title}</p><p className="text-sm text-muted">{a.body}</p>{a.publishAt && <p className="text-xs text-muted">Shows from {new Date(a.publishAt).toLocaleString("en-IN")}</p>}</div>
          <button className={btnDanger} onClick={async () => { if (confirm("Delete this announcement?")) { try { await act(`/admin/announcements/${a.id}`, "DELETE"); reload(); } catch (x) { setErr(errMsg(x)); } } }}>Delete</button></li>))}</ul>)}
    </div>
  );
}
