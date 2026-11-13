"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Cover } from "./ComicCard";
import { ApiError, api } from "@/lib/api";
import { timeAgo } from "@/lib/comics";
import { hueOf } from "@/lib/media";

interface Row {
  id: string;
  slug: string;
  title: string;
  chapterLabel: string;
  when: string;
  href: string;
}

/**
 * Asura Reading History (#frame-history & #frame-mobile-history):
 * Header panel with clock icon, entry count, Clear all button, and .hist-row cards.
 */
export default function Library() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [state, setState] = useState<"loading" | "anon" | "error" | "ok">("loading");

  useEffect(() => {
    api<any[]>("/user/history", { credentials: "include" })
      .then((r) => {
        setRows(
          r.map((h) => ({
            id: h.comic.id,
            slug: h.comic.slug,
            title: h.comic.title,
            chapterLabel: `Chapter ${h.chapter.displayNumber ?? h.chapter.number}`,
            when: `page ${h.imageIndex + 1}${h.lastReadAt ? ` · ${timeAgo(h.lastReadAt)}` : ""}`,
            href: `/comics/${h.comic.slug}/chapter/${h.chapter.id}`,
          })),
        );
        setState("ok");
      })
      .catch((e) => setState(e instanceof ApiError && e.status === 401 ? "anon" : "error"));
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <section
        className="panel"
        data-layer="History Header"
        style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}
      >
        <span
          className="ic"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "rgba(147,51,234,.22)",
            color: "var(--purple-2)",
            display: "grid",
            placeItems: "center",
            fontSize: 17,
          }}
          aria-hidden="true"
        >
          ◷
        </span>
        <div>
          <h1 style={{ fontSize: 19, margin: 0, fontWeight: 700, color: "#fff" }}>
            Reading History
          </h1>
          <span style={{ fontSize: 12, color: "var(--muted)" }} className="hist-count">
            {rows ? `${rows.length} entries` : "Loading…"}
          </span>
        </div>
        {rows && rows.length > 0 && (
          <button
            type="button"
            className="pillbtn ghost hist-clear"
            style={{ marginLeft: "auto" }}
            onClick={() => setRows([])}
          >
            Clear view
          </button>
        )}
      </section>

      <div style={{ marginTop: 18 }}>
        {state === "loading" && (
          <div className="space-y-2.5" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-20" />
            ))}
          </div>
        )}
        {state === "anon" && (
          <div className="panel empty-note">
            Please{" "}
            <Link href="/login" style={{ color: "var(--purple-2)", fontWeight: 600 }}>
              log in
            </Link>{" "}
            to see your reading history.
          </div>
        )}
        {state === "error" && (
          <div className="panel empty-note" style={{ color: "var(--danger)" }}>
            We couldn&apos;t load your history. Refresh to try again.
          </div>
        )}
        {state === "ok" && rows!.length === 0 && (
          <div className="panel empty-note">
            Nothing read yet. Your place in each comic is saved as you read.
          </div>
        )}
        {state === "ok" && rows!.length > 0 && (
          <div className="hist-list" data-layer="History Entries">
            {rows!.map((r) => (
              <div key={r.slug} className="hist-row">
                <Link href={r.href}>
                  <Cover
                    hue={hueOf(r.slug)}
                    title={r.title}
                    className="hist-cov border-0 !p-0.5"
                  />
                </Link>
                <span style={{ minWidth: 0 }}>
                  <Link href={r.href} className="ht truncate">
                    {r.title}
                  </Link>
                  <span className="hs">
                    <span className="chpill">▤ {r.chapterLabel}</span> · ◷ {r.when}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <Link href={r.href} className="pillbtn" style={{ marginLeft: 0 }}>
                    Continue
                  </Link>
                  <button
                    type="button"
                    className="hist-del"
                    aria-label={`Remove ${r.title} from history view`}
                    onClick={() => setRows((prev) => (prev ? prev.filter((x) => x.slug !== r.slug) : prev))}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
