import Link from "next/link";
import { Star, BookOpen } from "lucide-react";
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

export default function ComicCard({ comic }: { comic: Comic }) {
  const last = latestChapter(comic);
  return (
    <Link href={`/comics/${comic.slug}`} className="cv-card-hover group block w-full transition duration-200">
      <div className="relative">
        <Cover hue={comic.hue} title={comic.title} src={comic.coverUrl} className="aspect-[2/3] transition duration-300 group-hover:border-primary group-hover:shadow-[0_12px_35px_rgba(139,92,246,.2)]" />
        <span className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90"><BookOpen size={10} className="mr-1 inline" />{comic.type}</span>
      </div>
      <h3 className="mt-3 line-clamp-1 text-sm font-bold group-hover:text-primary">{comic.title}</h3>
      <div className="mt-1 flex items-center justify-between text-xs text-muted">
        <span>Chapter {last.displayNumber ?? last.number}</span>
        <span className="flex items-center gap-1"><Star size={12} className="fill-primary text-primary" aria-hidden />{comic.rating.toFixed(1)}</span>
      </div>
    </Link>
  );
}
