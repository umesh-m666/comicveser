"use client";
import { useLibrary } from "./LibraryProvider";

export default function BookmarkButton({ comicId }: { comicId: string }) {
  const lib = useLibrary();
  const on = lib.isBookmarked(comicId);
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
