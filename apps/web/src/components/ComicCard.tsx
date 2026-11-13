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

  return (
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
      </div>
    </div>
  );
}
