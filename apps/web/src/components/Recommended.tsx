"use client";
import { useEffect, useState } from "react";
import ComicCard from "./ComicCard";
import { Comic, toComic } from "@/lib/comics";
import { api } from "@/lib/api";

export default function Recommended() {
  const [items, setItems] = useState<Comic[]>([]);
  useEffect(() => {
    api<{ personalized: boolean; items: any[] }>("/recommendations", { credentials: "include", cache: "no-store" })
      .then((r) => r.personalized && setItems(r.items.map((a) => toComic(a)))).catch(() => {});
  }, []);
  if (!items.length) return null;
  return (
    <section className="mt-10"><h2 className="mb-4 text-xl font-bold">Recommended for you</h2>
      <div className="scroll-row">{items.map((c) => <div key={c.slug} className="w-36 sm:w-44"><ComicCard comic={c} /></div>)}</div></section>
  );
}
