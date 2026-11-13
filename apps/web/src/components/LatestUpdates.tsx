"use client";
import Link from "next/link";
import { Comic, chapterLabel, latestChapter, timeAgo } from "@/lib/comics";
import { Cover } from "./ComicCard";
import EmptyState from "./EmptyState";

/**
 * AsuraScans-style Latest Updates:
 * Compact two-column grid on desktop (`md:grid-cols-2`) and single-column on mobile (`grid-cols-1`).
 * Each card displays the series cover on the left and the title + latest chapter links on the right.
 */
export default function LatestUpdates({ comics }: { comics: Comic[] }) {
  if (!comics.length) {
    return (
      <EmptyState
        title="No recent chapter updates"
        body="New chapters appear here automatically as soon as they are published."
      />
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
      {comics.map((c) => {
        const latest = latestChapter(c);
        const recentChapters = c.chapters.length
          ? [...c.chapters].slice(-3).reverse()
          : latest.id
          ? [latest]
          : [];

        return (
          <li
            key={c.id}
            className="group flex items-start gap-3.5 rounded-xl border border-[#262035] bg-[#171322] p-3 transition hover:border-[#9333EA]/50"
          >
            <Link
              href={`/comics/${c.slug}`}
              className="relative shrink-0 overflow-hidden rounded-lg"
              aria-label={c.title}
            >
              <Cover
                hue={c.hue}
                title={c.title}
                src={c.coverUrl}
                className="aspect-[2/3] w-20 sm:w-24 rounded-lg border-0 !p-1.5"
              />
              <span className="absolute left-1.5 top-1.5 z-30 rounded bg-[#9333EA] px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                {c.type}
              </span>
            </Link>

            <div className="min-w-0 flex-1 py-0.5">
              <Link
                href={`/comics/${c.slug}`}
                className="block truncate text-sm font-bold text-white transition-colors group-hover:text-[#C084FC] sm:text-[15px]"
                title={c.title}
              >
                {c.title}
              </Link>

              {recentChapters.length > 0 ? (
                <div className="mt-2.5 space-y-1.5">
                  {recentChapters.map((ch) => (
                    <Link
                      key={ch.id}
                      href={`/comics/${c.slug}/chapter/${ch.id}`}
                      className="flex items-center justify-between gap-2 rounded-md bg-[#211B2E]/80 px-2.5 py-1.5 text-xs transition hover:bg-[#9333EA]/25"
                    >
                      <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-[#E2DFEC] hover:text-white">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#A855F7]" aria-hidden />
                        <span className="truncate">Chapter {chapterLabel(ch)}</span>
                      </span>
                      <span suppressHydrationWarning className="shrink-0 text-[11px] text-[#A8A1B5]">
                        {timeAgo(ch.publishedAt) || timeAgo(c.updatedAt) || "New"}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-2.5 text-xs text-[#A8A1B5]">
                  {c.chapterCount || 0} Chapters · {c.status || "Ongoing"}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
