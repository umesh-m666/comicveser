"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowUp, Bookmark, Check, ChevronLeft, ChevronRight, ExternalLink, List, Maximize, Minimize, Settings, X } from "lucide-react";
import { useLibrary } from "./LibraryProvider";

export interface ReaderNb { id: string; number: number; displayNumber?: string; label?: string }
export type ReaderMode = "vertical" | "paged" | "rtl";
export type ReaderWidth = "narrow" | "wide" | "full";
export type Sheet = null | "chapters" | "settings";

interface Props {
  visible: boolean;
  sheet: Sheet;
  setSheet: (s: Sheet) => void;
  comicTitle: string;
  chapterLabel: string;
  backHref: string;
  prevHref: string | null;
  nextHref: string | null;
  chapters: ReaderNb[];
  currentId: string;
  /** Chapter ids this reader has finished (drives the purple "read" colour in the chapter list). */
  readIds: Set<string>;
  /** The chapter on screen has been finished. */
  chapterRead: boolean;
  /** ComicVerse comic id for the bookmark button; null hides it (external sources). */
  comicId: string | null;
  onTop: () => void;
  chHref: (id: string) => string;
  page: number;
  total: number;
  mode: ReaderMode; setMode: (m: ReaderMode) => void;
  width: ReaderWidth; setWidth: (w: ReaderWidth) => void;
  zoom: number; zoomOptions: number[]; setZoom: (z: number) => void;
  fullscreen: boolean; fullscreenSupported: boolean; toggleFullscreen: () => void;
  source?: { name: string; url?: string; groups?: string[]; chapterId?: string; readerUrl?: string };
  /** Keeps any interaction inside the controls from being treated as a tap on the artwork. */
  onInteract: () => void;
}

const seg = "min-h-[2.5rem] flex-1 rounded-lg border px-3 text-sm font-semibold";
const segOn = "border-[#a855f7] bg-[rgba(147,51,234,.35)] text-white";
const segOff = "border-white/10 bg-white/5 text-[#d4d0dc] hover:bg-white/10";

