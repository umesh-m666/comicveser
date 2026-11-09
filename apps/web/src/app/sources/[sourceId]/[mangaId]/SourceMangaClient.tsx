"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bookmark, ExternalLink } from "lucide-react";
import { Cover } from "@/components/ComicCard";
import { State } from "@/components/admin/ui";
import { ApiError, api } from "@/lib/api";
import { AlternativeSourceMatch, ExtChapter, LANGUAGES, MangaDetails, Paged, SourceInfo, cap, hueOf, media } from "@/lib/sources";
import { useLoad } from "@/lib/useApi";

function SaveButton({ sourceId, mangaId }: { sourceId: string; mangaId: string }) {
  const router = useRouter();
  const [st, setSt] = useState<"loading" | "anon" | "on" | "off">("loading"); const [err, setErr] = useState("");
  useEffect(() => { api<{ saved: boolean }>(`/user/external-library/${sourceId}/${mangaId}`, { credentials: "include" }).then((r) => setSt(r.saved ? "on" : "off")).catch((e) => setSt(e instanceof ApiError && e.status === 401 ? "anon" : "off")); }, [sourceId, mangaId]);
  async function toggle() {
    if (st === "anon") return router.push("/login");
    if (st === "loading") return;
    const next = st === "on" ? "off" : "on"; setErr(""); setSt(next);
    try { if (next === "on") await api("/user/external-library", { method: "POST", json: { sourceId, externalId: mangaId }, credentials: "include" }); else await api(`/user/external-library/${sourceId}/${mangaId}`, { method: "DELETE", credentials: "include" }); }
    catch (e) { setSt(st); setErr(e instanceof ApiError ? e.message : "Couldn't update your library."); }
  }
  return <span><button onClick={toggle} aria-pressed={st === "on"} className="flex items-center gap-2 rounded-md border border-line px-4 py-2.5 font-semibold hover:bg-card"><Bookmark size={18} className={st === "on" ? "fill-primary text-primary" : ""} aria-hidden />{st === "on" ? "Saved" : st === "anon" ? "Log in to save" : "Save to library"}</button>{err && <span role="alert" className="ml-2 text-sm text-danger">{err}</span>}</span>;
}

