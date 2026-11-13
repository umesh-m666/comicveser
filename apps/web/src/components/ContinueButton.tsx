"use client";
import Link from "next/link";
import { useLibrary } from "./LibraryProvider";

/** Shows "Continue Ch. X" when the signed-in reader has saved progress in this comic. */
export default function ContinueButton({ comicId, slug }: { comicId: string; slug: string }) {
  const p = useLibrary().progressFor(comicId);
  if (!p) return null;
  return (
    <Link
      href={`/comics/${slug}/chapter/${p.chapterId}`}
      className="pillbtn"
      style={{ padding: "11px 22px", fontSize: 13.5, marginLeft: 0 }}
    >
      ▶ Continue Ch. {p.displayNumber ?? p.number}
    </Link>
  );
}
