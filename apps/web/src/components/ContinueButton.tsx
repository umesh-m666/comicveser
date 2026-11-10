"use client";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { useLibrary } from "./LibraryProvider";

/** Shows "Continue reading" when the signed-in reader has saved progress in this comic. */
export default function ContinueButton({ comicId, slug }: { comicId: string; slug: string }) {
  const p = useLibrary().progressFor(comicId);
  if (!p) return null;
  return <Link href={`/comics/${slug}/chapter/${p.chapterId}`} className="cv-btn cv-btn-primary"><BookOpen size={16} aria-hidden />Continue Ch. {p.displayNumber ?? p.number}</Link>;
}
