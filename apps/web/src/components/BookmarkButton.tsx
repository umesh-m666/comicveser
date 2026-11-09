"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { ApiError, api } from "@/lib/api";

export default function BookmarkButton({ comicId }: { comicId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "anon" | "on" | "off">("loading");
  const [err, setErr] = useState("");
  useEffect(() => {
    api<{ bookmarked: boolean }>(`/user/bookmarks/${comicId}`, { credentials: "include" })
      .then((r) => setState(r.bookmarked ? "on" : "off"))
      .catch((e) => setState(e instanceof ApiError && e.status === 401 ? "anon" : "off"));
  }, [comicId]);

  async function toggle() {
    if (state === "anon") return router.push("/login");
    if (state === "loading") return;
    const next = state === "on" ? "off" : "on"; const prev = state; setState(next); setErr("");
    try {
      if (next === "on") await api("/user/bookmarks", { method: "POST", json: { comicId }, credentials: "include" });
      else await api(`/user/bookmarks/${comicId}`, { method: "DELETE", credentials: "include" });
    } catch (e) { setState(prev); setErr(e instanceof ApiError ? e.message : "Couldn't update bookmark."); }
  }
  return (
    <span>
      <button onClick={toggle} aria-pressed={state === "on"} className="flex items-center gap-2 rounded-md border border-line px-4 py-2.5 font-semibold hover:bg-card">
        <Bookmark size={18} className={state === "on" ? "fill-primary text-primary" : ""} aria-hidden />
        {state === "on" ? "Bookmarked" : state === "anon" ? "Log in to bookmark" : "Bookmark"}
      </button>
      {err && <span role="alert" className="ml-2 text-sm text-danger">{err}</span>}
    </span>
  );
}
