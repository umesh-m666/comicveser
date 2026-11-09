"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize } from "lucide-react";
import { API } from "@/lib/api";
import { track } from "@/lib/analytics";
import type { AlternativeSourceMatch } from "@/lib/sources";

export interface Img { id: string; position: number; width: number; height: number; url: string }
export interface ImgPage { total: number; items: Img[] }
interface Nb { id: string; number: number; displayNumber?: string; label?: string }
export interface ChapterMeta {
  id: string; number: number; displayNumber?: string; title: string; comic: { id: string; slug: string; title: string };
  imageCount: number; prev: Nb | null; next: Nb | null;
  external?: { sourceId: string; mangaId: string; chapterId: string; sourceUrl: string; groups: string[]; readerUrl?: string };
  alternatives?: AlternativeSourceMatch[];
}

const BATCH = 10;
const WIDTHS = { narrow: "720px", wide: "1000px", full: "100%" } as const;
const ZOOMS = [1, 1.25, 1.5, 2];
type Width = keyof typeof WIDTHS;
type Mode = "vertical" | "paged" | "rtl";
const store = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

function Page({ img, idx, paged, zoom }: { img: Img; idx: number; paged: boolean; zoom: number }) {
  const [tries, setTries] = useState(0); const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const failed = (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm">
      <p>Page {idx + 1} failed to load.</p>
      <button onClick={() => { setStatus("loading"); setTries((t) => t + 1); }} className="rounded-md bg-primary px-3 py-1.5 font-semibold">Retry</button>
      <p className="text-muted">Still failing? Reload the chapter.</p>
    </div>
  );
  const el = status === "error" ? null : (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={tries} src={img.url} alt={`Page ${idx + 1}`} width={img.width || undefined} height={img.height || undefined} referrerPolicy="no-referrer" decoding="async" loading={paged || idx < 2 ? "eager" : "lazy"}
      className={paged ? `${status === "ok" ? "" : "hidden "}${zoom === 1 ? "mx-auto block max-h-[calc(100vh-7rem)] w-auto max-w-full" : "block max-w-none"}` : "block h-auto w-full"}
      style={paged && zoom !== 1 ? { width: `${zoom * 100}%` } : undefined} onLoad={() => setStatus("ok")}
      onError={() => { if (tries < 2) setTimeout(() => setTries((t) => t + 1), 1000 * (tries + 1)); else setStatus("error"); }} />
  );
  if (paged) return <div data-idx={idx}>{status === "loading" && <div className="skeleton h-[60vh] w-full" />}{status === "error" ? failed : el}</div>;
  return (
    <div data-idx={idx} style={img.width > 0 ? { aspectRatio: `${img.width} / ${img.height}` } : { minHeight: "40vh" }} className="relative w-full bg-card">
      {status === "loading" && <div className="skeleton absolute inset-0" />}
      {status === "error" ? <div className="absolute inset-0">{failed}</div> : el}
    </div>
  );
}

