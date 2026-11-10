"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "./AuthProvider";

export interface ReadingProgress { chapterId: string; number: number; displayNumber?: string; imageIndex: number }
type Ctx = {
  /** True once the signed-in reader's bookmarks and history have been fetched (or there is nobody to fetch for). */
  ready: boolean;
  signedIn: boolean;
  isBookmarked: (comicId: string) => boolean;
  toggleBookmark: (comicId: string) => Promise<void>;
  progressFor: (comicId: string) => ReadingProgress | null;
};
const LibraryContext = createContext<Ctx | null>(null);

const EMPTY: Ctx = { ready: true, signedIn: false, isBookmarked: () => false, toggleBookmark: async () => {}, progressFor: () => null };
export const useLibrary = (): Ctx => useContext(LibraryContext) ?? EMPTY;

/**
 * One shared fetch of the reader's bookmarks and reading history, so a grid of 24 comic cards makes two requests
 * instead of 48. Anonymous visitors cause no requests at all.
 */
export default function LibraryProvider({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();
  const [marks, setMarks] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Map<string, ReadingProgress>>(new Map());
  const [ready, setReady] = useState(false);
  const userId = user?.id ?? null;
  const [version, setVersion] = useState(0);
  const marksRef = useRef(marks); marksRef.current = marks;

  // Pages that change bookmarks themselves (the Bookmarks page) announce it so every card's bookmark icon stays in sync.
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener("cv:bookmarks", bump);
    return () => window.removeEventListener("cv:bookmarks", bump);
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!userId) { setMarks(new Set()); setHistory(new Map()); setReady(true); return; }
    let live = true;
    (async () => {
      const ids = new Set<string>();
      try {
        for (let page = 1; page <= 10; page++) {
          const r = await api<{ total: number; items: { comic: { id: string } }[] }>(`/user/bookmarks?page=${page}`, { credentials: "include", cache: "no-store" });
          r.items.forEach((b) => ids.add(b.comic.id));
          if (!r.items.length || ids.size >= r.total) break;
        }
      } catch { /* bookmarks are optional UI; never block the page */ }
      const hist = new Map<string, ReadingProgress>();
      try {
        const h = await api<{ comic: { id: string }; chapter: { id: string; number: number; displayNumber?: string }; imageIndex: number }[]>("/user/history", { credentials: "include", cache: "no-store" });
        h.forEach((x) => hist.set(x.comic.id, { chapterId: x.chapter.id, number: x.chapter.number, displayNumber: x.chapter.displayNumber, imageIndex: x.imageIndex }));
      } catch { /* same */ }
      if (live) { setMarks(ids); setHistory(hist); setReady(true); }
    })();
    return () => { live = false; };
  }, [userId, status, version]);

  const toggleBookmark = useCallback(async (comicId: string) => {
    if (!userId) { router.push("/login"); return; }
    const wasOn = marksRef.current.has(comicId);
    const apply = (on: boolean) => setMarks((prev) => { const n = new Set(prev); if (on) n.add(comicId); else n.delete(comicId); return n; });
    apply(!wasOn); // optimistic
    try {
      if (wasOn) await api(`/user/bookmarks/${comicId}`, { method: "DELETE", credentials: "include" });
      else await api("/user/bookmarks", { method: "POST", json: { comicId }, credentials: "include" });
    } catch (e) {
      apply(wasOn);
      if (e instanceof ApiError && e.status === 401) router.push("/login");
    }
  }, [userId, router]);

  const value = useMemo<Ctx>(() => ({
    ready, signedIn: !!userId,
    isBookmarked: (id) => marks.has(id),
    toggleBookmark,
    progressFor: (id) => history.get(id) ?? null,
  }), [ready, userId, marks, history, toggleBookmark]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
