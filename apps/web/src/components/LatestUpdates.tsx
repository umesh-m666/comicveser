"use client";
import Link from "next/link";
import { Comic, chapterLabel, latestChapter, timeAgo } from "@/lib/comics";
import { BookmarkToggle, Cover } from "./ComicCard";
import { useLibrary } from "./LibraryProvider";
import EmptyState from "./EmptyState";

export default function LatestUpdates({ comics }: { comics: Comic[] }) {
  const lib = useLibrary();
  if (!comics.length) return <EmptyState title="No recent updates" body="New chapters will show up here as soon as they are published." />;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {comics.map((c) => {
        const l = latestChapter(c);
        const p = lib.progressFor(c.id);
        const status = !p ? null : p.chapterId === l.id ? "Up to date" : `Reading Ch. ${p.displayNumber ?? p.number}`;
        return (
          <li key={c.id} className="relative flex gap-3 rounded-xl border border-line bg-surface p-3 hover:border-[#a855f7]">
            <Link href={`/comics/${c.slug}`} className="shrink-0" aria-label={c.title}><Cover hue={c.hue} title={c.title} src={c.coverUrl} className="aspect-[2/3] w-16 !rounded-lg !p-1" /></Link>
            <div className="min-w-0 flex-1">
              <Link href={`/comics/${c.slug}`} className="block truncate text-sm font-semibold hover:text-primary">{c.title}</Link>
              <p className="mt-0.5 text-xs text-muted">{c.type} · {c.status}</p>
              {l.id ? (
                <Link href={`/comics/${c.slug}/chapter/${l.id}`} className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-[rgba(147,51,234,.14)] px-2.5 py-1.5 text-xs hover:bg-[rgba(147,51,234,.26)]">
                  <span className="font-semibold">Chapter {chapterLabel(l)}</span>
                  <span suppressHydrationWarning className="text-muted">{timeAgo(l.publishedAt) || timeAgo(c.updatedAt)}</span>
                </Link>
              ) : <p className="mt-2 text-xs text-muted">No chapters yet</p>}
              {status && <p className="mt-1.5 text-[11px] font-semibold text-primary">{status}</p>}
            </div>
            <BookmarkToggle comicId={c.id} className="!h-8 !w-8 self-start" />
          </li>
        );
      })}
    </ul>
  );
}
