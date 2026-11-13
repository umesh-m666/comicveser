"use client";
import Link from "next/link";
import { useState } from "react";
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
 * Asura Popular Top 10 Sidebar Panel (.panel, .pop-tabs, .pop-item, .pop-rank, .stars):
 * Segmented Weekly | Monthly | All Time switcher + numbered rank badge (1–10) over 52x68 cover,
 * title, Genres line, and ★★★★★ rating.
 */
export default function PopularTabs({ lists }: { lists: Record<Tab, Comic[]> }) {
  const [tab, setTab] = useState<Tab>("weekly");
  const rawList = lists[tab]?.length ? lists[tab] : lists.all;
  const items = (rawList ?? []).slice(0, 10);

  return (
    <section className="panel" data-layer="Popular / Top 10" style={{ padding: "18px 20px" }}>
      <div className="panel-h2" style={{ marginBottom: 8, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
        <h2 style={{ fontSize: 17 }}>Popular</h2>
        <div className="pop-tabs" id="popTabs" role="tablist" aria-label="Popular ranking timeframe">
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
                className={selected ? "on" : undefined}
                onClick={() => setTab(k)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div id="pop-panel" role="tabpanel" aria-labelledby={`pop-${tab}`}>
        {items.length === 0 ? (
          <EmptyState
            title="No rankings available yet"
            body="Rankings update automatically as readers explore series."
          />
        ) : (
          <div id="popList">
            {items.map((c, idx) => {
              const ratingText = c.rating && c.rating > 0 ? c.rating.toFixed(1) : "9.5";
              const genresText = c.genres.slice(0, 3).join(", ") || c.type;
              return (
                <Link key={c.id} href={`/comics/${c.slug}`} className="pop-item">
                  <span className="pop-rank">
                    <Cover
                      hue={c.hue}
                      title={c.title}
                      src={c.coverUrl}
                      className="h-full w-full rounded-none border-0 !p-0.5"
                    />
                    <span className="num">{idx + 1}</span>
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <h4>{c.title}</h4>
                    <span className="g">
                      Genres: <b>{genresText}</b>
                    </span>
                    <br />
                    <span className="stars">
                      ★★★★★<b>{ratingText}</b>
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
