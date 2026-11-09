"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Pager, State, btn, btnDanger, btnGhost, input, table } from "@/components/admin/ui";
import { act, errMsg, useLoad } from "@/lib/useApi";

export default function AdminComics({ searchParams }: { searchParams: { q?: string; state?: string; page?: string } }) {
  const router = useRouter(); const [err, setErr] = useState("");
  const sp = new URLSearchParams(Object.entries(searchParams).filter(([, v]) => v) as [string, string][]);
  const { data, error, loading, reload } = useLoad<{ items: any[]; page: number; pages: number; total: number }>(`/admin/comics?${sp}`);
  const href = (p: number) => `/admin/comics?${new URLSearchParams({ ...Object.fromEntries(sp), page: String(p) })}`;
  const run = async (fn: () => Promise<unknown>) => { setErr(""); try { await fn(); reload(); } catch (e) { setErr(errMsg(e)); } };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-bold">Comics</h1><Link href="/admin/comics/new" className={btn}>Add comic</Link></div>
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); router.push(`/admin/comics?${new URLSearchParams({ q: String(f.get("q") ?? ""), state: String(f.get("state") ?? "") })}`); }}>
        <input name="q" defaultValue={searchParams.q} placeholder="Search title" className={input} aria-label="Search title" />
        <select name="state" defaultValue={searchParams.state ?? ""} className={input + " max-w-40"} aria-label="Visibility"><option value="">All</option>{["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"].map((s) => <option key={s}>{s}</option>)}</select>
        <button className={btnGhost}>Filter</button>
      </form>
      {err && <p role="alert" className="mb-2 text-danger">{err}</p>}
      <State loading={loading} error={error} />
      {data && (data.items.length === 0 ? <p className="text-muted">No comics found.</p> : (
        <div className="overflow-x-auto"><table className={table}>
          <thead><tr><th>Title</th><th>Type</th><th>Visibility</th><th>Chapters</th><th /></tr></thead>
          <tbody>{data.items.map((c) => (
            <tr key={c.id}><td className="font-medium">{c.title}</td><td>{c.type}</td><td><Badge v={c.publishState} /></td><td>{c._count.chapters}</td>
              <td className="flex flex-wrap justify-end gap-2">
                <Link href={`/admin/comics/${c.id}/edit`} className={btnGhost}>Edit</Link>
                <Link href={`/admin/chapters?comicId=${c.id}`} className={btnGhost}>Chapters</Link>
                <button className={btnGhost} onClick={() => run(() => act(`/admin/comics/${c.id}`, "PUT", { publishState: c.publishState === "PUBLISHED" ? "UNPUBLISHED" : "PUBLISHED" }))}>{c.publishState === "PUBLISHED" ? "Unpublish" : "Publish"}</button>
                <button className={btnDanger} onClick={() => confirm(`Delete "${c.title}"? It will be archived and hidden.`) && run(() => act(`/admin/comics/${c.id}`, "DELETE"))}>Delete</button>
              </td></tr>))}</tbody></table></div>))}
      {data && <Pager page={data.page} pages={data.pages} href={href} />}
    </div>
  );
}
