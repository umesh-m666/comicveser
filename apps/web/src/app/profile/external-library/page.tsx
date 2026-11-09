"use client";
import Link from "next/link";
import ProfileNav from "@/components/ProfileNav";
import { Cover } from "@/components/ComicCard";
import { State } from "@/components/admin/ui";
import { ApiError } from "@/lib/api";
import { cap, hueOf, media } from "@/lib/sources";
import { act, useLoad } from "@/lib/useApi";

export default function ExternalLibrary() {
  const { data, error, loading, reload } = useLoad<{ id: string; sourceId: string; externalId: string; title: string; coverUrl: string | null; contentType: string; status: string | null }[]>("/user/external-library");
  if (error instanceof ApiError && error.status === 401) return <p>Please <Link href="/login" className="text-primary">log in</Link> to see your saved titles.</p>;
  return (
    <div><ProfileNav active="/profile/external-library" /><State loading={loading} error={error} />
      {data && (data.length === 0 ? <p className="text-muted">No published external titles are saved yet. Approved external titles can be saved to your library from their detail page.</p> : (
        <ul className="space-y-2">{data.map((e) => (
          <li key={e.id} className="flex items-center gap-4 rounded-lg border border-line bg-card p-3">
            <Cover hue={hueOf(e.externalId)} title={e.title} src={media(e.coverUrl)} className="aspect-[2/3] w-12 shrink-0" />
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{e.title}</p><p className="text-sm text-muted">{cap(e.contentType)}{e.status ? ` · ${cap(e.status)}` : ""} · {e.sourceId}</p></div>
            <Link href={`/sources/${e.sourceId}/${e.externalId}`} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white">Open</Link>
            <button className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface" onClick={async () => { await act(`/user/external-library/${e.sourceId}/${e.externalId}`, "DELETE").catch(() => {}); reload(); }}>Remove</button>
          </li>))}</ul>))}
    </div>
  );
}
