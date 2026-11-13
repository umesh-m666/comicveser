"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Comic, chapterLabel, latestChapter } from "@/lib/comics";
import { Cover } from "./ComicCard";

/**
 * Asura Home Hero Section:
 * 1. Red Announcement Strip (.s-strip) with megaphone icon, announcement message, READ CTA, and dismiss X button.
 * 2. Hero Cover Rail (.hero-rail) with radial purple glow, 7–9 horizontal covers (.rc) where the center cover (.rc.center)
 *    is enlarged with ★ rating badge and bottom title gradient, plus pagination dots (.rail-nav).
 */
export default function FeaturedCarousel({
  comics,
  announcement,
}: {
  comics: Comic[];
  announcement?: { id: string; title: string; body: string } | null;
}) {
  const items = comics.slice(0, 9);
  const n = items.length;
  const [railIdx, setRailIdx] = useState(() => (n > 0 ? Math.floor(n / 2) : 0));
  const [stripDismissed, setStripDismissed] = useState(false);

  const nextSlide = useCallback(() => {
    if (n < 2) return;
    setRailIdx((prev) => (prev + 1) % n);
  }, [n]);

  useEffect(() => {
    if (n < 2) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      if (!document.hidden) nextSlide();
    }, 4200);
    return () => clearInterval(timer);
  }, [n, nextSlide]);

  if (!n) return null;

  const activeComic = items[railIdx] ?? items[0];
  const latest = latestChapter(activeComic);
  const stripText = announcement?.title
    ? announcement.title
    : latest.id
    ? `New chapters drop daily — ${activeComic.title} Ch. ${chapterLabel(latest)} is live now`
    : `New chapters drop daily — ${activeComic.title} is featured on ComicVerse`;
  const stripHref = latest.id
    ? `/comics/${activeComic.slug}/chapter/${latest.id}`
    : `/comics/${activeComic.slug}`;

  return (
    <>
      {!stripDismissed && (
        <div className="s-strip" data-layer="Announcement Strip" id="newsStrip">
          <div className="wrap">
            <span className="meg" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
                <path d="M3 10v4a1 1 0 0 0 1 1h2l3.5 4.5c.4.5 1.5.2 1.5-.5V5c0-.7-1.1-1-1.5-.5L6 9H4a1 1 0 0 0-1 1zm13.5 2a3.5 3.5 0 0 0-2-3.15v6.3a3.5 3.5 0 0 0 2-3.15zM18.6 8.1a6 6 0 0 1 0 7.8c.35.3.9.28 1.22-.05a.95.95 0 0 0-.02-1.34 4.1 4.1 0 0 1 0-5.02.95.95 0 0 0 .02-1.34c-.32-.33-.87-.35-1.22-.05z" />
              </svg>
            </span>
            <span className="truncate">{stripText}</span>
            <span style={{ opacity: 0.6 }} aria-hidden="true">
              ›
            </span>
            <Link href={stripHref} className="read">
              READ
            </Link>
            <button
              type="button"
              className="x"
              aria-label="Dismiss announcement"
              onClick={() => setStripDismissed(true)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="hero-rail" data-layer="Hero / Cover Rail">
        <div className="rail" id="heroRail">
          {items.map((c, i) => {
            const isCenter = i === railIdx;
            const d = Math.abs(i - railIdx);
            const ratingText = c.rating && c.rating > 0 ? c.rating.toFixed(1) : "9.6";
            const cls = `rc${isCenter ? " center" : ""}${d > 2 ? " hide-m" : ""}`;

            if (isCenter) {
              return (
                <Link
                  key={c.id}
                  href={`/comics/${c.slug}`}
                  className={cls}
                  aria-label={`${c.title} — open comic`}
                >
                  <Cover
                    hue={c.hue}
                    title={c.title}
                    src={c.coverUrl}
                    priority
                    className="rc-cover rounded-none border-0"
                  />
                  <span className="rate">★ {ratingText}</span>
                  <span className="rt">{c.title}</span>
                </Link>
              );
            }

            return (
              <button
                key={c.id}
                type="button"
                className={cls}
                aria-label={`Select featured comic ${c.title}`}
                onClick={() => setRailIdx(i)}
              >
                <Cover
                  hue={c.hue}
                  title={c.title}
                  src={c.coverUrl}
                  priority={d <= 1}
                  className="rc-cover rounded-none border-0"
                />
              </button>
            );
          })}
        </div>

        <div className="rail-nav" id="railDots">
          {items.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className={i === railIdx ? "on" : undefined}
              aria-label={`Show ${c.title}`}
              onClick={() => setRailIdx(i)}
            />
          ))}
        </div>
      </div>
    </>
  );
}
