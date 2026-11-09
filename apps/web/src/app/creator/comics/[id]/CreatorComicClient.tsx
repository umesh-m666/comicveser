"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, State, btn, input, table } from "@/components/admin/ui";
import { act, errMsg, useLoad } from "@/lib/useApi";

export default function CreatorComic({ params }: { params: { id: string } }) {
  const router = useRouter(); const { data, error, loading } = useLoad<any[]>(`/creator/comics/${params.id}/chapters`); const [err, setErr] = useState("");
  return (
    <div>
      <p className="text-sm text-muted"><Link href="/creator/dashboard" className="hover:text-fg">← Dashboard</Link></p>
      <h1 className="my-2 text-2xl font-bold">Chapters</h1>
      <form className="mb-6 flex flex-wrap items-end gap-2" onSubmit={async (e) => { e.preventDefault(); setErr(""); const f = new FormData(e.currentTarget);
        try { const ch = await act<{ id: string }>(`/creator/comics/${params.id}/chapters`, "POST", { number: Number(f.get("number")), title: String(f.get("title")) }); router.push(`/creator/chapters/${ch.id}`); } catch (x) { setErr(errMsg(x)); } }}>
        <label className="text-sm"><span className="block text-muted">Number</span><input name="number" type="number" step="0.5" min={0} required className={input + " w-24"} /></label>
        <label className="text-sm"><span className="block text-muted">Title</span><input name="title" required maxLength={200} className={input} /></label>
        <button className={btn}>New chapter</button>
      </form>
      {err && <p role="alert" className="mb-2 text-danger">{err}</p>}<State loading={loading} error={error} />
      {data && (data.length === 0 ? <p className="text-muted">No chapters yet.</p> : <table className={table}><thead><tr><th>#</th><th>Title</th><th>State</th><th>Pages</th><th /></tr></thead>
        <tbody>{data.map((c) => (<tr key={c.id}><td>{c.number}</td><td>{c.title}</td><td><Badge v={c.publishState} /></td><td>{c._count.images}</td><td className="text-right"><Link href={`/creator/chapters/${c.id}`} className="text-primary">Open</Link></td></tr>))}</tbody></table>)}
    </div>
  );
}