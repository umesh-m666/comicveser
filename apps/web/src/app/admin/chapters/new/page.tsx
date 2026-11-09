"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn, btnGhost, input } from "@/components/admin/ui";
import { act, errMsg, useLoad } from "@/lib/useApi";

export default function NewChapter({ searchParams }: { searchParams: { comicId?: string } }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const comics = useLoad<{ items: { id: string; title: string }[] }>("/admin/comics");
  const comicId = searchParams.comicId ?? "";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const ch = await act<{ id: string }>("/admin/chapters", "POST", { comicId, number: Number(f.get("number")), title: String(f.get("title")), publishState: "DRAFT" });
      router.push(`/admin/chapters/${ch.id}`);
    } catch (x) { setErr(errMsg(x)); setBusy(false); }
  }

  return (
    <div className="max-w-md space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Add chapter</h1>
        {comicId && <Link href="/admin/chapters" className={btnGhost}>Back to list</Link>}
      </div>
      {!comicId && (
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="mb-3 text-sm text-muted">Choose which comic this chapter belongs to before adding it.</p>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Comic</span>
            <select className={input} defaultValue="" onChange={(e) => router.push(e.target.value ? `/admin/chapters/new?comicId=${e.target.value}` : "/admin/chapters/new")}>
              <option value="">Select a comic</option>
              {comics.data?.items.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
        </div>
      )}
      {comicId && (
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm"><span className="mb-1 block text-muted">Comic</span><input value={comics.data?.items.find((c) => c.id === comicId)?.title ?? comicId} readOnly className={input} /></label>
          <label className="block text-sm"><span className="mb-1 block text-muted">Chapter number</span><input name="number" type="number" step="0.5" min={0} required className={input} /></label>
          <label className="block text-sm"><span className="mb-1 block text-muted">Title</span><input name="title" required maxLength={200} className={input} /></label>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <button disabled={busy} className={btn}>{busy ? "Creating..." : "Create draft and add pages"}</button>
        </form>
      )}
    </div>
  );
}
