"use client";
import { useLibrary } from "./LibraryProvider";

export default function BookmarkButton({ comicId, className = "", fill = false }: { comicId: string; className?: string; fill?: boolean }) {
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
    <button
      type="button"
      onClick={() => void lib.toggleBookmark(comicId)}
      aria-pressed={on}
      className="pillbtn ghost"
      style={{ padding: "11px 20px", fontSize: 13.5, marginLeft: 0 }}
    >
      {on ? "✓ Bookmarked" : lib.signedIn || !lib.ready ? "Bookmark" : "Log in to bookmark"}
    </button>
  );
}
