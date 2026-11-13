"use client";
import Link from "next/link";
import { useState } from "react";
import { Comic } from "@/lib/comics";
import { ComicVerseMark } from "./ComicVerseLogo";
import { useLibrary } from "./LibraryProvider";

export function Cover({
  hue,
  title,
  className = "",
  src,
  priority = false,
}: {
  hue: number;
  title: string;
  className?: string;
  src?: string | null;
  priority?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const showImage = Boolean(src) && !imgError;

  return (
    <div
      role="img"
      aria-label={`Cover of ${title}`}
      className={`cv-cover relative flex items-end overflow-hidden bg-[#181424] p-2.5 ${className}`}
      style={{
        background: `linear-gradient(160deg, hsl(${hue} 55% 38%), hsl(${(hue + 42) % 360} 50% 10%))`,
      }}
    >
      {!showImage && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center p-2 opacity-85"
          >
            <ComicVerseMark className="max-h-[54%] max-w-[68%] drop-shadow-md" />
          </span>
          <span className="relative z-10 line-clamp-2 text-[11px] font-bold leading-tight text-white drop-shadow-lg">
            {title}
          </span>
        </>
      )}
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={`${title} cover art`}
          onError={() => setImgError(true)}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 z-20 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

<<<<<<< HEAD
function statusPillClass(status: string): string {
  const lower = (status || "Ongoing").toLowerCase();
  if (lower === "completed") return "done";
  if (lower === "hiatus") return "hiatus";
  return "on";
}

export function BookmarkToggle({ comicId, className = "" }: { comicId: string; className?: string }) {
  const lib = useLibrary();
  const on = lib.isBookmarked(comicId);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Bookmarked" : "Bookmark"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void lib.toggleBookmark(comicId);
      }}
      className={`bm-toggle ${on ? "done" : ""} ${className}`.trim()}
    >
      <svg
        viewBox="0 0 24 24"
        fill={on ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6.5 3.5h11V21L12 16.6 6.5 21z" />
      </svg>
      <span>{on ? "Bookmarked" : "Bookmark"}</span>
    </button>
  );
}

/**
 * Unified Asura Comic Card (.ucard):
 * Used identically on Home (Trending), Browse, Manga, and Detail recommendations, desktop + mobile:
 * 1. Cover + top-right ★ rating badge (.rate-badge)
 * 2. Title (h3)
 * 3. Meta pills row (.cmeta): Chapters count pill (.chpill) + Status pill (.stpill)
 * 4. Full-width Bookmark / Bookmarked toggle button (.bm-toggle)
 */
export default function ComicCard({ comic, priority = false }: { comic: Comic; priority?: boolean }) {
  const lib = useLibrary();
  const progress = lib.progressFor(comic.id);
  const count = comic.chapterCount || comic.chapters.length;
  const ratingText = comic.rating && comic.rating > 0 ? comic.rating.toFixed(1) : "9.5";
  const statusLabel = comic.status || "Ongoing";
=======
const statusStyle: Record<string, string> = {
  Ongoing: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  Completed: "border-violet-400/30 bg-violet-500/15 text-violet-200",
  Hiatus: "border-amber-400/30 bg-amber-400/10 text-amber-300",
};

/** Chapter count: real chapter list when loaded, otherwise the latest chapter number. */
export function chapterCount(comic: Comic): number {
  const last = latestChapter(comic);
  return comic.chapters.length > 0 ? comic.chapters.length : last.number;
}

/** Short relative time, e.g. "2h ago". */
export function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
>>>>>>> 44714f483b778704646c40bf4db1fe37e116786e

export default function ComicCard({ comic }: { comic: Comic }) {
  const last = latestChapter(comic);
  const count = chapterCount(comic);
  return (
<<<<<<< HEAD
    <div className="ucard" data-t={comic.title}>
      <Link href={`/comics/${comic.slug}`} className="cov-btn" aria-label={`Open ${comic.title}`}>
        <span className="cov">
          <Cover
            hue={comic.hue}
            title={comic.title}
            src={comic.coverUrl}
            priority={priority}
            className="h-full w-full rounded-none border-0"
          />
          <span className="rate-badge">★ {ratingText}</span>
          {progress && (
            <span
              className="absolute bottom-2 left-2 z-30 rounded bg-[#9333ea]/90 px-1.5 py-0.5 text-[10px] font-bold text-white"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              Ch. {progress.displayNumber ?? progress.number}
            </span>
          )}
        </span>
      </Link>

      <div className="cinfo">
        <Link href={`/comics/${comic.slug}`}>
          <h3 title={comic.title}>{comic.title}</h3>
        </Link>
        <div className="cmeta">
          <span className="chpill">
            {count} {count === 1 ? "Chapter" : "Chapters"}
          </span>
          <span className={`stpill ${statusPillClass(statusLabel)}`}>{statusLabel}</span>
        </div>
        <BookmarkToggle comicId={comic.id} />
=======
    <article className="cv-card-hover group flex w-full flex-col transition duration-200">
      <Link href={`/comics/${comic.slug}`} className="relative block" aria-label={comic.title}>
        <Cover hue={comic.hue} title={comic.title} src={comic.coverUrl} className="aspect-[2/3] transition duration-300 group-hover:border-primary group-hover:shadow-[0_12px_35px_rgba(147,51,234,.25)]" />
        <span className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90"><BookOpen size={10} className="mr-1 inline" />{comic.type}</span>
        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs font-bold text-white backdrop-blur"><Star size={12} className="fill-yellow-300 text-yellow-300" aria-hidden />{comic.rating.toFixed(1)}</span>
      </Link>
      <h3 className="mt-3 line-clamp-1 text-sm font-bold">
        <Link href={`/comics/${comic.slug}`} className="hover:text-primary">{comic.title}</Link>
      </h3>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-bold text-fg">{count} {count === 1 ? "Chapter" : "Chapters"}</span>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusStyle[comic.status] ?? statusStyle.Ongoing}`}>{comic.status}</span>
        {last.number > 0 && <span className="text-[11px] text-muted">Ch. {last.displayNumber ?? last.number}</span>}
      </div>
      {/* stopPropagation so the bookmark toggle never navigates to the detail page. */}
      <div className="mt-3 pt-1" onClick={(e) => e.stopPropagation()}>
        <BookmarkButton comicId={comic.id} fill className="text-sm" />
>>>>>>> 44714f483b778704646c40bf4db1fe37e116786e
      </div>
    </div>
  );
}
