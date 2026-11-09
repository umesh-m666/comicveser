"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn, btnGhost, input } from "./ui";
import { act, errMsg, useLoad } from "@/lib/useApi";


const TYPES = ["MANGA", "MANHWA", "MANHUA", "WEBTOON"], STATUS = ["ONGOING", "COMPLETED", "HIATUS"], STATES = ["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"];
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block text-sm"><span className="mb-1 block text-muted">{label}</span>{children}</label>;

export default function ComicForm({ initial, mode = "admin" }: { initial?: any; mode?: "admin" | "creator" }) {
  const router = useRouter(); const genres = useLoad<{ slug: string; name: string }[]>("/genres");
  const d = initial ?? {};
  const [picked, setPicked] = useState<string[]>(initial?.genreSlugs ?? []); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
    const body = { title: f.title, altTitle: f.altTitle || undefined, description: f.description, author: f.author, artist: f.artist, type: f.type, status: f.status,
      ...(mode === "admin" ? { publishState: f.publishState } : { licenseHolder: f.licenseHolder, licenseType: f.licenseType, territory: f.territory || undefined }), releaseYear: Number(f.releaseYear), genreSlugs: picked };
    if (mode === "creator") { await act("/creator/comics", "POST", body); router.push("/creator/dashboard"); } else { await (initial ? act(`/admin/comics/${initial.id}`, "PUT", body) : act("/admin/comics", "POST", body)); router.push("/admin/comics"); } router.refresh(); }
    catch (x) { setErr(errMsg(x)); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="max-w-2xl space-y-3">
      <Field label="Title"><input name="title" required defaultValue={d.title} className={input} /></Field>
      <Field label="Alternative title"><input name="altTitle" defaultValue={d.altTitle ?? ""} className={input} /></Field>
      <Field label="Description"><textarea name="description" required rows={4} defaultValue={d.description} className={input} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Author"><input name="author" required defaultValue={d.author} className={input} /></Field>
        <Field label="Artist"><input name="artist" required defaultValue={d.artist} className={input} /></Field>
        <Field label="Type"><select name="type" defaultValue={d.type ?? "MANHWA"} className={input}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Status"><select name="status" defaultValue={d.status ?? "ONGOING"} className={input}>{STATUS.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Release year"><input name="releaseYear" type="number" min={1900} max={2100} required defaultValue={d.releaseYear ?? new Date().getFullYear()} className={input} /></Field>
        {mode === "admin" && (<Field label="Visibility"><select name="publishState" defaultValue={d.publishState ?? "DRAFT"} className={input}>{STATES.map((t) => <option key={t}>{t}</option>)}</select></Field>)}
      </div>
      <fieldset><legend className="mb-1 text-sm text-muted">Genres (up to 10)</legend>
        <div className="flex flex-wrap gap-2">{genres.data?.map((g) => (
          <label key={g.slug} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${picked.includes(g.slug) ? "border-primary text-primary" : "border-line"}`}>
            <input type="checkbox" className="sr-only" checked={picked.includes(g.slug)} onChange={() => setPicked((p) => (p.includes(g.slug) ? p.filter((x) => x !== g.slug) : [...p, g.slug]))} />{g.name}</label>))}</div>
      </fieldset>
      {mode === "creator" && (
        <fieldset className="space-y-3 rounded-lg border border-line p-3"><legend className="px-1 text-sm text-muted">Publication rights (required)</legend>
          <Field label="Rights holder"><input name="licenseHolder" required className={input} /></Field>
          <Field label="License type (e.g. original work, licensed)"><input name="licenseType" required className={input} /></Field>
          <Field label="Territory (optional)"><input name="territory" className={input} /></Field>
          <p className="text-xs text-muted">Your comic is reviewed by an admin before it goes live. Only submit work you own or are licensed to distribute.</p>
        </fieldset>)}
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <div className="flex gap-2"><button disabled={busy} className={btn}>{busy ? "Saving..." : initial ? "Save changes" : "Create comic"}</button><button type="button" onClick={() => router.back()} className={btnGhost}>Cancel</button></div>
    </form>
  );
}
