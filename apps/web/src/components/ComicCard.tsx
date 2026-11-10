"use client";
import Link from "next/link";
import { Bookmark, Star } from "lucide-react";
import { Comic, chapterLabel, latestChapter } from "@/lib/comics";
import { useLibrary } from "./LibraryProvider";

export function Cover({ hue, title, className = "", src, priority = false }: { hue: number; title: string; className?: string; src?: string | null; priority?: boolean }) {
  return (
    <div
      role="img" aria-label={`Cover of ${title}`}
      className={`cv-cover relative flex items-end overflow-hidden rounded-xl border border-line p-3 ${className}`}
      style={{ background: `linear-gradient(160deg, hsl(${hue} 55% 38%), hsl(${(hue + 42) % 360} 50% 10%))` }}
    >
      <span className="relative z-10 line-clamp-3 text-sm font-extrabold leading-tight text-white drop-shadow-lg">{title}</span>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading={priority ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 z-20 h-full w-full object-cover" />
      )}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  Ongoing: "bg-[rgba(52,211,153,.18)] text-emerald-300",
  Completed: "bg-[rgba(96,165,250,.18)] text-blue-300",
  Hiatus: "bg-[rgba(251,191,36,.18)] text-amber-300",
};

export function BookmarkToggle({ comicId, className = "" }: { comicId: string; className?: string }) {
  const lib = useLibrary();
  const on = lib.isBookmarked(comicId);
  return (
    <button
      type="button" aria-pressed={on} aria-label={on ? "Remove bookmark" : "Bookmark"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); void lib.toggleBookmark(comicId); }}
      className={`grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur hover:bg-black/80 ${className}`}
    >
      <Bookmark size={16} className={on ? "fill-[#c084fc] text-[#c084fc]" : ""} aria-hidden />
    </button>
  );
}

export default function ComicCard({ comic, priority = false }: { comic: Comic; priority?: boolean }) {
  const last = latestChapter(comic);
  const lib = useLibrary();
  const progress = lib.progressFor(comic.id);
  const count = comic.chapterCount || comic.chapters.length;
  return (
    <div className="cv-card-hover group relative block w-full transition duration-200">
      <Link href={`/comics/${comic.slug}`} className="block" aria-label={comic.title}>
        <div className="relative">
          <Cover hue={comic.hue} title={comic.title} src={comic.coverUrl} priority={priority} className="aspect-[2/3] transition duration-300 group-hover:border-[#a855f7]" />
          <span className="absolute left-2 top-2 z-30 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-bold text-white/90 backdrop-blur">{comic.type}</span>
          <span className={`absolute bottom-2 left-2 z-30 rounded-md px-1.5 py-0.5 text-[10px] font-bold backdrop-blur ${STATUS_STYLE[comic.status] ?? "bg-black/60 text-white"}`}>{comic.status}</span>
          <span className="absolute bottom-2 right-2 z-30 flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-bold text-white backdrop-blur">
            <Star size={11} className="fill-yellow-300 text-yellow-300" aria-hidden />{comic.rating > 0 ? comic.rating.toFixed(1) : "–"}
          </span>
        </div>
        <h3 className="mt-2.5 line-clamp-1 text-sm font-semibold group-hover:text-primary">{comic.title}</h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted">{comic.genres.slice(0, 2).join(", ") || comic.type}</p>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
          <span>{last.id ? `Ch. ${chapterLabel(last)}` : "No chapters"}</span>
          {count > 0 && <span>{count} {count === 1 ? "chapter" : "chapters"}</span>}
        </div>
        {progress && <p className="mt-1 text-[11px] font-semibold text-primary">Reading · Ch. {progress.displayNumber ?? progress.number}</p>}
      </Link>
      <BookmarkToggle comicId={comic.id} className="absolute right-2 top-2 z-30" />
    </div>
  );
}
