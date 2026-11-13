"use client";
import Link from "next/link";
import { useState } from "react";
import { Star } from "lucide-react";
import { Comic } from "@/lib/comics";
import { Cover } from "./ComicCard";
import EmptyState from "./EmptyState";

const TABS = [
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
  ["all", "All Time"],
] as const;
type Tab = (typeof TABS)[number][0];

/**
 * AsuraScans-style Popular Comics Ranked List:
 * Segmented Weekly | Monthly | All Time switcher + numbered rank badge (1–10), cover thumbnail, genres, and star rating.
 */
export default function PopularTabs({ lists }: { lists: Record<Tab, Comic[]> }) {
  const [tab, setTab] = useState<Tab>("weekly");
  const rawList = lists[tab]?.length ? lists[tab] : lists.all;
  const items = (rawList ?? []).slice(0, 10);

  return (
    <div className="rounded-xl border border-[#262035] bg-[#171322] p-4">
      <div
        role="tablist"
        aria-label="Popular ranking timeframe"
        className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-[#100E16] p-1"
      >
        {TABS.map(([k, label]) => {
          const selected = tab === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              id={`pop-${k}`}
              aria-selected={selected}
              aria-controls="pop-panel"
              onClick={() => setTab(k)}
              className={`rounded-md py-1.5 text-xs font-bold transition ${
                selected ? "bg-[#9333EA] text-white" : "text-[#A8A1B5] hover:text-white"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div id="pop-panel" role="tabpanel" aria-labelledby={`pop-${tab}`}>
        {items.length === 0 ? (
          <EmptyState title="No rankings available yet" body="Rankings update automatically as readers explore series." />
        ) : (
          <ol className="divide-y divide-[#262035]">
            {items.map((c, idx) => {
              const ratingText = c.rating && c.rating > 0 ? c.rating.toFixed(1) : "9.5";
              const isTop3 = idx < 3;

              return (
                <li key={c.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    href={`/comics/${c.slug}`}
                    className="group flex items-center gap-3 transition"
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border text-xs font-extrabold ${
                        isTop3
                          ? "border-[#A855F7] bg-[#9333EA]/25 text-white"
                          : "border-[#322A42] bg-[#100E16] text-[#A8A1B5]"
                      }`}
                    >
                      {idx + 1}
                    </span>

                    <Cover
                      hue={c.hue}
                      title={c.title}
                      src={c.coverUrl}
                      className="aspect-[2/3] w-12 shrink-0 rounded-md border-0 !p-1"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white transition-colors group-hover:text-[#C084FC]">
                        {c.title}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[#A8A1B5]">
                        <span className="text-[#7C7388]">Genres:</span>{" "}
                        {c.genres.slice(0, 3).join(", ") || c.type}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold">
                        <span className="inline-flex items-center gap-1 text-white">
                          <Star size={11} className="fill-[#FBBF24] text-[#FBBF24]" aria-hidden />
                          {ratingText}
                        </span>
                        <span className="text-[#A8A1B5]">· {c.status || "Ongoing"}</span>
                      </div>
                    </div>
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
