"use client";
import Link from "next/link";
import { useState } from "react";
import { Star } from "lucide-react";
import { Comic, chapterLabel, latestChapter } from "@/lib/comics";
import { Cover } from "./ComicCard";
import EmptyState from "./EmptyState";

const TABS = [["weekly", "Weekly"], ["monthly", "Monthly"], ["all", "All Time"]] as const;
type Tab = (typeof TABS)[number][0];

export default function PopularTabs({ lists }: { lists: Record<Tab, Comic[]> }) {
  const [tab, setTab] = useState<Tab>("weekly");
  const items = lists[tab].slice(0, 10);
  return (
    <div>
      <div role="tablist" aria-label="Popular period" className="mb-4 inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" id={`pop-${k}`} aria-selected={tab === k} aria-controls="pop-panel" onClick={() => setTab(k)} className="cv-tab">{label}</button>
        ))}
      </div>
      <div id="pop-panel" role="tabpanel" aria-labelledby={`pop-${tab}`}>
        {items.length === 0 ? <EmptyState title="No rankings yet" body="Rankings appear once readers start opening comics." /> : (
          <ol className="grid gap-2 md:grid-cols-2">
            {items.map((c, idx) => {
              const last = latestChapter(c);
              return (
                <li key={c.id}>
                  <Link href={`/comics/${c.slug}`} className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5 hover:border-[#a855f7]">
                    <span className={`w-7 shrink-0 text-center text-xl font-extrabold ${idx < 3 ? "text-primary" : "text-muted"}`}>{idx + 1}</span>
                    <Cover hue={c.hue} title={c.title} src={c.coverUrl} className="aspect-[2/3] w-12 shrink-0 !rounded-lg !p-1" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold group-hover:text-primary">{c.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted">{c.genres.slice(0, 3).join(", ") || c.type}</span>
                      <span className="mt-1 flex items-center gap-3 text-xs text-muted">
                        <span className="flex items-center gap-1"><Star size={11} className="fill-yellow-300 text-yellow-300" aria-hidden />{c.rating > 0 ? c.rating.toFixed(1) : "–"}</span>
                        {last.id && <span>Ch. {chapterLabel(last)}</span>}
                        <span>{c.views.toLocaleString("en-IN")} views</span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
