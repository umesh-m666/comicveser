"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TABS, tabIndex } from "@/lib/nav";
import { BrowseQuery, Comic, browseComics } from "@/lib/comics";
import { Cover } from "./ComicCard";

const TRENDING_CHIPS = [
  "Action",
  "Fantasy",
  "Adventure",
  "Martial Arts",
  "Reincarnation",
  "Sci-Fi",
];

/** Desktop primary navigation: Home, Manga, Browse, Bookmarks. */
export function DesktopLinks() {
  const path = usePathname();
  const active = tabIndex(path);
  return (
    <nav
      aria-label="Main"
      className="s-nav"
      data-layer="Desktop Nav / Home · Manga · Browse · Bookmarks"
    >
      {TABS.map((t, i) => {
        const isOn = active === i || (t.href === "/manga" && path?.startsWith("/comics/"));
        return (
          <Link
            key={t.href}
            href={t.href}
            className={isOn ? "on" : undefined}
            aria-current={isOn ? "page" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Full-width Asura search bar under the purple header (triggered by clicking the search icon or pressing Ctrl+K).
 */
export function SearchControl() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(false);
  const path = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      const query: BrowseQuery = {
        q: q.trim() || undefined,
        sort: "popular",
        page: "1",
      };
      browseComics(query)
        .then((res) => {
          if (active) {
            setResults((res.items ?? []).slice(0, 6));
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) {
            setResults([]);
            setLoading(false);
          }
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, q]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    setOpen(false);
    router.push(trimmed ? `/browse?q=${encodeURIComponent(trimmed)}` : "/browse");
  };

  return (
    <>
      <button
        type="button"
        className="icon-btn search-trigger"
        aria-label={open ? "Cancel search" : "Search comics"}
        aria-expanded={open}
        title="Search (Ctrl+K)"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.8-3.8" />
          </svg>
        )}
      </button>

      {open && (
        <div
          className="full-search"
          data-layer="Full Search / Open State"
          style={{ position: "absolute", left: 0, right: 0, top: "100%" }}
        >
          <div className="wrap">
            <form onSubmit={handleSubmit} role="search" className="fs-bar">
              <label className="fs-pill">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.8-3.8" />
                </svg>
                <input
                  ref={inputRef}
                  name="q"
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search comics, manga, manhwa..."
                  aria-label="Search comics, manga, manhwa"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => {
                      setQ("");
                      inputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="grid h-6 w-6 place-items-center rounded-full bg-[#2b2839] text-xs font-bold text-[#cfcbe0] hover:bg-[#9333ea] hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </label>
              <button
                type="button"
                className="fs-cancel"
                aria-label="Cancel search"
                onClick={() => setOpen(false)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M5 5l14 14M19 5L5 19" />
                </svg>
              </button>
            </form>

            <div className="fs-label">
              {q.trim() ? `Results for “${q.trim()}”` : "Trending searches"}
            </div>
            <div className="fs-chips">
              {TRENDING_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setQ(chip);
                    inputRef.current?.focus();
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>

            <div className="fs-results">
              {loading && results.length === 0 ? (
                <div className="fs-empty">Searching catalogue…</div>
              ) : results.length > 0 ? (
                results.map((c) => {
                  const ratingText = c.rating && c.rating > 0 ? c.rating.toFixed(1) : "9.5";
                  const count = c.chapterCount || c.chapters.length;
                  return (
                    <Link
                      key={c.id}
                      href={`/comics/${c.slug}`}
                      className="fs-item"
                      onClick={() => setOpen(false)}
                    >
                      <Cover
                        hue={c.hue}
                        title={c.title}
                        src={c.coverUrl}
                        className="fs-thumb !p-0.5"
                      />
                      <span style={{ minWidth: 0 }}>
                        <span className="ft">{c.title}</span>
                        <span className="fm">
                          {count} Chapters · {c.status || "Ongoing"}
                        </span>
                      </span>
                      <span className="fr">★ {ratingText}</span>
                    </Link>
                  );
                })
              ) : (
                <div className="fs-empty">
                  {q.trim()
                    ? `No comics match “${q.trim()}”. Press Enter to search the full catalogue.`
                    : "Type a title above or pick a chip to search comics."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function BackToTopButton() {
  return (
    <button
      type="button"
      className="topbtn"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      ↑
    </button>
  );
}
