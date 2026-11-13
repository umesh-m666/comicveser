"use client";
import Link from "next/link";
import { ComicVerseMark } from "@/components/ComicVerseLogo";
import { useState } from "react";
import { Badge, State, btn, input, table } from "@/components/admin/ui";
import { ApiError } from "@/lib/api";
import { act, errMsg, useLoad } from "@/lib/useApi";

export default function CreatorDashboard() {
  const me = useLoad<{ status: string; displayName?: string }>("/creator/me");
  const approved = me.data?.status === "APPROVED";
  const comics = useLoad<any[]>(approved ? "/creator/comics" : null);
  const [err, setErr] = useState("");
  if (me.error) return me.error instanceof ApiError && me.error.status === 401 ? <p>Please <Link href="/login" className="text-primary">log in</Link> to use the creator portal.</p> : <State loading={false} error={me.error} />;
  return (
    <div>
      <div className="mb-4 flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#2F2250] p-1.5 border border-white/20"><ComicVerseMark className="h-full w-full" /></span><h1 className="text-2xl font-bold m-0">Creator portal</h1></div><State loading={me.loading} error={null} />
      {me.data?.status === "NONE" && (
        <form className="max-w-sm space-y-3" onSubmit={async (e) => { e.preventDefault(); setErr(""); try { await act("/creator/apply", "POST", { displayName: new FormData(e.currentTarget).get("displayName") }); me.reload(); } catch (x) { setErr(errMsg(x)); } }}>
          <p className="text-muted">Publish your own original or licensed comics. An admin reviews every application.</p>
          <input name="displayName" required minLength={2} maxLength={80} placeholder="Creator or studio name" className={input} aria-label="Creator name" />
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}<button className={btn}>Apply to become a creator</button>
        </form>)}
      {me.data && ["PENDING", "REJECTED", "SUSPENDED"].includes(me.data.status) && <p>Your creator application is <Badge v={me.data.status} />. {me.data.status === "PENDING" && "We'll notify you once it has been reviewed."}</p>}
      {approved && (<>
        <div className="mb-4 flex items-center justify-between"><p className="text-muted">Signed in as <span className="text-fg">{me.data!.displayName}</span></p><Link href="/creator/comics/new" className={btn}>Submit a comic</Link></div>
        <State loading={comics.loading} error={comics.error} />
        {comics.data && (comics.data.length === 0 ? <p className="text-muted">No comics yet. Submit your first one.</p> : (
          <table className={table}><thead><tr><th>Title</th><th>Status</th><th>Chapters</th><th /></tr></thead><tbody>{comics.data.map((c) => (
            <tr key={c.id}><td className="font-medium">{c.title}</td><td><Badge v={c.publishState} /></td><td>{c._count.chapters}</td><td className="text-right"><Link href={`/creator/comics/${c.id}`} className="text-primary">Manage chapters</Link></td></tr>))}</tbody></table>))}
        <p className="mt-6 text-sm text-muted">Analytics and revenue reports are not available yet.</p>
      </>)}
    </div>
  );
}
