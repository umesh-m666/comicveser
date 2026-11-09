import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Cover } from "@/components/ComicCard";
import ReportButton from "@/components/ReportButton";
import ContinueButton from "@/components/ContinueButton";
import Track from "@/components/Track";
import ReviewsSection from "@/components/ReviewsSection";
import BookmarkButton from "@/components/BookmarkButton";
import { getComic, latestChapter } from "@/lib/comics";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getComic(params.slug);
  return c ? { title: c.title, description: c.description, alternates: { canonical: `/comics/${c.slug}` } } : { title: "Comic not found" };
}

export default async function ComicPage({ params }: Props) {
  const c = await getComic(params.slug);
  if (!c) notFound();
  const oldest = false;
  const chapters = oldest ? c.chapters : [...c.chapters].reverse();
  const last = latestChapter(c);
  const meta: [string, string][] = [["Type", c.type], ["Status", c.status], ["Year", String(c.year)], ["Author", c.author], ["Artist", c.artist], ["Chapters", String(c.chapters.length)], ["Updated", new Date(c.updatedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })]];

  return (
    <article>
      <Track type="COMIC_VIEW" comicId={c.id} />
      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <Cover hue={c.hue} title={c.title} src={c.coverUrl} className="mx-auto aspect-[2/3] w-48 md:w-full" />
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{c.title}</h1>
          {c.altTitle && <p className="text-muted">{c.altTitle}</p>}
          <p className="mt-2 text-lg font-semibold">{c.rating.toFixed(1)} <span className="text-sm font-normal text-muted">/ 10 average rating</span></p>
          <div className="mt-3 flex flex-wrap gap-2">
            {c.genres.map((g) => <Link key={g} href={`/browse?genre=${encodeURIComponent(g)}`} className="rounded-full border border-line px-3 py-1 text-xs hover:border-primary">{g}</Link>)}
          </div>
          <p className="mt-4 max-w-prose text-muted">{c.description}</p>
          {c.chapters.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={`/comics/${c.slug}/chapter/${c.chapters[0].id}`} className="rounded-md bg-primary px-5 py-2.5 font-semibold">Start reading</Link>
              <Link href={`/comics/${c.slug}/chapter/${last.id}`} className="rounded-md border border-line px-5 py-2.5 font-semibold hover:bg-card">Latest: Ch. {last.displayNumber ?? last.number}</Link>
              <ContinueButton comicId={c.id} slug={c.slug} />
              <BookmarkButton comicId={c.id} />
              <ReportButton comicId={c.id} />
            </div>
          ) : <p className="mt-5 text-muted">No chapters published yet.</p>}
          <dl className="mt-6 grid max-w-xl grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {meta.map(([k, v]) => <div key={k}><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          </dl>
        </div>
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Chapters</h2>
          <Link href={`/comics/${c.slug}?order=${oldest ? "newest" : "oldest"}`} className="text-sm text-muted hover:text-fg">
            {oldest ? "Show newest first" : "Show oldest first"}
          </Link>
        </div>
        <ul className="divide-y divide-line rounded-lg border border-line bg-card">
          {chapters.map((ch) => (
            <li key={ch.id}>
              <Link href={`/comics/${c.slug}/chapter/${ch.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface">
                <span className="font-medium">{ch.title}</span>
                <span className="text-sm text-muted">{new Date(ch.publishedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <ReviewsSection comicId={c.id} />
    </article>
  );
}

export function generateStaticParams() {
  return [{ slug: 'default' }];
}
