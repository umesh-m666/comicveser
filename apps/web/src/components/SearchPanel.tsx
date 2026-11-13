"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search, Star, TrendingUp, X } from "lucide-react";
import { Comic, browseComics } from "@/lib/comics";
import { Cover } from "./ComicCard";

const TRENDING = ["Action", "Fantasy", "Romance", "Regression", "Martial Arts", "Mystery"];

export default function SearchPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQ("");
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (!query) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => {
      browseComics({ q: query, page: "1" })
        .then((r) => setResults(r.items.slice(0, 6)))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-x-0 top-full z-40 px-4 pb-4 pt-2" role="search">
      <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-[#17141f] p-4 shadow-2xl shadow-black/60 md:p-5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search comics, manga, manhwa…"
              aria-label="Search comics, manga, manhwa"
              className="w-full rounded-full border-line bg-card py-3 pl-11 pr-4 text-base"
            />
          </div>
          <button type="button" onClick={onClose} aria-label="Close search" className="rounded-full border border-line p-2.5 text-muted hover:bg-card hover:text-fg">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted"><TrendingUp size={13} /> Trending</span>
          {TRENDING.map((g) => (
            <Link key={g} href={`/browse?genre=${encodeURIComponent(g)}`} onClick={onClose} className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-fg">{g}</Link>
          ))}
        </div>

        {q.trim() && (
          <div className="mt-4" aria-live="polite">
            {loading ? (
              <p className="py-3 text-sm text-muted">Searching…</p>
            ) : results.length === 0 ? (
              <p className="py-3 text-sm text-muted">No results for “{q.trim()}”. <Link href={`/browse?q=${encodeURIComponent(q.trim())}`} onClick={onClose} className="font-semibold text-primary">Browse all matches</Link></p>
            ) : (
              <ul className="divide-y divide-line">
                {results.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/comics/${c.slug}`} onClick={onClose} className="flex items-center gap-3 py-2.5 hover:bg-card/60 rounded-lg px-1">
                      <Cover hue={c.hue} title={c.title} src={c.coverUrl} className="aspect-[2/3] w-10 shrink-0 !p-1.5" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{c.title}</span>
                        <span className="mt-0.5 block text-xs text-muted">{c.type} · {c.status}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-xs font-bold"><Star size={12} className="fill-yellow-300 text-yellow-300" />{c.rating.toFixed(1)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {results.length > 0 && (
              <Link href={`/browse?q=${encodeURIComponent(q.trim())}`} onClick={onClose} className="mt-2 inline-block text-sm font-semibold text-primary hover:text-fg">See all results for “{q.trim()}” →</Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
