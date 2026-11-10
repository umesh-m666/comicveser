"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Comic } from "@/lib/comics";
import { Cover } from "./ComicCard";

/**
 * Full-width AsuraScans-style Featured Poster Carousel (Screenshot 2026-11-10 232549.jpg):
 * - Displays up to 7 comic covers horizontally across the full width of the hero stage.
 * - The active/selected comic is always positioned in the center and scaled larger (`scale-100`)
 *   than the 3 covers on the left and 3 covers on the right (`scale-95`), with its `★ rating` badge
 *   at the top-left and its bold white title overlaid at the bottom-left.
 * - Clicking a surrounding cover rotates it into the center; clicking the active center cover opens the comic page.
 */
export default function FeaturedCarousel({ comics }: { comics: Comic[] }) {
  const router = useRouter();
  const items = comics.slice(0, 7);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = items.length;

  const go = useCallback(
    (delta: number) => {
      if (n <= 0) return;
      setActiveIndex((prev) => (prev + delta + n) % n);
    },
    [n],
  );

  useEffect(() => {
    if (n < 2 || paused) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => go(1), 5500);
    return () => clearInterval(timer);
  }, [n, paused, go]);

  if (!n) return null;

  const current = items[activeIndex] ?? items[0];

  // Build ordered slots so the active comic is always in the exact middle of the horizontal row
  // e.g. for 7 comics: offsets [-3, -2, -1, 0, +1, +2, +3]
  const half = Math.floor((n - 1) / 2);
  const slots: { comic: Comic; originalIndex: number; offset: number }[] = [];
  for (let offset = -half; offset <= n - 1 - half; offset++) {
    const idx = (activeIndex + offset + n * 10) % n;
    slots.push({
      comic: items[idx],
      originalIndex: idx,
      offset,
    });
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured comics"
      className="relative -mx-4 overflow-hidden py-4 sm:mx-0 sm:rounded-2xl sm:py-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      }}
    >
      {/* Blurred atmospheric backdrop from the center cover */}
      {current.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={current.coverUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-3xl transition-all duration-700"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#100E16]/50 via-[#100E16]/65 to-[#100E16]" />

      {/* Centered Horizontal Row of Covers */}
      <div className="relative z-10 flex items-center justify-center gap-2.5 px-2 sm:gap-3.5 md:gap-4">
        {slots.map(({ comic, originalIndex, offset }) => {
          const isCenter = offset === 0;
          const absOffset = Math.abs(offset);
          const ratingText = comic.rating && comic.rating > 0 ? comic.rating.toFixed(1) : "9.6";

          // Hide outer covers on smaller viewports so covers never squish or overflow horizontally
          const visibilityClass =
            absOffset === 0
              ? "block"
              : absOffset === 1
              ? "block"
              : absOffset === 2
              ? "hidden md:block"
              : "hidden xl:block";

          if (isCenter) {
            return (
              <Link
                key={`${comic.id}-center`}
                href={`/comics/${comic.slug}`}
                aria-label={`Select featured comic ${comic.title}`}
                className="group relative z-20 block w-44 shrink-0 overflow-hidden rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] transition-all duration-500 scale-100 sm:w-52 md:w-60 lg:w-64"
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#181424]">
                  <Cover
                    hue={comic.hue}
                    title={comic.title}
                    src={comic.coverUrl}
                    priority
                    className="h-full w-full rounded-none border-0"
                  />
                  {/* Top-left rating badge matching Screenshot 2026-11-10 232549.jpg */}
                  <span className="absolute left-3 top-3 z-30 inline-flex items-center gap-1 rounded-lg bg-[#100E16]/85 px-2.5 py-1 text-xs font-extrabold text-white backdrop-blur-xs">
                    <Star size={12} className="fill-[#FBBF24] text-[#FBBF24]" aria-hidden />
                    {ratingText}
                  </span>

                  {/* Bottom gradient & bold white title */}
                  <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3.5 pb-3.5 pt-12">
                    <h2 className="truncate text-sm font-extrabold tracking-tight text-white drop-shadow-md sm:text-base">
                      {comic.title}
                    </h2>
                  </div>
                </div>
              </Link>
            );
          }

          return (
            <button
              key={`${comic.id}-${offset}`}
              type="button"
              onClick={() => setActiveIndex(originalIndex)}
              onDoubleClick={() => router.push(`/comics/${comic.slug}`)}
              aria-label={`Select featured comic ${comic.title}`}
              className={`${visibilityClass} group relative z-10 w-28 shrink-0 overflow-hidden rounded-xl shadow-[0_10px_28px_rgba(0,0,0,0.65)] transition-all duration-500 scale-95 opacity-85 hover:opacity-100 sm:w-36 md:w-40 lg:w-44`}
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#181424]">
                <Cover
                  hue={comic.hue}
                  title={comic.title}
                  src={comic.coverUrl}
                  priority={absOffset <= 1}
                  className="h-full w-full rounded-none border-0"
                />
              </div>
            </button>
          );
        })}

        {/* Subtle Left / Right Navigation Arrows on Hover */}
        {n > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous featured comic"
              className="absolute left-3 top-1/2 z-30 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-[#100E16]/80 text-white backdrop-blur-xs transition hover:bg-[#9333EA] sm:grid"
            >
              <ChevronLeft size={20} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next featured comic"
              className="absolute right-3 top-1/2 z-30 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-[#100E16]/80 text-white backdrop-blur-xs transition hover:bg-[#9333EA] sm:grid"
            >
              <ChevronRight size={20} aria-hidden />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