function NavBtn({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  if (!href) return <span className="rd-iconbtn" aria-disabled="true" aria-label={`${label} (not available)`} role="link">{children}</span>;
  return <Link href={href} className="rd-iconbtn" aria-label={label}>{children}</Link>;
}

export default function ReaderControls(p: Props) {
  const curRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => { if (p.sheet === "chapters") curRef.current?.scrollIntoView({ block: "center" }); }, [p.sheet]);
  const lib = useLibrary();
  const bookmarked = p.comicId ? lib.isBookmarked(p.comicId) : false;
  const pct = p.total ? Math.min(100, Math.round((p.page / p.total) * 100)) : 0;

  return (
    <div onClick={(e) => { e.stopPropagation(); p.onInteract(); }} onKeyDown={p.onInteract}>
      <header className="rd-bar rd-bar-top" data-visible={p.visible}>
        <div className="mx-auto flex max-w-3xl items-center gap-1 px-2 py-1.5">
          <Link href={p.backHref} className="rd-iconbtn" aria-label="Back to comic details"><ArrowLeft size={20} /></Link>
          <div className="min-w-0 flex-1 px-1">
            {/* Comic title is always white. The chapter label turns purple once the chapter is finished. */}
            <p className="truncate text-sm font-semibold text-white">{p.comicTitle}</p>
            <p className="cv-ch truncate text-xs font-semibold" data-state={p.chapterRead ? "read" : "unread"}>
              {p.chapterRead && <Check size={12} className="mr-1 inline -translate-y-px" aria-hidden />}{p.chapterLabel}
              {p.total > 0 && <span className="font-normal text-[#a8a1b5]"> · Page {p.page} / {p.total} · {pct}%</span>}
            </p>
          </div>
          {p.comicId && (
            <button type="button" className="rd-iconbtn" aria-pressed={bookmarked} aria-label={bookmarked ? "Remove bookmark" : "Bookmark this comic"} onClick={() => void lib.toggleBookmark(p.comicId!)}>
              <Bookmark size={20} className={bookmarked ? "fill-[#c084fc] text-[#c084fc]" : ""} aria-hidden />
            </button>
          )}
          <button type="button" className="rd-iconbtn" aria-label="Reading settings" onClick={() => p.setSheet(p.sheet === "settings" ? null : "settings")}><Settings size={20} /></button>
        </div>
      </header>

      <nav className="rd-bar rd-bar-bottom" data-visible={p.visible} aria-label="Chapter navigation">
        <div className="h-0.5 bg-white/10"><div className="h-full bg-gradient-to-r from-[#9333ea] to-[#c084fc] transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-1 px-2 py-1.5">
          <NavBtn href={p.prevHref} label="Previous chapter"><ChevronLeft size={22} /></NavBtn>
          <button type="button" onClick={() => p.setSheet(p.sheet === "chapters" ? null : "chapters")} className="flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold hover:bg-white/10" aria-label="Chapter list">
            <List size={18} aria-hidden /><span className="cv-ch" data-state={p.chapterRead ? "read" : "unread"}>{p.chapterLabel}</span>
          </button>
          <NavBtn href={p.nextHref} label="Next chapter"><ChevronRight size={22} /></NavBtn>
          <button type="button" className="rd-iconbtn" aria-label="Scroll to top" onClick={p.onTop}><ArrowUp size={20} aria-hidden /></button>
        </div>
      </nav>

      {p.sheet && (
        <>
          <div className="rd-scrim" onClick={() => p.setSheet(null)} aria-hidden />
          <div className="rd-sheet" role="dialog" aria-label={p.sheet === "chapters" ? "Chapters" : "Reading settings"}>
            <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-[rgba(20,15,28,.98)] px-4 py-2.5">
              <h2 className="text-sm font-bold">{p.sheet === "chapters" ? "Chapters" : "Reading settings"}</h2>
              <button type="button" className="rd-iconbtn !min-h-9 !min-w-9" aria-label="Close" onClick={() => p.setSheet(null)}><X size={18} /></button>
            </div>
            {p.sheet === "chapters" ? (
              <ul className="p-2">
                {p.chapters.map((c) => {
                  const cur = c.id === p.currentId;
                  const read = p.readIds.has(c.id) || (cur && p.chapterRead);
                  const state = read ? "read" : cur ? "current" : "unread";
                  return (
                    <li key={c.id}>
                      <Link ref={cur ? curRef : undefined} href={p.chHref(c.id)} aria-current={cur ? "page" : undefined} data-state={state}
                        className={`cv-ch flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-white/10 ${cur ? "font-bold" : ""}`}>
                        <span className="min-w-0 truncate">{c.label ?? `Chapter ${c.displayNumber ?? c.number}`}</span>
                        {read && <Check size={14} className="shrink-0" aria-label="Read" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="space-y-5 p-4">
                <div>
                  <p className="mb-2 text-xs font-semibold text-[#a1a1aa]">Reading mode</p>
                  <div className="flex gap-2">
                    {([["vertical", "Vertical"], ["paged", "Paged"], ["rtl", "Paged RTL"]] as const).map(([m, l]) => (
                      <button key={m} type="button" aria-pressed={p.mode === m} onClick={() => p.setMode(m)} className={`${seg} ${p.mode === m ? segOn : segOff}`}>{l}</button>
                    ))}
                  </div>
                </div>
                {p.mode === "vertical" && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-[#a1a1aa]">Page width</p>
                    <div className="flex gap-2">
                      {([["narrow", "Narrow"], ["wide", "Wide"], ["full", "Full width"]] as const).map(([w, l]) => (
                        <button key={w} type="button" aria-pressed={p.width === w} onClick={() => p.setWidth(w)} className={`${seg} ${p.width === w ? segOn : segOff}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                )}
                {(p.mode !== "vertical" || p.width !== "full") && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-[#a1a1aa]">Zoom</p>
                    <div className="flex gap-2">
                      {p.zoomOptions.map((z) => <button key={z} type="button" aria-pressed={p.zoom === z} onClick={() => p.setZoom(z)} className={`${seg} ${p.zoom === z ? segOn : segOff}`}>{z * 100}%</button>)}
                    </div>
                  </div>
                )}
                {p.fullscreenSupported && (
                  <button type="button" onClick={p.toggleFullscreen} className={`${seg} ${segOff} flex w-full items-center justify-center gap-2`}>
                    {p.fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}{p.fullscreen ? "Exit full screen" : "Full screen"} <span className="text-xs text-[#a1a1aa]">(F)</span>
                  </button>
                )}
                <p className="text-xs leading-5 text-[#a1a1aa]">Shortcuts: ← previous chapter, → next chapter, F full screen, Esc back to the comic.</p>
                {p.source && (
                  <div className="rounded-lg border border-white/10 p-3 text-xs text-[#a1a1aa]">
                    <p>External chapter from <span className="font-semibold text-white">{p.source.name}</span>{p.source.chapterId ? ` (ID: ${p.source.chapterId})` : ""}{p.source.groups?.length ? ` · ${p.source.groups.join(", ")}` : ""}</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {p.source.url && <a href={p.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#c084fc] underline">Open at source <ExternalLink size={12} /></a>}
                      {p.source.readerUrl && <Link href={p.source.readerUrl} className="text-[#c084fc] underline">Open {p.source.name} reader</Link>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
