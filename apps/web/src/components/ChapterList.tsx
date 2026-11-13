"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownUp } from "lucide-react";
import type { Chapter } from "@/lib/comics";
import { useLibrary } from "./LibraryProvider";
import { useReadChapters } from "@/lib/useReadChapters";

/** Chapter list with newest/oldest sorting. `chapters` arrives oldest-first (API order=asc). */
export default function ChapterList({ slug, comicId, chapters }: { slug: string; comicId: string; chapters: Chapter[] }) {
  const [newestFirst, setNewestFirst] = useState(true);
  const lib = useLibrary();
  const progress = lib.progressFor(comicId);
  const reads = useReadChapters(comicId);
  const rows = useMemo(() => (newestFirst ? [...chapters].reverse() : chapters), [chapters, newestFirst]);
  const latestId = chapters[chapters.length - 1]?.id;

  return (
    <section className="mt-10" aria-label="Chapters">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="cv-section-title text-xl font-bold">Chapters <span className="text-sm font-normal text-muted">({chapters.length})</span></h2>
        <button type="button" onClick={() => setNewestFirst((v) => !v)} className="cv-btn !min-h-9 !px-3 text-xs" aria-label={`Sorted ${newestFirst ? "newest" : "oldest"} first. Switch order`}>
          <ArrowDownUp size={14} aria-hidden />{newestFirst ? "Newest first" : "Oldest first"}
        </button>
      </div>
      {rows.length === 0 ? <p className="cv-panel p-6 text-center text-sm text-muted">No chapters published yet.</p> : (
        <ul className="max-h-[36rem] divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface">
          {rows.map((ch) => {
            // Finished chapters are purple text; the chapter you're partway through is highlighted; everything else is white.
            const read = reads.isRead(ch.id);
            const current = !read && progress?.chapterId === ch.id;
            const state = read ? "read" : current ? "current" : "unread";
            const generic = /^chapter\s/i.test(ch.title) ? "" : ch.title;
            return (
              <li key={ch.id}>
                <Link href={`/comics/${slug}/chapter/${ch.id}`} data-state={state} className="cv-ch flex items-center justify-between gap-3 px-4 py-3 hover:bg-card">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">Chapter {ch.displayNumber ?? ch.number}</span>
                      {ch.id === latestId && <span className="rounded bg-[rgba(147,51,234,.3)] px-1.5 py-0.5 text-[10px] font-bold text-[#e9d5ff]">Latest</span>}
                      {current && <span className="rounded bg-[rgba(168,85,247,.35)] px-1.5 py-0.5 text-[10px] font-bold text-white">Continue · page {progress!.imageIndex + 1}</span>}
                      {read && <span className="rounded bg-[rgba(168,85,247,.16)] px-1.5 py-0.5 text-[10px] font-bold">Read</span>}
                    </span>
                    {generic && <span className="cv-ch-meta mt-0.5 block truncate text-xs">{generic}</span>}
                  </span>
                  <span className="cv-ch-meta shrink-0 text-xs">{ch.publishedAt && new Date(ch.publishedAt).getTime() > 0 ? new Date(ch.publishedAt).toLocaleDateString("en-IN", { dateStyle: "medium" }) : ""}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
