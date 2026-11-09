"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, State, btn, btnDanger, btnGhost } from "./ui";
import { API } from "@/lib/api";
import { act, errMsg, useLoad } from "@/lib/useApi";

const OK = ["image/jpeg", "image/png", "image/webp", "image/avif"], MAX = 10 * 1024 * 1024;
const mimeFor = (file: File) => file.type || ({
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif",
} as Record<string, string>)[file.name.split(".").pop()?.toLowerCase() ?? ""] || "";
function putFile(url: string, file: File, contentType: string, onPct: (n: number) => void) {
  return new Promise<void>((res, rej) => {
    const x = new XMLHttpRequest(); x.open("PUT", url); x.setRequestHeader("Content-Type", contentType);
    x.upload.onprogress = (e) => e.lengthComputable && onPct(Math.round((e.loaded / e.total) * 100));
    x.onload = () => {
      if (x.status < 300) res();
      else if (x.status === 403) rej(new Error("Upload was denied. Check the storage bucket CORS rule and upload credentials."));
      else rej(new Error(`Upload failed (${x.status}).`));
    };
    x.onerror = () => rej(new Error("Network error during upload. Check the storage bucket's CORS settings."));
    x.send(file);
  });
}

export default function ChapterManager({ id, mode }: { id: string; mode: "admin" | "creator" }) {
  const base = mode === "admin" ? "/admin" : "/creator";
  const { data: ch, error, loading, reload } = useLoad<any>(`${base}/chapters/${id}`);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [prog, setProg] = useState<Record<string, number>>({});
  const run = async (fn: () => Promise<unknown>, ok = "") => { setErr(""); setMsg(""); setBusy(true); try { await fn(); setMsg(ok); reload(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); } };
  const [sched, setSched] = useState("");
  const locked = mode === "creator" && ch?.publishState === "PUBLISHED";

  const upload = (files: FileList | null) => files && run(async () => {
    const list = [...files].sort((a, b) =>
      (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, undefined, { numeric: true }),
    );
    for (const f of list) { if (!OK.includes(mimeFor(f))) throw new Error(`"${f.name}" is not a JPEG, PNG, WebP or AVIF image.`); if (f.size > MAX) throw new Error(`"${f.name}" is larger than 10 MB.`); }
    const items: { key: string; width: number; height: number }[] = [];
    for (const f of list) {
      const contentType = mimeFor(f);
      const { key, uploadUrl } = await act<{ key: string; uploadUrl: string }>(`${base}/uploads`, "POST", { chapterId: id, contentType, size: f.size });
      await putFile(uploadUrl, f, contentType, (n) => setProg((p) => ({ ...p, [f.name]: n })));
      const bm = await createImageBitmap(f).catch(() => null);
      items.push({ key, width: bm?.width ?? 1000, height: bm?.height ?? 1500 });
    }
    for (let i = 0; i < items.length; i += 100) await act(`${base}/chapters/${id}/images`, "POST", { items: items.slice(i, i + 100) });
    setProg({});
  }, "Pages uploaded.");

  const bulk = (file?: File) => file && run(async () => {
    if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("Choose a .zip archive. To upload an extracted folder, use the folder picker beside it.");
    if (file.size > 100 * 1024 * 1024) throw new Error("ZIP is larger than 100 MB.");
    if (file.size === 0) throw new Error("The selected ZIP file is empty.");
    const fd = new FormData(); fd.append("file", file, file.name);
    const r = await fetch(`${API}/admin/chapters/${id}/bulk`, { method: "POST", body: fd, credentials: "include" });
    const b = await r.json().catch(() => null);
    if (!r.ok) {
      const message = b?.error?.message ?? b?.message ?? `ZIP import failed (HTTP ${r.status}).`;
      const details = Array.isArray(b?.error?.details) ? ` ${b.error.details.join("; ")}` : "";
      throw new Error(`${message}${details}`);
    }
    if (!b || typeof b.added !== "number") throw new Error("The server response was unexpected. Check the API server logs.");
    setMsg(`ZIP imported: ${b.added} page${b.added === 1 ? "" : "s"} added.`);
  }, "ZIP imported. Review the pages below, then publish.");

  const move = (i: number, d: number) => run(async () => {
    const ids = ch.images.map((x: any) => x.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    await act(`${base}/chapters/${id}/images/order`, "PUT", { ids });
  });

  return (
    <div>
      <State loading={loading} error={error} />
      {ch && (<>
        <p className="text-sm text-muted"><Link href={mode === "admin" ? `/admin/chapters?comicId=${ch.comic.id}` : `/creator/comics/${ch.comic.id}`} className="hover:text-fg">← {ch.comic.title}</Link></p>
        <div className="my-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Chapter {ch.number}: {ch.title}</h1><Badge v={ch.publishState} />
          {mode === "admin" ? (ch.publishState === "PUBLISHED"
            ? <button disabled={busy} className={btnGhost} onClick={() => run(() => act(`/admin/chapters/${id}`, "PUT", { publishState: "UNPUBLISHED" }), "Chapter unpublished.")}>Unpublish</button>
            : <button disabled={busy || ch.images.length === 0} className={btn} onClick={() => confirm(`Publish chapter ${ch.number}? It becomes visible to all readers.`) && run(() => act(`/admin/chapters/${id}`, "PUT", { publishState: "PUBLISHED" }), "Chapter published.")}>Publish chapter</button>)
            : ch.publishState === "PENDING" ? <span className="text-sm text-muted">Waiting for admin review</span>
            : ch.publishState === "PUBLISHED" ? <span className="text-sm text-muted">Live. Contact an admin to change it.</span>
            : <button disabled={busy || ch.images.length === 0} className={btn} onClick={() => confirm("Submit this chapter for admin review?") && run(() => act(`/creator/chapters/${id}/submit`, "PUT"), "Submitted for review.")}>Submit for review</button>}
        </div>
        {mode === "admin" && ch.publishState !== "PUBLISHED" && (
          <div className="my-2 flex flex-wrap items-end gap-2 text-sm">
            <label>Publish automatically at <input type="datetime-local" value={sched} onChange={(e) => setSched(e.target.value)} className="mt-1 block rounded-md border border-line bg-surface px-2 py-1" /></label>
            <button disabled={busy || !sched || ch.images.length === 0} className={btnGhost} onClick={() => run(() => act(`/admin/chapters/${id}`, "PUT", { scheduledAt: new Date(sched).toISOString() }), "Scheduled.")}>Schedule</button>
            {ch.scheduledAt && <><span className="text-muted">Scheduled for {new Date(ch.scheduledAt).toLocaleString("en-IN")}</span><button disabled={busy} className={btnGhost} onClick={() => run(() => act(`/admin/chapters/${id}`, "PUT", { scheduledAt: null }), "Schedule cleared.")}>Clear</button></>}
          </div>
        )}
        {!locked && (
          <div className="my-4 flex flex-wrap gap-4 rounded-lg border border-line bg-card p-4 text-sm">
            <label className="min-w-0 flex-1">Add chapter pages (select one or many images) <input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={(e) => { const files = e.currentTarget.files; if (!files?.length) return; upload(files); e.currentTarget.value = ""; }} className="mt-2 block w-full rounded-lg border border-line bg-surface p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:font-semibold file:text-white" /></label>
            {mode === "admin" && <>
              <label className="min-w-0 flex-1">Import ZIP (max 100 MB) <input type="file" accept=".zip,application/zip,application/x-zip-compressed" disabled={busy} onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) bulk(f); e.currentTarget.value = ""; }} className="mt-2 block w-full rounded-lg border border-line bg-surface p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:font-semibold file:text-white" /></label>
              <label className="min-w-0 flex-1">Or choose an extracted chapter folder <input type="file" multiple disabled={busy} {...({ webkitdirectory: "", directory: "" } as any)} onChange={(e) => { const files = e.currentTarget.files; if (files?.length) upload(files); e.currentTarget.value = ""; }} className="mt-2 block w-full rounded-lg border border-line bg-surface p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:font-semibold file:text-white" /></label>
            </>}
          </div>
        )}
        {Object.entries(prog).map(([n, p]) => <p key={n} className="text-sm text-muted">{n}: {p}%</p>)}
        {busy && <p role="status" className="text-sm text-muted">Uploading or processing files… keep this page open until complete.</p>}
        {msg && <p role="status" className="text-sm text-success">{msg}</p>}{err && <p role="alert" className="text-sm text-danger">{err}</p>}
        {ch.images.length === 0 ? <p className="text-muted">No pages yet. Files are ordered by name (page2 before page10).</p> : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">{ch.images.map((im: any, i: number) => (
            <li key={im.id} className="rounded-lg border border-line bg-card p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt={`Page ${i + 1}`} loading="lazy" className="aspect-[2/3] w-full rounded object-cover" />
              {!locked && <div className="mt-2 flex items-center justify-between text-xs"><span>Page {i + 1}</span>
                <span className="flex gap-1">
                  <button aria-label="Move earlier" disabled={busy || i === 0} onClick={() => move(i, -1)} className={btnGhost}>↑</button>
                  <button aria-label="Move later" disabled={busy || i === ch.images.length - 1} onClick={() => move(i, 1)} className={btnGhost}>↓</button>
                  <button aria-label="Delete page" disabled={busy} onClick={() => confirm(`Delete page ${i + 1}?`) && run(() => act(`${base}/chapters/${id}/images/${im.id}`, "DELETE"))} className={btnDanger}>✕</button>
                </span></div>}</li>))}</ul>)}
      </>)}
    </div>
  );
}
