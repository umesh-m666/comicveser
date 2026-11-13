"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/api";
import { track } from "@/lib/analytics";
import { useReadChapters } from "@/lib/useReadChapters";
import type { AlternativeSourceMatch } from "@/lib/sources";
import ReaderControls, { ReaderMode as Mode, ReaderWidth as Width, Sheet } from "./ReaderControls";

export interface Img { id: string; position: number; width: number; height: number; url: string }
export interface ImgPage { total: number; items: Img[] }
interface Nb { id: string; number: number; displayNumber?: string; label?: string }
export interface ChapterMeta {
  id: string; number: number; displayNumber?: string; title: string; comic: { id: string; slug: string; title: string };
  imageCount: number; prev: Nb | null; next: Nb | null;
  external?: { sourceId: string; mangaId: string; chapterId: string; sourceUrl: string; groups: string[]; readerUrl?: string };
  alternatives?: AlternativeSourceMatch[];
}
export interface ReaderSource { name: string; url?: string; groups?: string[]; chapterId?: string; readerUrl?: string }

const BATCH = 10;
const HIDE_AFTER_MS = 4000;
/** A chapter only counts as finished after its last page has been reached AND it has been open at least this long. */
const MIN_READ_MS = 5000;
const WIDTHS: Record<Width, string> = { narrow: "760px", wide: "1000px", full: "100%" };
const ZOOMS = [1, 1.25, 1.5, 2];
const store = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

function Page({ img, idx, paged, zoom }: { img: Img; idx: number; paged: boolean; zoom: number }) {
  const [tries, setTries] = useState(0); const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const failed = (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-white">
      <p>Page {idx + 1} failed to load.</p>
      <button onClick={(e) => { e.stopPropagation(); setStatus("loading"); setTries((t) => t + 1); }} className="rounded-md bg-primary px-4 py-2 font-semibold">Retry</button>
    </div>
  );
  const el = status === "error" ? null : (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={tries} src={img.url} alt={`Page ${idx + 1}`} width={img.width || undefined} height={img.height || undefined} referrerPolicy="no-referrer" decoding="async" draggable={false}
      loading={paged || idx < 2 ? "eager" : "lazy"}
      className={paged ? `${status === "ok" ? "" : "hidden "}${zoom === 1 ? "mx-auto block max-h-[100dvh] w-auto max-w-full" : "block max-w-none"}` : "rd-img"}
      style={paged && zoom !== 1 ? { width: `${zoom * 100}%` } : undefined} onLoad={() => setStatus("ok")}
      onError={() => { if (tries < 2) setTimeout(() => setTries((t) => t + 1), 1000 * (tries + 1)); else setStatus("error"); }} />
  );
  if (paged) return <div data-idx={idx}>{status === "loading" && <div className="skeleton h-[60vh] w-full" />}{status === "error" ? failed : el}</div>;
  // Reserve the exact space (aspect ratio) so images never shift the layout while they load.
  return (
    <div data-idx={idx} style={img.width > 0 && img.height > 0 ? { aspectRatio: `${img.width} / ${img.height}` } : { minHeight: "40vh" }} className="relative w-full bg-[#0a0a0a]">
      {status === "loading" && <div className="skeleton absolute inset-0 !rounded-none" />}
      {status === "error" ? <div className="absolute inset-0">{failed}</div> : el}
    </div>
  );
}

