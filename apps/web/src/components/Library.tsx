"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Cover } from "./ComicCard";
import ProfileNav from "./ProfileNav";
import { ApiError, api } from "@/lib/api";
import { timeAgo } from "@/lib/comics";
import { hueOf } from "@/lib/media";

interface Row { slug: string; title: string; sub: string; href: string }

/** Reading history: the last chapter and page you were on in each comic. (Bookmarks have their own page: BookmarksView.) */
export default function Library() {
  const [rows, setRows] = useState<Row[] | null>(null); const [state, setState] = useState<"loading" | "anon" | "error" | "ok">("loading");
  useEffect(() => {
    api<any[]>("/user/history", { credentials: "include" }).then((r) => {
      setRows(r.map((h) => ({ slug: h.comic.slug, title: h.comic.title, sub: `Ch. ${h.chapter.displayNumber ?? h.chapter.number} · page ${h.imageIndex + 1} · ${timeAgo(h.lastReadAt)}`, href: `/comics/${h.comic.slug}/chapter/${h.chapter.id}` })));
      setState("ok");
    }).catch((e) => setState(e instanceof ApiError && e.status === 401 ? "anon" : "error"));
  }, []);

  return (
    <div>
      <ProfileNav active="/profile/history" />
      <h1 className="mb-4 text-2xl font-extrabold text-white">Reading history</h1>
      {state === "loading" && <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20" />)}</div>}
      {state === "anon" && <p>Please <Link href="/login" className="text-primary">log in</Link> to see your history.</p>}
      {state === "error" && <p className="text-danger">We couldn&apos;t load your history. Refresh to try again.</p>}
      {state === "ok" && rows!.length === 0 && <p className="text-muted">Nothing read yet. Your place in each comic is saved as you read.</p>}
      {state === "ok" && rows!.length > 0 && (
        <ul className="space-y-2">{rows!.map((r) => (
          <li key={r.slug} className="flex items-center gap-4 rounded-xl border border-line bg-card p-3">
            <Cover hue={hueOf(r.slug)} title={r.title} className="aspect-[2/3] w-12 shrink-0" />
            <div className="min-w-0 flex-1"><p className="truncate font-semibold text-white">{r.title}</p><p className="text-sm text-muted">{r.sub}</p></div>
            <Link href={r.href} className="cv-btn cv-btn-primary !min-h-9 !px-3 text-xs">Continue reading</Link>
          </li>))}
        </ul>
      )}
    </div>
  );
}
