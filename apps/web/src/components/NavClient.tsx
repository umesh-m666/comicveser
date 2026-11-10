"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Search, X } from "lucide-react";
import { RESOURCES, TABS, tabIndex } from "@/lib/nav";
import { useDismiss } from "@/lib/useDismiss";

function ResourcesMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  useEffect(() => setOpen(false), [path]);
  const active = RESOURCES.some((r) => path === r.href || path?.startsWith(r.href + "/"));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="cv-nav-link inline-flex items-center gap-1"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-current={active ? "page" : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        Resources <ChevronDown size={14} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <div role="menu" aria-label="Resources" data-open={open} className="cv-menu cv-menu-left">
        {RESOURCES.map((r) => (
          <Link key={r.href} role="menuitem" href={r.href} tabIndex={open ? 0 : -1} className="cv-menu-item">
            {r.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Desktop primary links: Home, Manga, Browse, Resources, Bookmarks. Below `lg` the bottom bar provides the same destinations. */
export function DesktopLinks() {
  const path = usePathname();
  const active = tabIndex(path);
  const link = (i: number) => {
    const t = TABS[i];
    return (
      <Link key={t.href} href={t.href} className="cv-nav-link" aria-current={active === i ? "page" : undefined}>
        {t.label}
      </Link>
    );
  };
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 text-sm lg:flex">
      {link(0)}
      {link(1)}
      {link(2)}
      <ResourcesMenu />
      {link(4)}
    </nav>
  );
}

/** Search: inline field on desktop (`xl`) and expandable bar on smaller screens with matching #100E16 / #211B2D palette. */
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
        <label htmlFor="hq" className="sr-only">Search comics</label>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A1B5]" aria-hidden />
          <input id="hq" name="q" placeholder="Search comics..." className="cv-search w-56 py-2 pl-9 pr-3 text-sm 2xl:w-64" />
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
          <label htmlFor="hq-m" className="sr-only">Search comics</label>
          <div className="relative mx-auto max-w-2xl">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#A8A1B5]" aria-hidden />
            <input
              ref={input}
              id="hq-m"
              name="q"
              type="search"
              enterKeyHint="search"
              placeholder="Search comics, manga, manhwa..."
              className="cv-search w-full py-3 pl-11 pr-4 text-base"
            />
          </div>
        </form>
      )}
    </>
  );
}