export default function Reader({ slug, meta, initial, chapters, external, source }: { slug: string; meta: ChapterMeta; initial: Img[]; chapters: Nb[]; external?: { basePath: string; query?: string }; source?: ReaderSource }) {
  const router = useRouter();
  const [images, setImages] = useState(initial); const imagesRef = useRef(initial);
  const [width, setWidth] = useState<Width>("wide"); const [mode, setMode] = useState<Mode>("vertical"); const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(0); const [loadError, setLoadError] = useState(false);
  const busy = useRef(false); const restored = useRef(false); const authed = useRef<boolean | null>(null); const modeRef = useRef<Mode>("vertical");
  const endRef = useRef<HTMLDivElement>(null); const sentinel = useRef<HTMLDivElement>(null); const timer = useRef<ReturnType<typeof setTimeout>>(); const touchX = useRef<number | null>(null);
  const done = images.length >= meta.imageCount; const paged = mode !== "vertical"; const rtl = mode === "rtl";
  const localKey = `cv:progress:${meta.comic.id}`;

  // Controls overlay: hidden by default, toggled by tapping the artwork, auto-hidden after inactivity.
  const [visible, setVisible] = useState(false); const [sheet, setSheet] = useState<Sheet>(null);
  const [atEnd, setAtEnd] = useState(false); const [activity, setActivity] = useState(0);
  const [fullscreen, setFullscreen] = useState(false); const [fsSupported, setFsSupported] = useState(false);
  // Finished-chapter tracking (external-source chapters have no ComicVerse chapter row, so they opt out).
  const reads = useReadChapters(external ? null : meta.comic.id);
  const [finished, setFinished] = useState(false); const openedAt = useRef(Date.now());
  const isRead = finished || reads.isRead(meta.id);
  const pinned = meta.imageCount === 0; // an empty chapter has nothing to tap, so its controls stay available
  const shown = visible || pinned || atEnd;

  const back = external ? external.basePath : `/comics/${slug}`;
  const chHref = (id: string) => external ? `${external.basePath}/read/${encodeURIComponent(id)}${external.query ?? ""}` : `/comics/${slug}/chapter/${encodeURIComponent(id)}`;
  const go = (id: string) => { if (id) router.push(chHref(id)); };
  const src: ReaderSource | undefined = source ?? (meta.external ? { name: meta.external.sourceId, url: meta.external.sourceUrl, groups: meta.external.groups, chapterId: meta.external.chapterId, readerUrl: !external ? meta.external.readerUrl : undefined } : undefined);

  const loadMore = useCallback(async () => {
    // External pages are supplied by the source reader route; never request them from the local ComicVerse API.
    if (external) return;
    if (busy.current || imagesRef.current.length >= meta.imageCount) return;
    busy.current = true; setLoadError(false);
    try {
      const r = await fetch(`${API}/chapters/${meta.id}/images?from=${imagesRef.current.length}&limit=${BATCH}`);
      if (!r.ok) throw new Error("Could not load chapter images");
      const d: ImgPage = await r.json();
      imagesRef.current = [...imagesRef.current, ...d.items]; setImages(imagesRef.current);
    } catch { setLoadError(true); } finally { busy.current = false; }
  }, [meta.id, meta.imageCount, external]);

  // Saved reading preferences.
  useEffect(() => {
    try {
      const w = localStorage.getItem("cv:reader:width") as Width; if (w in WIDTHS) setWidth(w);
      const m = localStorage.getItem("cv:reader:mode"); if (m === "paged" || m === "rtl") { setMode(m); modeRef.current = m; }
      const z = Number(localStorage.getItem("cv:reader:zoom")); if (ZOOMS.includes(z)) setZoom(z);
    } catch {}
    setFsSupported(!!document.documentElement.requestFullscreen && document.fullscreenEnabled !== false);
    const fs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fs); return () => document.removeEventListener("fullscreenchange", fs);
  }, []);

  // Auto-hide the overlay after a pause; any interaction with it restarts the countdown.
  useEffect(() => {
    if (!visible || sheet || atEnd || pinned) return;
    const t = setTimeout(() => setVisible(false), HIDE_AFTER_MS);
    return () => clearTimeout(t);
  }, [visible, sheet, atEnd, pinned, activity]);

  // Scrolling the chapter dismisses the overlay so it never covers the artwork.
  useEffect(() => {
    let y = window.scrollY;
    const f = () => { if (Math.abs(window.scrollY - y) > 48) { y = window.scrollY; setVisible(false); } };
    window.addEventListener("scroll", f, { passive: true }); return () => window.removeEventListener("scroll", f);
  }, []);

  // Reaching the end of a chapter reveals the navigation so the next chapter is one tap away.
  useEffect(() => {
    if (paged || !done || !endRef.current) { setAtEnd(false); return; }
    const o = new IntersectionObserver(([e]) => {
      const hit = e.isIntersecting && window.scrollY > 100;
      setAtEnd(hit); if (hit) setVisible(true);
    }, { threshold: 0.1 });
    o.observe(endRef.current); return () => o.disconnect();
  }, [paged, done, images.length]);

  // Completion: the last page has been reached (scrolled to the end, or the final page in paged mode) and the chapter has
  // been open long enough that it can't be a skim-to-the-bottom. Opening a chapter never marks it read.
  const reachedEnd = !external && meta.imageCount > 0 && (paged ? current >= meta.imageCount - 1 && images.length >= meta.imageCount : atEnd);
  useEffect(() => {
    if (!reachedEnd || finished) return;
    const t = setTimeout(() => { setFinished(true); void reads.mark(meta.id); }, Math.max(0, MIN_READ_MS - (Date.now() - openedAt.current)));
    return () => clearTimeout(t);
  }, [reachedEnd, finished, meta.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [current, meta.comic.id, meta.id, localKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const sess = useRef(false);
  useEffect(() => { if (current >= 1 && !sess.current && !external) { sess.current = true; track({ type: "READ_SESSION", comicId: meta.comic.id, chapterId: meta.id }); } }, [current, meta.comic.id, meta.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // dir: 1 = forward in reading order, -1 = back. Running off either end moves to the neighbouring chapter.
  const step = (dir: 1 | -1) => {
    if (dir === 1) {
      if (current + 1 < meta.imageCount) { if (current + 1 < images.length) setCurrent(current + 1); else loadMore(); }
      else if (meta.next) go(meta.next.id);
    } else if (current > 0) setCurrent(current - 1);
    else if (meta.prev) go(meta.prev.id);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    const el = document.documentElement; if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };

  // Keyboard: ←/→ chapters (pages in paged mode), F full screen, Esc closes panels or returns to the comic.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (/INPUT|SELECT|TEXTAREA/.test(t.tagName) || t.isContentEditable)) return;
      if (e.key === "Escape") { if (sheet) setSheet(null); else if (!document.fullscreenElement) router.push(back); return; }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); toggleFullscreen(); return; }
      if (e.key === "ArrowRight") { if (paged) step(rtl ? -1 : 1); else if (meta.next) go(meta.next.id); }
      else if (e.key === "ArrowLeft") { if (paged) step(rtl ? 1 : -1); else if (meta.prev) go(meta.prev.id); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  // Tap on the artwork toggles the controls. Artwork is never a link, so a tap can't navigate by accident.
  const onReadingClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (sheet) { setSheet(null); return; }
    if (pinned) return;
    if (paged && zoom === 1) {
      const r = e.currentTarget.getBoundingClientRect(); const f = (e.clientX - r.left) / r.width;
      if (f < 0.3) { step(rtl ? 1 : -1); return; }
      if (f > 0.7) { step(rtl ? -1 : 1); return; }
    }
    setVisible((v) => !v); setActivity((a) => a + 1);
  };

  const chapterText = `Chapter ${meta.displayNumber ?? meta.number}`;
  const toTop = () => { if (paged) { setCurrent(0); window.scrollTo({ top: 0 }); } else window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="rd-root">
      <div onClick={onReadingClick} className="min-h-[100dvh]">
        {meta.imageCount === 0 && (
          <div className="mx-auto max-w-2xl px-4 pb-28 pt-24 text-center">
            <p className="text-base font-medium">
              {meta.external ? `${meta.external.sourceId} chapters are unavailable or do not host direct page images for this chapter.` : "This chapter has no pages yet."}
            </p>
            {meta.alternatives && meta.alternatives.length > 0 && (
              <div className="mt-6 rounded-xl border border-line bg-card p-5 text-left" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-sm font-bold text-primary">Alternative chapter sources (WeebCentral / Asura Scans)</h3>
                <p className="mt-1 text-xs text-muted">Read this title using the alternative provider&apos;s own chapter IDs and reader URLs:</p>
                <div className="mt-4 space-y-3">
                  {meta.alternatives.map((alt) => (
                    <div key={`${alt.sourceId}:${alt.externalId}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3 text-sm">
                      <div><p className="font-semibold">{alt.title}</p><p className="text-xs text-muted">{alt.sourceName} · ID: {alt.externalId} · {alt.totalChapters} chapters</p></div>
                      <div className="flex flex-wrap gap-2">
                        {alt.matchedChapter && <Link href={alt.matchedChapter.readerUrl} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white">Read Ch. {alt.matchedChapter.numberLabel ?? meta.displayNumber ?? meta.number} on {alt.sourceName}</Link>}
                        <Link href={alt.catalogUrl} className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold hover:bg-card">Browse {alt.sourceName} chapters</Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm" onClick={(e) => e.stopPropagation()}>
              {meta.external?.sourceUrl && <a href={meta.external.sourceUrl} target="_blank" rel="noopener noreferrer" className="rounded-md bg-primary px-4 py-2 font-semibold text-white">Open chapter at source</a>}
              <Link href={back} className="rounded-md border border-line px-4 py-2">Back to comic</Link>
            </div>
          </div>
        )}

        {paged && meta.imageCount > 0 && (
          <div className="mx-auto flex min-h-[100dvh] w-full max-w-5xl select-none items-center justify-center"
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => { if (touchX.current === null || zoom !== 1) return; const dx = e.changedTouches[0].clientX - touchX.current; touchX.current = null; if (Math.abs(dx) >= 50) step((rtl ? dx > 0 : dx < 0) ? 1 : -1); }}>
            <div className={`w-full ${zoom !== 1 ? "overflow-auto" : ""}`} style={zoom !== 1 ? { maxHeight: "100dvh" } : undefined}>
              {images[current] ? <Page key={images[current].id} img={images[current]} idx={current} paged zoom={zoom} /> : <div className="skeleton h-[60vh] w-full" />}
            </div>
            {loadError && <p className="absolute bottom-20 w-full text-center text-sm">Couldn&apos;t load more pages. <button onClick={(e) => { e.stopPropagation(); loadMore(); }} className="text-primary">Retry</button></p>}
          </div>
        )}

        {!paged && meta.imageCount > 0 && (
          <div className="mx-auto" style={width === "full" ? undefined : { maxWidth: `calc(${WIDTHS[width]} * ${zoom})` }}>
            {images.map((img, i) => <Page key={img.id} img={img} idx={i} paged={false} zoom={1} />)}
            {!done && (
              <div ref={sentinel} className="py-10 text-center text-sm text-[#a1a1aa]">
                {loadError ? <>Couldn&apos;t load more pages. <button onClick={(e) => { e.stopPropagation(); loadMore(); }} className="text-primary">Retry</button></> : "Loading more pages..."}
              </div>
            )}
            {done && <div ref={endRef} className="h-24" aria-hidden />}
          </div>
        )}
      </div>

      <ReaderControls
        visible={shown} sheet={sheet} setSheet={setSheet} onInteract={() => setActivity((a) => a + 1)}
        comicTitle={meta.comic.title} chapterLabel={chapterText} backHref={back}
        prevHref={meta.prev ? chHref(meta.prev.id) : null} nextHref={meta.next ? chHref(meta.next.id) : null}
        chapters={chapters} currentId={meta.id} chHref={chHref} readIds={reads.ids} chapterRead={isRead}
        comicId={external ? null : meta.comic.id} onTop={toTop}
        page={Math.min(current + 1, meta.imageCount)} total={meta.imageCount}
        mode={mode} setMode={(m) => { setMode(m); modeRef.current = m; store("cv:reader:mode", m); }}
        width={width} setWidth={(w) => { setWidth(w); store("cv:reader:width", w); }}
        zoom={zoom} zoomOptions={ZOOMS} setZoom={(z) => { setZoom(z); store("cv:reader:zoom", String(z)); }}
        fullscreen={fullscreen} fullscreenSupported={fsSupported} toggleFullscreen={toggleFullscreen}
        source={src}
      />
    </div>
  );
}
