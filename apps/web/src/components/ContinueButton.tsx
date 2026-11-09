"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/** Shows "Continue reading" when the signed-in reader has saved progress in this comic. */
export default function ContinueButton({ comicId, slug }: { comicId: string; slug: string }) {
  const [target, setTarget] = useState<{ id: string; number: number; displayNumber?: string } | null>(null);
  useEffect(() => {
    api<{ comic: { id: string }; chapter: { id: string; number: number; displayNumber?: string } }[]>("/user/history", { credentials: "include", cache: "no-store" })
      .then((h) => { const m = h.find((x) => x.comic.id === comicId); if (m) setTarget(m.chapter); }).catch(() => {});
  }, [comicId]);
  if (!target) return null;
  return <Link href={`/comics/${slug}/chapter/${target.id}`} className="rounded-md bg-secondary px-5 py-2.5 font-semibold">Continue reading (Ch. {target.displayNumber ?? target.number})</Link>;
}
