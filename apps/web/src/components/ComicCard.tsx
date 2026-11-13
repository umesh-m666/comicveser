import Link from "next/link";
import { Star, BookOpen } from "lucide-react";
import BookmarkButton from "./BookmarkButton";
import { Comic, latestChapter } from "@/lib/comics";

export function Cover({ hue, title, className = "", src }: { hue: number; title: string; className?: string; src?: string | null }) {
  return (
    <div
      role="img" aria-label={`Cover of ${title}`}
      className={`cv-cover relative flex items-end overflow-hidden rounded-xl border border-line p-3 ${className}`}
      style={{ background: `linear-gradient(160deg, hsl(${hue} 62% 46%), hsl(${(hue + 42) % 360} 55% 12%))` }}
    >
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 70% 20%, white 0, transparent 2px), radial-gradient(circle at 20% 65%, white 0, transparent 2px)", backgroundSize: "42px 42px" }} />
      <span className="relative z-10 line-clamp-3 text-sm font-extrabold leading-tight text-white drop-shadow-lg">{title}</span>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 z-20 h-full w-full object-cover" />
      )}
    </div>
  );
}

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

export default function ComicCard({ comic }: { comic: Comic }) {
  const last = latestChapter(comic);
  const count = chapterCount(comic);
  return (
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
      </div>
    </article>
  );
}
