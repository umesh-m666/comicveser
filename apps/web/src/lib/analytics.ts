import { API } from "./api";
export type Evt = { type: "PAGE_VIEW" | "COMIC_VIEW" | "CHAPTER_VIEW" | "SEARCH" | "READ_SESSION"; comicId?: string; chapterId?: string; path?: string; query?: string };
export const getConsent = () => { try { return localStorage.getItem("cv:consent"); } catch { return null; } };
/** Sends an event only if the visitor accepted analytics. Failures are ignored on purpose. */
export function track(e: Evt) {
  if (getConsent() !== "granted") return;
  fetch(`${API}/analytics/event`, { method: "POST", credentials: "include", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(e) }).catch(() => {});
}
