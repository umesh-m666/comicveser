"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, State, btn, input, table } from "@/components/admin/ui";
import AvailableSourceChapters from "@/components/admin/AvailableSourceChapters";
import { useLoad } from "@/lib/useApi";

export default function AdminChapters({ searchParams }: { searchParams: { comicId?: string } }) {
  const router = useRouter(); const id = searchParams.comicId;
  const comics = useLoad<{ items: { id: string; title: string }[] }>("/admin/comics");
  const list = useLoad<any[]>(id ? `/admin/chapters?comicId=${id}` : null);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Chapters</h1>
        {id && <Link href={`/admin/chapters/new?comicId=${id}`} className={btn}>Add chapter</Link>}
      </div>
      <label className="mb-4 block max-w-sm text-sm"><span className="mb-1 block text-muted">Comic (20 most recently updated)</span>
        <select value={id ?? ""} onChange={(e) => router.push(e.target.value ? `/admin/chapters?comicId=${e.target.value}` : "/admin/chapters")} className={input}>
          <option value="">Select a comic</option>{comics.data?.items.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select></label>
      {!id && <p className="text-muted">Choose a comic to manage its chapters. You can also open this page from a comic's "Chapters" button.</p>}
      {id && <State loading={list.loading} error={list.error} />}
      {list.data && (list.data.length === 0 ? <p className="text-muted">No chapters yet.</p> : (
        <table className={table}><thead><tr><th>#</th><th>Title</th><th>State</th><th>Pages</th><th /></tr></thead>
          <tbody>{list.data.map((c) => (<tr key={c.id}><td>{c.number}</td><td>{c.title}</td><td><Badge v={c.publishState} /></td><td>{c._count.images}</td>
            <td className="text-right"><Link href={`/admin/chapters/${c.id}`} className="text-primary">Manage</Link></td></tr>))}</tbody></table>))}
      {id && <AvailableSourceChapters key={id} comicId={id} onImported={list.reload} />}
    </div>
  );
}
