"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "@/components/AuthProvider";

const key = (comicId: string) => `cv:read:${comicId}`;
const readLocal = (comicId: string): string[] => { try { const v = JSON.parse(localStorage.getItem(key(comicId)) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const writeLocal = (comicId: string, ids: string[]) => { try { localStorage.setItem(key(comicId), JSON.stringify(ids.slice(-3000))); } catch { /* private mode: server copy still applies */ } };

/**
 * Which chapters of a comic the reader has finished. Signed-in readers use the server (so the purple "read" state survives
 * refreshes, new devices and logging out and back in); anonymous readers get the same behaviour from this browser's storage.
 * Pass null to opt out (e.g. external-source chapters that have no ComicVerse chapter row).
 */
export function useReadChapters(comicId: string | null) {
  const { user, status } = useAuth();
  const userId = user?.id ?? null;
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!comicId || status === "loading") return;
    let live = true;
    if (!userId) { setIds(new Set(readLocal(comicId))); setReady(true); return; }
    api<{ chapterIds: string[] }>(`/user/comics/${comicId}/read-chapters`, { credentials: "include", cache: "no-store" })
      .then((r) => { if (live) setIds(new Set(r.chapterIds)); })
      .catch(() => { if (live) setIds(new Set(readLocal(comicId))); })
      .finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, [comicId, userId, status]);

  const mark = useCallback(async (chapterId: string) => {
    if (!comicId) return;
    setIds((prev) => (prev.has(chapterId) ? prev : new Set(prev).add(chapterId)));
    writeLocal(comicId, Array.from(new Set([...readLocal(comicId), chapterId])));
    if (!userId) return;
    const send = () => api(`/user/chapters/${encodeURIComponent(chapterId)}/read`, { method: "POST", credentials: "include" });
    try { await send(); } catch { setTimeout(() => { send().catch(() => {}); }, 3000); } // one retry on a flaky connection
  }, [comicId, userId]);

  return useMemo(() => ({ ids, ready, isRead: (id: string) => ids.has(id), mark }), [ids, ready, mark]);
}
