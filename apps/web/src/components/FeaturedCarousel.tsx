"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Comic, chapterLabel, latestChapter } from "@/lib/comics";
import { Cover } from "./ComicCard";
import { useLibrary } from "./LibraryProvider";

export default function FeaturedCarousel({ comics }: { comics: Comic[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const lib = useLibrary();
  const n = comics.length;
  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);

  useEffect(() => {
    if (n < 2 || paused) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => go(1), 7000);
    return () => clearInterval(t);
  }, [n, paused, go]);

  if (!n) return null;
  return (
    <section
      aria-roledescription="carousel" aria-label="Featured comics"
      className="cv-feature rounded-2xl" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touchX.current === null) return; const dx = e.changedTouches[0].clientX - touchX.current; touchX.current = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }}
    >
      <div className="relative min-h-[24rem] md:min-h-[21rem]">
        {comics.map((c, idx) => {
          const last = latestChapter(c);
          const progress = lib.progressFor(c.id);
          const active = idx === i;
          return (
            <article key={c.id} aria-hidden={!active} aria-roledescription="slide" aria-label={`${idx + 1} of ${n}`}
              className={`absolute inset-0 transition-opacity duration-500 ${active ? "z-10 opacity-100" : "pointer-events-none opacity-0"}`}>
              {c.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.coverUrl} alt="" referrerPolicy="no-referrer" loading={idx === 0 ? "eager" : "lazy"} className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl" />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-[#0b0910] via-[rgba(11,9,16,.8)] to-[rgba(11,9,16,.35)]" />
              <div className="relative flex h-full items-center gap-5 p-5 md:gap-8 md:p-8">
                <Cover hue={c.hue} title={c.title} src={c.coverUrl} priority={idx === 0} className="aspect-[2/3] w-28 shrink-0 shadow-2xl sm:w-36 md:w-44" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted">
                    <span className="rounded-md bg-[rgba(147,51,234,.3)] px-2 py-0.5 text-[#e9d5ff]">{c.type}</span>
                    <span className="flex items-center gap-1 text-fg"><Star size={13} className="fill-yellow-300 text-yellow-300" aria-hidden />{c.rating > 0 ? c.rating.toFixed(1) : "Not rated"}</span>
                    {last.id && <span>Latest: Ch. {chapterLabel(last)}</span>}
                  </p>
                  <h2 className="mt-2 line-clamp-2 text-2xl font-extrabold leading-tight md:text-4xl">{c.title}</h2>
                  <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-6 text-muted md:line-clamp-3">{c.description}</p>
                  <div className="mt-3 hidden flex-wrap gap-1.5 sm:flex">
                    {c.genres.slice(0, 4).map((g) => <Link key={g} tabIndex={active ? 0 : -1} href={`/browse?genre=${encodeURIComponent(g)}`} className="cv-chip">{g}</Link>)}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {progress && <Link tabIndex={active ? 0 : -1} href={`/comics/${c.slug}/chapter/${progress.chapterId}`} className="cv-btn cv-btn-primary"><BookOpen size={16} aria-hidden />Continue Ch. {progress.displayNumber ?? progress.number}</Link>}
                    <Link tabIndex={active ? 0 : -1} href={`/comics/${c.slug}`} className={progress ? "cv-btn" : "cv-btn cv-btn-primary"}>View Details</Link>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {n > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Previous slide" className="absolute left-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 hover:bg-black/70 md:grid"><ChevronLeft size={20} /></button>
          <button type="button" onClick={() => go(1)} aria-label="Next slide" className="absolute right-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 hover:bg-black/70 md:grid"><ChevronRight size={20} /></button>
          <div className="absolute bottom-3 right-4 z-20 flex gap-1.5">
            {comics.map((c, idx) => (
              <button key={c.id} type="button" aria-label={`Go to slide ${idx + 1}`} aria-current={idx === i} onClick={() => setI(idx)}
                className={`h-2 rounded-full transition-all ${idx === i ? "w-6 bg-[#a855f7]" : "w-2 bg-white/35 hover:bg-white/60"}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
