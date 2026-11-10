"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { TABS, tabIndex } from "@/lib/nav";

/** Desktop primary navigation: Home, Manga, Browse, Bookmarks. */
export function DesktopLinks() {
  const path = usePathname();
  const active = tabIndex(path);
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 text-sm lg:flex">
      {TABS.map((t, i) => (
        <Link
          key={t.href}
          href={t.href}
          className="cv-nav-link"
          aria-current={active === i ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Search: inline field on desktop (`xl`) and expandable bar on smaller viewports. */
export function SearchControl() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open]);
  return (
    <>
      <form action="/browse" role="search" className="hidden min-w-0 xl:block">
        <label htmlFor="hq" className="sr-only">
          Search comics
        </label>
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8A1B5]"
            aria-hidden
          />
          <input
            id="hq"
            name="q"
            placeholder="Search series, authors..."
            className="cv-search w-60 py-2 pl-9 pr-3.5 text-sm 2xl:w-72"
          />
        </div>
      </form>
      <button
        type="button"
        className="cv-iconbtn xl:hidden"
        aria-label={open ? "Close search" : "Search"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X size={18} aria-hidden /> : <Search size={18} aria-hidden />}
      </button>
      {open && (
        <form action="/browse" role="search" className="cv-searchbar xl:hidden">
          <label htmlFor="hq-m" className="sr-only">
            Search comics
          </label>
          <div className="relative mx-auto max-w-2xl">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#A8A1B5]"
              aria-hidden
            />
            <input
              ref={input}
              id="hq-m"
              name="q"
              type="search"
              enterKeyHint="search"
              placeholder="Search comics, manga, manhwa..."
              className="cv-search w-full py-2.5 pl-11 pr-4 text-sm"
            />
          </div>
        </form>
      )}
    </>
  );
}
