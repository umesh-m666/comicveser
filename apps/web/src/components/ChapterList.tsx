"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Chapter } from "@/lib/comics";
import { timeAgo } from "@/lib/comics";
import { useLibrary } from "./LibraryProvider";
import { useReadChapters } from "@/lib/useReadChapters";

/** Asura-style Chapter List (.panel, .chap-list, .chaprow) with newest/oldest sorting and read progress. */
export default function ChapterList({
  slug,
  comicId,
  chapters,
}: {
  slug: string;
  comicId: string;
  chapters: Chapter[];
}) {
  const [newestFirst, setNewestFirst] = useState(true);
  const lib = useLibrary();
  const progress = lib.progressFor(comicId);
  const reads = useReadChapters(comicId);
  const rows = useMemo(
    () => (newestFirst ? [...chapters].reverse() : chapters),
    [chapters, newestFirst],
  );
  const latestId = chapters[chapters.length - 1]?.id;

  return (
    <section className="panel" data-layer="Chapter List" aria-label="Chapters">
      <div className="panel-h2">
        <span className="ic" aria-hidden="true">
          ☰
        </span>
        <h2>
          Chapters <span style={{ color: "var(--muted)", fontSize: 13 }}>({chapters.length})</span>
        </h2>
        <button
          type="button"
          onClick={() => setNewestFirst((v) => !v)}
          className="pillbtn ghost"
          aria-label={`Sorted ${newestFirst ? "newest" : "oldest"} first. Switch order`}
        >
          ↕ {newestFirst ? "Newest first" : "Oldest first"}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="empty-note">No chapters published yet.</div>
      ) : (
        <div className="chap-list" id="detailChaps">
          {rows.map((ch) => {
            const read = reads.isRead(ch.id);
            const current = !read && progress?.chapterId === ch.id;
            const state = read ? "read" : current ? "current" : "unread";
            const generic = /^chapter\s/i.test(ch.title) ? "" : ch.title;

            return (
              <Link
                key={ch.id}
                href={`/comics/${slug}/chapter/${ch.id}`}
                data-state={state}
                className="chaprow"
              >
                <span className="min-w-0 truncate">
                  <span className="n">Chapter {ch.displayNumber ?? ch.number}</span>
                  {generic && <span className="t">— {generic}</span>}
                  {ch.id === latestId && (
                    <span className="tag purple" style={{ marginLeft: 8, padding: "1px 7px", fontSize: 10 }}>
                      NEW
                    </span>
                  )}
                  {current && (
                    <span className="tag purple" style={{ marginLeft: 8, padding: "1px 7px", fontSize: 10 }}>
                      Continue · p.{progress!.imageIndex + 1}
                    </span>
                  )}
                  {read && (
                    <span className="tag grey" style={{ marginLeft: 8, padding: "1px 7px", fontSize: 10 }}>
                      Read
                    </span>
                  )}
                </span>
                <span suppressHydrationWarning className="w">
                  {timeAgo(ch.publishedAt) ||
                    (ch.publishedAt && new Date(ch.publishedAt).getTime() > 0
                      ? new Date(ch.publishedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })
                      : "")}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
