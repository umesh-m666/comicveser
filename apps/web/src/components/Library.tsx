"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, Info, Minus, Plus, Trash2, X } from "lucide-react";
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

  // History only: removing an entry hides it on this device. There is no
  // delete-history endpoint in the API, so nothing is removed server-side.
  const removeRow = (slug: string) => setRows((prev) => (prev ? prev.filter((r) => r.slug !== slug) : prev));

  // History only: group rows by the day they were last read (newest first;
  // the API already returns them in that order).
  const historyGroups: { label: string; items: ActivityItem[] }[] = [];
  if (kind === "history" && rows) {
    for (const r of rows) {
      const item: ActivityItem = {
        slug: r.slug, title: r.title, chapterId: r.chapterId ?? "", chapterNumber: r.chapterNumber ?? "",
        chapterTitle: r.chapterTitle ?? "", lastReadAt: r.lastReadAt ?? "",
      };
      const label = dayLabel(item.lastReadAt);
      const g = historyGroups.find((x) => x.label === label);
      if (g) g.items.push(item); else historyGroups.push({ label, items: [item] });
    }
  }

  return (
<<<<<<< HEAD
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
=======
    <div>
      <ProfileNav active="/profile/history" />
      <h1 className="mb-4 text-2xl font-extrabold text-white">Reading history</h1>
      {state === "loading" && <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20" />)}</div>}
      {state === "anon" && <p>Please <Link href="/login" className="text-primary">log in</Link> to see your {kind}.</p>}
      {state === "error" && <p className="text-danger">We couldn't load your {kind}. Refresh to try again.</p>}
      {state === "ok" && rows!.length === 0 && <p className="text-muted">{kind === "bookmarks" ? "No bookmarks yet. Open a comic and choose Bookmark." : "Nothing read yet. Your place in each comic is saved as you read."}</p>}
      {state === "ok" && rows!.length > 0 && kind === "history" && (
        <div className="space-y-6">
          <p className="text-sm text-[#A8A1B5]">Removing an entry only hides it here — history can&apos;t be deleted on the server yet.</p>
          {historyGroups.map((g) => (
            <section key={g.label} aria-label={`Read ${g.label}`}>
              <h2 className="mb-3 text-lg font-bold text-white">{g.label}</h2>
              <ul className="space-y-2">{g.items.map((item) => (
                <ActivityRow key={`${item.slug}-${item.chapterId}`} item={item} onDelete={() => removeRow(item.slug)} />
              ))}</ul>
            </section>
          ))}
        </div>
      )}
      {state === "ok" && rows!.length > 0 && kind === "bookmarks" && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
          {rows!.map((r) => {
            const total = r.latestNumber ?? 0;
            const read = r.readChapter;
            const status = deriveStatus(read, total);
            return (
              <article key={r.slug} className="group">
                <button type="button" onClick={() => setSelected(r)} aria-label={`${r.title} — library details`} className="relative block w-full text-left">
                  <Cover hue={hue(r.slug)} title={r.title} className="aspect-[2/3] w-full transition duration-300 group-hover:border-primary group-hover:shadow-[0_12px_35px_rgba(147,51,234,.25)]" />
                  <span className={`absolute left-2 top-2 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${STATUS_STYLES[status]}`}>{status}</span>
                  {read !== undefined && total > 0 && (
                    <span className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2 py-1 text-[11px] font-black text-warn backdrop-blur">{read}/{total}</span>
                  )}
                </button>
                <h3 className="mt-2.5 line-clamp-1 text-sm font-bold">
                  <button type="button" onClick={() => setSelected(r)} className="hover:text-primary">{r.title}</button>
                </h3>
                <p className="mt-0.5 text-xs text-muted">{r.sub}{read !== undefined && total > 0 ? ` · ${total - read > 0 ? `${total - read} behind` : "Caught up"}` : ""}</p>
              </article>
            );
          })}
        </div>
      )}
      {selected && kind === "bookmarks" && (
        <BookmarkDetailModal
          row={selected}
          onClose={() => setSelected(null)}
          onRemoved={(slug) => setRows((prev) => (prev ? prev.filter((r) => r.slug !== slug) : prev))}
          onProgress={(slug, read) => setRows((prev) => prev?.map((r) => (r.slug === slug ? { ...r, readChapter: read } : r)) ?? prev)}
        />
      )}
>>>>>>> 44714f483b778704646c40bf4db1fe37e116786e
    </div>
  );
}
