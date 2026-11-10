"use client";
import Link from "next/link";
import { useState } from "react";
import { Bookmark, Star } from "lucide-react";
import { Comic } from "@/lib/comics";
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
      className={`cv-cover relative flex items-end overflow-hidden bg-[#181424] p-3 ${className}`}
      style={{
        background: `linear-gradient(160deg, hsl(${hue} 55% 38%), hsl(${(hue + 42) % 360} 50% 10%))`,
      }}
    >
      {!showImage && (
        <span className="relative z-10 line-clamp-3 text-sm font-extrabold leading-tight text-white drop-shadow-lg">
          {title}
        </span>
      )}
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={title}
          onError={() => setImgError(true)}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 z-20 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      )}
    </div>
  );
}

const STATUS_PILL_STYLE: Record<string, string> = {
  Ongoing: "bg-[#9333EA]/25 text-[#C084FC]",
  Completed: "bg-emerald-500/20 text-emerald-300",
  Hiatus: "bg-amber-500/20 text-amber-300",
};

export function BookmarkToggle({ comicId, className = "" }: { comicId: string; className?: string }) {
  const lib = useLibrary();
  const on = lib.isBookmarked(comicId);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Remove bookmark" : "Bookmark"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void lib.toggleBookmark(comicId);
      }}
      className={`inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
        on
          ? "bg-[#2A253B] text-[#E2DFEC] hover:bg-[#352F49]"
          : "bg-[#8B3DFF] text-white shadow-[0_4px_14px_rgba(139,61,255,0.35)] hover:bg-[#9333EA]"
      } ${className}`}
    >
      <Bookmark size={14} className={on ? "fill-white text-white" : "text-white"} aria-hidden />
      <span>{on ? "Bookmarked" : "Bookmark"}</span>
    </button>
  );
}

export default function ComicCard({ comic, priority = false }: { comic: Comic; priority?: boolean }) {
  const lib = useLibrary();
  const progress = lib.progressFor(comic.id);
  const count = comic.chapterCount || comic.chapters.length;
  const ratingText = comic.rating && comic.rating > 0 ? comic.rating.toFixed(1) : "9.5";
  const statusLabel = comic.status || "Ongoing";

  return (
    <article className="cv-card-hover group relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-[#262035] bg-[#171322] shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition duration-200 hover:border-[#9333EA]/60">
      <Link href={`/comics/${comic.slug}`} className="block" aria-label={comic.title}>
        <div className="relative aspect-[2/3] w-full overflow-hidden">
          <Cover
            hue={comic.hue}
            title={comic.title}
            src={comic.coverUrl}
            priority={priority}
            className="h-full w-full rounded-none border-0"
          />
          <span className="absolute right-2 top-2 z-30 flex items-center gap-1 rounded-md bg-[#100E16]/88 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-xs">
            <Star size={11} className="fill-[#FBBF24] text-[#FBBF24]" aria-hidden />
            {ratingText}
          </span>
          {progress && (
            <span className="absolute bottom-2 left-2 z-30 rounded-md bg-[#9333EA]/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
              Ch. {progress.displayNumber ?? progress.number}
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col justify-between p-3 sm:p-3.5">
        <div>
          <Link href={`/comics/${comic.slug}`} className="block">
            <h3
              className="truncate text-sm font-bold text-white transition-colors group-hover:text-[#C084FC]"
              title={comic.title}
            >
              {comic.title}
            </h3>
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-[#252034] px-2 py-0.5 text-[11px] font-semibold text-[#D4D0DC]">
              {count} {count === 1 ? "Chapter" : "Chapters"}
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                STATUS_PILL_STYLE[statusLabel] ?? "bg-[#9333EA]/25 text-[#C084FC]"
              }`}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="mt-3">
          <BookmarkToggle comicId={comic.id} />
        </div>
      </div>
    </article>
  );
}
