"use client";
import Link from "next/link";
import { ComicVerseMark } from "./ComicVerseLogo";
import { useEffect, useState } from "react";

interface Nb { id: string; number: number }
export interface NovelChapter { id: string; number: number; title: string; body: string; novel: { slug: string; title: string }; prev: Nb | null; next: Nb | null }
const WIDTHS = { narrow: "560px", medium: "720px", wide: "900px" } as const;
const KEY = "cv:novel:prefs";

export default function NovelReader({ ch }: { ch: NovelChapter }) {
  const [p, setP] = useState({ size: 18, line: 1.7, width: "medium" as keyof typeof WIDTHS, dark: true });
  useEffect(() => { try { const s = JSON.parse(localStorage.getItem(KEY) ?? "null"); if (s) setP((o) => ({ ...o, ...s })); } catch {} }, []);
  const set = (n: Partial<typeof p>) => setP((o) => { const v = { ...o, ...n }; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} return v; });
  const nav = (n: Nb | null, label: string) => n ? <Link href={`/novels/${ch.novel.slug}/chapter/${n.id}`} className="rounded-md border border-line px-4 py-2 text-sm">{label}</Link> : <span />;
  const sel = "rounded-md border border-line bg-surface px-2 py-1 text-sm text-fg";

  return (
    <div className="-mx-4 -my-6 min-h-screen px-4 py-6" style={{ background: p.dark ? "var(--bg)" : "#f6f1e7", color: p.dark ? "var(--fg)" : "#1c1b1a" }}>
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 pb-4 text-sm">
        <Link href="/" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#2F2250] p-1 border border-white/20" aria-label="ComicVerse Home" title="ComicVerse Home"><ComicVerseMark className="h-full w-full" /></Link>
        <Link href={`/novels/${ch.novel.slug}`} className="underline">← {ch.novel.title}</Link>
        <label>Size <input type="range" min={14} max={28} value={p.size} onChange={(e) => set({ size: +e.target.value })} aria-label="Font size" /></label>
        <label>Spacing <input type="range" min={1.3} max={2.2} step={0.1} value={p.line} onChange={(e) => set({ line: +e.target.value })} aria-label="Line spacing" /></label>
        <select aria-label="Reading width" value={p.width} onChange={(e) => set({ width: e.target.value as keyof typeof WIDTHS })} className={sel}><option value="narrow">Narrow</option><option value="medium">Medium</option><option value="wide">Wide</option></select>
        <button className={sel} onClick={() => set({ dark: !p.dark })}>{p.dark ? "Light mode" : "Dark mode"}</button>
      </div>
      <article className="mx-auto font-serif" style={{ maxWidth: WIDTHS[p.width], fontSize: p.size, lineHeight: p.line }}>
        <h1 className="mb-6 text-2xl font-bold">Chapter {ch.number}: {ch.title}</h1>
        {ch.body.split(/\n{2,}/).map((para, i) => <p key={i} className="mb-4 whitespace-pre-wrap">{para}</p>)}
      </article>
      <div className="mx-auto mt-8 flex max-w-3xl justify-between">{nav(ch.prev, "Previous chapter")}{nav(ch.next, "Next chapter")}</div>
    </div>
  );
}