export default function ExternalManga({ params }: { params: { sourceId: string; mangaId: string } }) {
  const { sourceId, mangaId } = params;
  const d = useLoad<MangaDetails>(`/sources/${sourceId}/manga/${mangaId}`);
  const src = useLoad<SourceInfo>(`/sources/${sourceId}`);
  const [lang, setLang] = useState(""); const [page, setPage] = useState(1);
  const [chapters, setChapters] = useState<ExtChapter[]>([]); const [more, setMore] = useState(false); const [chState, setChState] = useState<"loading" | "error" | "done">("loading"); const [chErr, setChErr] = useState("");
  const [retry, setRetry] = useState(0);
  const [resume, setResume] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<AlternativeSourceMatch[]>([]);
  const [altLoading, setAltLoading] = useState(false);

  useEffect(() => { if (d.data && !lang) setLang(d.data.availableLanguages.includes("en") || !d.data.availableLanguages.length ? "en" : d.data.availableLanguages[0]); }, [d.data, lang]);
  useEffect(() => { setChapters([]); setPage(1); setMore(false); setChErr(""); setChState("loading"); }, [lang]);
  useEffect(() => {
    if (!lang) return; let live = true; setChState("loading"); setChErr("");
    api<Paged<ExtChapter>>(`/sources/${sourceId}/manga/${mangaId}/chapters?language=${encodeURIComponent(lang)}&page=${page}&limit=100`, { cache: "no-store" })
      .then((r) => { if (!live) return; setChapters((c) => (page === 1 ? r.items : [...c, ...r.items])); setMore(r.hasMore); setChState("done"); })
      .catch((e) => { if (live) { setChErr(e instanceof ApiError ? e.message : "Couldn't load chapters."); setChState("error"); } });
    return () => { live = false; };
  }, [sourceId, mangaId, lang, page, retry]);
  useEffect(() => { try { const p = JSON.parse(localStorage.getItem(`cv:progress:ext:${sourceId}:${mangaId}`) ?? "null"); if (p?.chapterId) setResume(p.chapterId); } catch {} }, [sourceId, mangaId]);

  // Search WeebCentral and Asura Scans for the same title when viewing ComicK or when ComicK chapters are unavailable.
  useEffect(() => {
    if (!lang) return;
    if (sourceId !== "comick" && chState !== "error" && !(chState === "done" && chapters.length === 0)) return;
    let live = true;
    setAltLoading(true);
    api<{ alternatives: AlternativeSourceMatch[] }>(`/sources/${sourceId}/manga/${encodeURIComponent(mangaId)}/alternatives?language=${encodeURIComponent(lang)}`, { cache: "no-store" })
      .then((res) => { if (live) setAlternatives(res.alternatives ?? []); })
      .catch(() => { if (live) setAlternatives([]); })
      .finally(() => { if (live) setAltLoading(false); });
    return () => { live = false; };
  }, [sourceId, mangaId, lang, chState, chapters.length]);

  const readHref = (id: string) => `/sources/${sourceId}/${mangaId}/read/${id}?lang=${encodeURIComponent(lang)}`;
  const m = d.data; const first = chapters[0];
  const firstAltChapter = alternatives[0]?.chapters[0];

  return (
    <article>
      <State loading={d.loading} error={d.error} />
      {m && (<>
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <Cover hue={hueOf(m.externalId)} title={m.title} src={media(m.coverUrl)} className="mx-auto aspect-[2/3] w-48 md:w-full" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">External source · {src.data?.displayName ?? m.sourceId}</p>
            <h1 className="text-3xl font-extrabold tracking-tight">{m.title}</h1>
            {m.alternativeTitles.length > 0 && <p className="text-sm text-muted">{m.alternativeTitles.slice(0, 3).join(" · ")}</p>}
            <p className="mt-2 text-sm text-muted">{cap(m.contentType)}{m.status ? ` · ${cap(m.status)}` : ""}{m.year ? ` · ${m.year}` : ""}</p>
            {(m.authors.length > 0 || m.artists.length > 0) && <p className="text-sm text-muted">{m.authors.length > 0 && <>Author: {m.authors.join(", ")}</>}{m.authors.length > 0 && m.artists.length > 0 && " · "}{m.artists.length > 0 && <>Artist: {m.artists.join(", ")}</>}</p>}
            {m.genres.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{m.genres.map((g) => <span key={g} className="rounded-full border border-line px-3 py-1 text-xs">{g}</span>)}</div>}
            {m.description && <p className="mt-4 max-w-prose whitespace-pre-line text-muted">{m.description}</p>}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {first ? (
                <Link href={readHref(first.id)} className="rounded-md bg-primary px-5 py-2.5 font-semibold text-white">Read Chapter {first.numberLabel ?? ""}</Link>
              ) : firstAltChapter ? (
                <Link href={firstAltChapter.readerUrl} className="rounded-md bg-primary px-5 py-2.5 font-semibold text-white">
                  Read Chapter {firstAltChapter.numberLabel ?? ""} ({alternatives[0].sourceName})
                </Link>
              ) : (
                <button disabled className="rounded-md bg-primary px-5 py-2.5 font-semibold text-white opacity-50">Read Chapter</button>
              )}
              {resume && <Link href={readHref(resume)} className="rounded-md bg-secondary px-5 py-2.5 font-semibold text-white">Continue reading</Link>}
              <SaveButton sourceId={sourceId} mangaId={mangaId} />
              <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md border border-line px-4 py-2.5 font-semibold hover:bg-card"><ExternalLink size={16} aria-hidden />Open on {src.data?.displayName ?? "source"}</a>
            </div>
            {src.data && <p className="mt-4 max-w-prose text-xs text-muted">{src.data.attribution}</p>}
          </div>
        </div>

        <section className="mt-10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">Chapters</h2>
            <label className="text-sm"><span className="mr-2 text-muted">Language</span>
              <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-md border border-line bg-surface px-2 py-1.5">{(m.availableLanguages.length ? m.availableLanguages.map((l) => [l, LANGUAGES.find(([v]) => v === l)?.[1] ?? l] as [string, string]) : LANGUAGES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label></div>
          {chState === "error" && (
            <div role="alert" className="rounded-lg border border-line bg-card p-4 text-sm text-danger">
              <p>{chErr}</p>
              <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-2 rounded-md border border-line px-3 py-1.5 hover:bg-surface">Retry</button>
            </div>
          )}
          {chState === "done" && chapters.length === 0 && <p className="rounded-lg border border-line bg-card p-4 text-muted">No readable chapters in this language on {src.data?.displayName ?? sourceId}.</p>}
          {chState === "loading" && chapters.length === 0 && <div className="skeleton h-32" aria-busy="true" />}
          {chapters.length > 0 && (
            <ul className="divide-y divide-line rounded-lg border border-line bg-card">{chapters.map((c) => (
              <li key={c.id}><Link href={readHref(c.id)} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface">
                <span className="font-medium">{c.numberLabel ? `Chapter ${c.numberLabel}` : "Special"}{c.title ? `: ${c.title}` : ""}{c.duplicateNumber && <span className="ml-2 text-xs text-muted">(alternate release)</span>}</span>
                <span className="text-xs text-muted">{c.groups.join(", ") || "Unknown group"}{c.publishedAt ? ` · ${new Date(c.publishedAt).toLocaleDateString("en-IN")}` : ""}</span></Link></li>))}</ul>)}
          {more && <button disabled={chState === "loading"} onClick={() => setPage((p) => p + 1)} className="mt-4 rounded-md border border-line px-4 py-2 text-sm hover:bg-card disabled:opacity-50">Load more chapters</button>}
        </section>

        {(altLoading || alternatives.length > 0) && (
          <section className="mt-10 rounded-xl border border-line bg-card p-5">
            <h2 className="text-lg font-bold">Alternative chapter sources (WeebCentral &amp; Asura Scans)</h2>
            <p className="mt-1 text-sm text-muted">
              Chapters below use each alternative provider&apos;s own manga ID, chapter ID, and reader URL.
            </p>
            {altLoading && alternatives.length === 0 && (
              <p className="mt-4 text-sm text-muted" aria-busy="true">Searching WeebCentral and Asura Scans for matching chapters…</p>
            )}
            {alternatives.map((alt) => (
              <div key={`${alt.sourceId}:${alt.externalId}`} className="mt-4 rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">{alt.sourceName} · ID: {alt.externalId}</p>
                    <h3 className="text-base font-bold">{alt.title}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Link href={alt.catalogUrl} className="rounded-md bg-primary px-3 py-1.5 font-semibold text-white">
                      Open {alt.sourceName} catalogue ({alt.totalChapters} chapters)
                    </Link>
                    <a href={alt.sourceUrl} target="_blank" rel="noopener noreferrer" className="rounded-md border border-line px-3 py-1.5 font-semibold hover:bg-card">
                      Open on {alt.sourceName} ↗
                    </a>
                  </div>
                </div>
                <ul className="mt-3 max-h-72 divide-y divide-line overflow-y-auto rounded-md border border-line bg-card">
                  {alt.chapters.slice(0, 50).map((ch) => (
                    <li key={`${alt.sourceId}:${ch.id}`}>
                      <Link href={ch.readerUrl} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-surface">
                        <span className="font-medium">
                          {ch.numberLabel ? `Chapter ${ch.numberLabel}` : "Special"}{ch.title ? `: ${ch.title}` : ""}
                        </span>
                        <span className="text-xs text-muted">
                          {alt.sourceName} · ID: {ch.id}{ch.publishedAt ? ` · ${new Date(ch.publishedAt).toLocaleDateString("en-IN")}` : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}
      </>)}
    </article>
  );
}