"use client";
import Link from "next/link";
import { useState } from "react";
import { Comic, chapterLabel, latestChapter, timeAgo } from "@/lib/comics";
import { Cover } from "./ComicCard";
import EmptyState from "./EmptyState";

const PER_PAGE = 6;

/**
 * Asura Latest Updates (.latest-grid, .upd, .chrow, .read-bar, .pager):
 * 2-column grid of recently updated comics with 74x98 cover, title, up to 3 latest chapters
 * (.chrow with .hot highlight on the newest chapter), gold "Read the Comic" bar, and pagination.
 */
export default function LatestUpdates({ comics }: { comics: Comic[] }) {
  const [page, setPage] = useState(1);

  if (!comics.length) {
    return (
      <EmptyState
        title="No recent chapter updates"
        body="New chapters appear here automatically as soon as they are published."
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(comics.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PER_PAGE;
  const visible = comics.slice(start, start + PER_PAGE);

  return (
    <>
      <div className="latest-grid" id="latestGrid">
        {visible.map((c) => {
          const latest = latestChapter(c);
          const recentChapters = c.chapters.length
            ? [...c.chapters].slice(-3).reverse()
            : latest.id
            ? [latest]
            : [];
          const readHref = latest.id
            ? `/comics/${c.slug}/chapter/${latest.id}`
            : `/comics/${c.slug}`;

          return (
            <div key={c.id} className="upd">
              <Link href={`/comics/${c.slug}`} aria-label={c.title} className="shrink-0">
                <Cover
                  hue={c.hue}
                  title={c.title}
                  src={c.coverUrl}
                  className="upd-cov border-0 !p-1"
                />
              </Link>

              <div className="u-main">
                <Link href={`/comics/${c.slug}`}>
                  <h3 title={c.title}>{c.title}</h3>
                </Link>

                {recentChapters.length > 0 ? (
                  recentChapters.map((ch, idx) => (
                    <Link
                      key={ch.id}
                      href={`/comics/${c.slug}/chapter/${ch.id}`}
                      className={`chrow${idx === 0 ? " hot" : ""}`}
                    >
                      <span className="truncate">
                        Chapter {chapterLabel(ch)}
                        {ch.title && !/^chapter\s/i.test(ch.title) ? ` — ${ch.title}` : ""}
                      </span>
                      <span suppressHydrationWarning className="when">
                        {timeAgo(ch.publishedAt) || timeAgo(c.updatedAt) || "Just now"}
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="chrow">
                    <span>
                      {c.chapterCount || 0} Chapters · {c.status || "Ongoing"}
                    </span>
                    <span suppressHydrationWarning className="when">
                      {timeAgo(c.updatedAt) || "Updated"}
                    </span>
                  </div>
                )}

                <Link href={readHref} className="read-bar">
                  <span aria-hidden="true">▤</span> Read the Comic{" "}
                  <span className="chev" aria-hidden="true">
                    ›
                  </span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="pager" id="latestPager">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous updates page"
          >
            ‹
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={n === currentPage ? "on" : undefined}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next updates page"
          >
            ›
          </button>
        </div>
      )}
    </>
  );
}