export default function Reader({ slug, meta, initial, chapters, external }: { slug: string; meta: ChapterMeta; initial: Img[]; chapters: Nb[]; external?: { basePath: string; query?: string } }) {
  const router = useRouter();
  const [images, setImages] = useState(initial); const imagesRef = useRef(initial);
  const [width, setWidth] = useState<Width>("narrow"); const [mode, setMode] = useState<Mode>("vertical"); const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(0); const [loadError, setLoadError] = useState(false);
  const busy = useRef(false); const restored = useRef(false); const authed = useRef<boolean | null>(null); const modeRef = useRef<Mode>("vertical");
  const sentinel = useRef<HTMLDivElement>(null); const timer = useRef<ReturnType<typeof setTimeout>>(); const touchX = useRef<number | null>(null);
  const done = images.length >= meta.imageCount; const paged = mode !== "vertical"; const rtl = mode === "rtl";
  const localKey = `cv:progress:${meta.comic.id}`;
  
const back = external
  ? external.basePath
  : `/comics/${slug}`;

const chHref = (id: string) => {
  if (external) {
    return `${external.basePath}/read/${encodeURIComponent(id)}${external.query ?? ""}`;
  }

  return `/comics/${slug}/chapter/${encodeURIComponent(id)}`;
};

const go = (id: string) => {
  if (!id) return;
  router.push(chHref(id));
};

  
const loadMore = useCallback(async () => {
  // External pages are supplied by the source reader route.
  // Never request external chapters from the local ComicVerse API.
  if (external) return;

  if (
    busy.current ||
    imagesRef.current.length >= meta.imageCount
  ) {
    return;
  }

  busy.current = true;
  setLoadError(false);

  try {
    const r = await fetch(
      `${API}/chapters/${meta.id}/images?from=${imagesRef.current.length}&limit=${BATCH}`
    );

    if (!r.ok) {
      throw new Error("Could not load chapter images");
    }

    const d: ImgPage = await r.json();

    imagesRef.current = [
      ...imagesRef.current,
      ...d.items,
    ];

    setImages(imagesRef.current);
  } catch {
    setLoadError(true);
  } finally {
    busy.current = false;
  }
}, [meta.id, meta.imageCount, external]);


  // Saved reading preferences.
  useEffect(() => {
    try {
      const w = localStorage.getItem("cv:reader:width") as Width; if (w in WIDTHS) setWidth(w);
      const m = localStorage.getItem("cv:reader:mode"); if (m === "paged" || m === "rtl") { setMode(m); modeRef.current = m; }
      const z = Number(localStorage.getItem("cv:reader:zoom")); if (ZOOMS.includes(z)) setZoom(z);
    } catch {}
  }, []);

  // Vertical: load the next batch when the reader nears the end of what is rendered.
  useEffect(() => {
    if (done || paged || !sentinel.current) return;
    const o = new IntersectionObserver((e) => e[0].isIntersecting && loadMore(), { rootMargin: "1500px 0px" });
    o.observe(sentinel.current); return () => o.disconnect();
  }, [done, paged, images.length, loadMore]);

  // Paged: keep a few pages loaded ahead, and warm the browser cache for the next two.
  useEffect(() => { if (paged && current + 3 >= images.length) loadMore(); }, [paged, current, images.length, loadMore]);
  useEffect(() => { if (!paged) return; [current + 1, current + 2].forEach((i) => { const im = images[i]; if (im) new Image().src = im.url; }); }, [paged, current, images]);

  // Vertical: current page = the image crossing the middle of the viewport.
  useEffect(() => {
    if (paged) return;
    const o = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setCurrent(Number((e.target as HTMLElement).dataset.idx))), { rootMargin: "-50% 0px -49% 0px" });
    document.querySelectorAll("[data-idx]").forEach((el) => o.observe(el)); return () => o.disconnect();
  }, [images.length, paged]);

  // Keep your place when switching modes.
  const firstMode = useRef(true);
  useEffect(() => {
    if (firstMode.current) { firstMode.current = false; return; }
    if (mode === "vertical") setTimeout(() => document.querySelector(`[data-idx="${current}"]`)?.scrollIntoView(), 60); else window.scrollTo({ top: 0 });
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore saved position (server history when logged in, otherwise local), then allow saving.
  useEffect(() => {
    (async () => {
      let saved: { chapterId: string; imageIndex: number } | null = null;
      try {
        if (external) throw new Error("external chapters keep progress locally");
        const r = await fetch(`${API}/user/history`, { credentials: "include" });
        authed.current = r.ok;
        if (r.ok) { const h = (await r.json()).find((x: any) => x.comic.id === meta.comic.id); if (h) saved = { chapterId: h.chapter.id, imageIndex: h.imageIndex }; }
      } catch {}
      if (!saved) try { const l = JSON.parse(localStorage.getItem(localKey) ?? "null"); if (l) saved = l; } catch {}
      if (saved && saved.chapterId === meta.id && saved.imageIndex > 0) {
        while (imagesRef.current.length <= saved.imageIndex && imagesRef.current.length < meta.imageCount) {
          const before = imagesRef.current.length; await loadMore(); if (imagesRef.current.length === before) break;
        }
        if (modeRef.current === "vertical") setTimeout(() => document.querySelector(`[data-idx="${saved!.imageIndex}"]`)?.scrollIntoView(), 80);
        else setCurrent(Math.min(saved.imageIndex, imagesRef.current.length - 1));
      }
      restored.current = true;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced progress save: one request after the reader pauses, never one per scroll event.
  useEffect(() => {
    if (!restored.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const p = { comicId: meta.comic.id, chapterId: meta.id, imageIndex: current, scrollY: Math.round(window.scrollY) };
      try { localStorage.setItem(localKey, JSON.stringify(p)); } catch {}
      if (authed.current === false || external) return;
      try { const r = await fetch(`${API}/user/progress`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }); if (r.status === 401) authed.current = false; } catch {}
    }, 2000);
    return () => clearTimeout(timer.current);
  }, [current, meta.comic.id, meta.id, localKey]);

  const sess = useRef(false);
  useEffect(() => { if (current >= 1 && !sess.current && !external) { sess.current = true; track({ type: "READ_SESSION", comicId: meta.comic.id, chapterId: meta.id }); } }, [current, meta.comic.id, meta.id]);

  // dir: 1 = forward in reading order, -1 = back. Running off either end moves to the neighbouring chapter.
  const step = (dir: 1 | -1) => {
    if (dir === 1) {
      if (current + 1 < meta.imageCount) { if (current + 1 < images.length) setCurrent(current + 1); else loadMore(); }
      else if (meta.next) go(meta.next.id);
    } else if (current > 0) setCurrent(current - 1);
    else if (meta.prev) go(meta.prev.id);
  };
  useEffect(() => {
    if (!paged) return;
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") step(rtl ? -1 : 1); else if (e.key === "ArrowLeft") step(rtl ? 1 : -1);
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  const pct = meta.imageCount ? Math.round(((current + 1) / meta.imageCount) * 100) : 0;
  const nav = "rounded-md border border-line p-2 hover:bg-card aria-disabled:pointer-events-none aria-disabled:opacity-40";
  const sel = "rounded-md border border-line bg-bg px-2 py-1.5";
  const lastPage = current >= meta.imageCount - 1;

  return (
    <div className="-mx-4 -my-6">
      {meta.external && <div className="mx-auto max-w-4xl border-b border-line bg-card px-4 py-2 text-xs text-muted">
        External chapter from <span className="font-semibold text-fg">{meta.external.sourceId}</span> (ID: {meta.external.chapterId})
        {meta.external.groups.length ? ` · Group: ${meta.external.groups.join(", ")}` : ""}
        {" · "}<a href={meta.external.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">Open at source</a>
        {meta.external.readerUrl && !external && (
          <>{" · "}<Link href={meta.external.readerUrl} className="text-primary underline">Open {meta.external.sourceId} reader</Link></>
        )}
      </div>}
      <div className="sticky top-14 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 px-3 py-2 text-sm">
          <Link href={back} className={nav} aria-label="Back to comic"><ArrowLeft size={18} /></Link>
          <span className="min-w-0 flex-1 truncate font-medium">{meta.comic.title} · Ch. {meta.displayNumber ?? meta.number}</span>
          <span className="text-muted">Page {Math.min(current + 1, meta.imageCount)} / {meta.imageCount}</span>
          <Link href={meta.prev ? chHref(meta.prev.id) : "#"} aria-disabled={!meta.prev} className={nav} aria-label="Previous chapter"><ChevronLeft size={18} /></Link>
          <select aria-label="Chapter" value={meta.id} onChange={(e) => go(e.target.value)} className={sel}>{chapters.map((c) => <option key={c.id} value={c.id}>{c.label ?? `Chapter ${c.displayNumber ?? c.number}`}</option>)}</select>
          <Link href={meta.next ? chHref(meta.next.id) : "#"} aria-disabled={!meta.next} className={nav} aria-label="Next chapter"><ChevronRight size={18} /></Link>
          <select aria-label="Reading mode" value={mode} onChange={(e) => { const m = e.target.value as Mode; setMode(m); modeRef.current = m; store("cv:reader:mode", m); }} className={sel}>
            <option value="vertical">Vertical scroll</option><option value="paged">Paged</option><option value="rtl">Paged (right to left)</option></select>
          {!paged && <select aria-label="Page width" value={width} onChange={(e) => { const w = e.target.value as Width; setWidth(w); store("cv:reader:width", w); }} className={sel}>
            <option value="narrow">Narrow</option><option value="wide">Wide</option><option value="full">Fit to width</option></select>}
          <select aria-label="Zoom" value={zoom} onChange={(e) => { const z = Number(e.target.value); setZoom(z); store("cv:reader:zoom", String(z)); }} className={sel}>{ZOOMS.map((z) => <option key={z} value={z}>{z * 100}%</option>)}</select>
          <button className={nav} aria-label="Toggle fullscreen" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}><Maximize size={18} /></button>
        </div>
        <div className="h-0.5 bg-line"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
      </div>

      {meta.imageCount === 0 && (
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="text-base font-medium text-fg">
            {meta.external
              ? `${meta.external.sourceId} chapters are unavailable or do not host direct page images for this chapter.`
              : "This chapter has no pages yet."}
          </p>

          {meta.alternatives && meta.alternatives.length > 0 && (
            <div className="mt-6 rounded-xl border border-line bg-card p-5 text-left">
              <h3 className="text-sm font-bold uppercase tracking-wide text-primary">
                Alternative chapter sources (WeebCentral / Asura Scans)
              </h3>
              <p className="mt-1 text-xs text-muted">
                Read this title using the alternative provider&apos;s own chapter IDs and reader URLs:
              </p>
              <div className="mt-4 space-y-3">
                {meta.alternatives.map((alt) => (
                  <div key={`${alt.sourceId}:${alt.externalId}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3 text-sm">
                    <div>
                      <p className="font-semibold">{alt.title}</p>
                      <p className="text-xs text-muted">
                        {alt.sourceName} · ID: {alt.externalId} · {alt.totalChapters} chapters
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {alt.matchedChapter && (
                        <Link
                          href={alt.matchedChapter.readerUrl}
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Read Ch. {alt.matchedChapter.numberLabel ?? meta.displayNumber ?? meta.number} on {alt.sourceName}
                        </Link>
                      )}
                      <Link
                        href={alt.catalogUrl}
                        className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold hover:bg-card"
                      >
                        Browse {alt.sourceName} chapters
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm">
            {meta.external?.sourceUrl && (
              <a
                href={meta.external.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-primary px-4 py-2 font-semibold text-white"
              >
                Open chapter at source
              </a>
            )}
            <Link href={back} className="rounded-md border border-line px-4 py-2">
              Back to comic
            </Link>
          </div>
        </div>
      )}

      {paged && meta.imageCount > 0 && (
        <div className="mx-auto max-w-5xl select-none px-2 py-3"
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { if (touchX.current === null || zoom !== 1) return; const dx = e.changedTouches[0].clientX - touchX.current; touchX.current = null; if (Math.abs(dx) >= 50) step((rtl ? dx > 0 : dx < 0) ? 1 : -1); }}>
          {images[current] ? (
            <div className={zoom === 1 ? "cursor-pointer" : "overflow-auto"} style={zoom !== 1 ? { maxHeight: "calc(100vh - 7rem)" } : undefined}
              onClick={(e) => { if (zoom !== 1) return; const r = e.currentTarget.getBoundingClientRect(); const right = e.clientX - r.left > r.width / 2; step(rtl ? (right ? -1 : 1) : right ? 1 : -1); }}>
              <Page key={images[current].id} img={images[current]} idx={current} paged zoom={zoom} />
            </div>
          ) : <div className="skeleton h-[60vh] w-full" />}
          <div className={`mt-3 flex items-center justify-between gap-3 text-sm ${rtl ? "flex-row-reverse" : ""}`}>
            <button onClick={() => step(-1)} disabled={current === 0 && !meta.prev} className="rounded-md border border-line px-4 py-2 disabled:opacity-40">{current === 0 && meta.prev ? "Previous chapter" : "Previous page"}</button>
            <span className="text-muted">{rtl ? "Right to left" : "Tap or use arrow keys"}</span>
            <button onClick={() => step(1)} disabled={lastPage && !meta.next} className="rounded-md bg-primary px-4 py-2 font-semibold disabled:opacity-40">{lastPage && meta.next ? "Next chapter" : "Next page"}</button>
          </div>
          {loadError && <p className="mt-2 text-center text-sm">Couldn't load more pages. <button onClick={loadMore} className="text-primary">Retry</button></p>}
        </div>
      )}

      {!paged && (
        <div className="mx-auto" style={{ maxWidth: `calc(${WIDTHS[width]} * ${zoom})` }}>
          {images.map((img, i) => <Page key={img.id} img={img} idx={i} paged={false} zoom={1} />)}
          {!done && <div ref={sentinel} className="py-8 text-center text-sm text-muted">
            {loadError ? <>Couldn't load more pages. <button onClick={loadMore} className="text-primary">Retry</button></> : "Loading more pages..."}</div>}
          {done && meta.imageCount > 0 && (
            <div className="flex justify-between gap-3 px-4 py-10">
              {meta.prev ? <Link href={chHref(meta.prev.id)} className="rounded-md border border-line px-4 py-2">Previous chapter</Link> : <span />}
              {meta.next ? <Link href={chHref(meta.next.id)} className="rounded-md bg-primary px-4 py-2 font-semibold">Next chapter</Link> : <Link href={back} className="rounded-md bg-primary px-4 py-2 font-semibold">Back to comic</Link>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
