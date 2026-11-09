"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Cover } from "./ComicCard";
import { ApiError, api } from "@/lib/api";

interface Row { slug: string; title: string; sub: string; href: string; cta: string }
const hue = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

export default function Library({ kind }: { kind: "bookmarks" | "history" }) {
  const [rows, setRows] = useState<Row[] | null>(null); const [state, setState] = useState<"loading" | "anon" | "error" | "ok">("loading");
  useEffect(() => {
    api<any>(`/user/${kind}`, { credentials: "include" }).then((r) => {
      setRows(kind === "bookmarks"
        ? r.items.map((b: any) => ({ slug: b.comic.slug, title: b.comic.title, sub: b.comic.latestChapter ? `Latest: Ch. ${b.comic.latestChapter.number}` : "No chapters yet", href: `/comics/${b.comic.slug}`, cta: "Open" }))
        : r.map((h: any) => ({ slug: h.comic.slug, title: h.comic.title, sub: `Ch. ${h.chapter.number} · page ${h.imageIndex + 1}`, href: `/comics/${h.comic.slug}/chapter/${h.chapter.id}`, cta: "Continue reading" })));
      setState("ok");
    }).catch((e) => setState(e instanceof ApiError && e.status === 401 ? "anon" : "error"));
  }, [kind]);

  return (
    <div>
      <nav aria-label="Library" className="mb-6 flex gap-4 text-sm">
        <Link href="/profile/bookmarks" className={kind === "bookmarks" ? "font-semibold" : "text-muted"}>Bookmarks</Link>
        <Link href="/profile/history" className={kind === "history" ? "font-semibold" : "text-muted"}>History</Link>
        <Link href="/profile/reviews" className="text-muted">Reviews</Link>
        <Link href="/profile/notifications" className="text-muted">Alerts</Link>
        <Link href="/profile/settings" className="text-muted">Settings</Link>
      </nav>
      {state === "loading" && <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20" />)}</div>}
      {state === "anon" && <p>Please <Link href="/login" className="text-primary">log in</Link> to see your {kind}.</p>}
      {state === "error" && <p className="text-danger">We couldn't load your {kind}. Refresh to try again.</p>}
      {state === "ok" && rows!.length === 0 && <p className="text-muted">{kind === "bookmarks" ? "No bookmarks yet. Open a comic and choose Bookmark." : "Nothing read yet. Your place in each comic is saved as you read."}</p>}
      {state === "ok" && rows!.length > 0 && (
        <ul className="space-y-2">{rows!.map((r) => (
          <li key={r.slug} className="flex items-center gap-4 rounded-lg border border-line bg-card p-3">
            <Cover hue={hue(r.slug)} title={r.title} className="aspect-[2/3] w-12 shrink-0" />
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{r.title}</p><p className="text-sm text-muted">{r.sub}</p></div>
            <Link href={r.href} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold">{r.cta}</Link>
          </li>))}
        </ul>
      )}
    </div>
  );
}
