"use client";
import { Bookmark } from "lucide-react";
import { useLibrary } from "./LibraryProvider";

export default function BookmarkButton({ comicId }: { comicId: string }) {
  const lib = useLibrary();
  const on = lib.isBookmarked(comicId);
  return (
    <button type="button" onClick={() => void lib.toggleBookmark(comicId)} aria-pressed={on} className="cv-btn">
      <Bookmark size={17} className={on ? "fill-[#c084fc] text-[#c084fc]" : ""} aria-hidden />
      {on ? "Bookmarked" : lib.signedIn || !lib.ready ? "Bookmark" : "Log in to bookmark"}
    </button>
  );
}
