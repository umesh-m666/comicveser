import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Star } from "lucide-react";
import { Cover } from "@/components/ComicCard";
import ReportButton from "@/components/ReportButton";
import ContinueButton from "@/components/ContinueButton";
import Track from "@/components/Track";
import ReviewsSection from "@/components/ReviewsSection";
import BookmarkButton from "@/components/BookmarkButton";
import ChapterList from "@/components/ChapterList";
import { getComic, latestChapter, chapterLabel } from "@/lib/comics";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getComic(params.slug);
  return c ? { title: c.title, description: c.description, alternates: { canonical: `/comics/${c.slug}` } } : { title: "Comic not found" };
}

const STATUS_STYLE: Record<string, string> = {
  Ongoing: "bg-[rgba(52,211,153,.18)] text-emerald-300", Completed: "bg-[rgba(96,165,250,.18)] text-blue-300", Hiatus: "bg-[rgba(251,191,36,.18)] text-amber-300",
};

export default async function ComicPage({ params }: Props) {
  const c = await getComic(params.slug);
  if (!c) notFound();
  const last = latestChapter(c);
  const creators = [...new Set([c.author, c.artist].filter(Boolean))].join(" · ");
  const meta: [string, string][] = [["Type", c.type], ["Year", String(c.year)], ["Author", c.author], ["Artist", c.artist], ["Chapters", String(c.chapters.length)], ["Updated", new Date(c.updatedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })]];

  return (
    <article>
      <Track type="COMIC_VIEW" comicId={c.id} />
      <div className="cv-feature rounded-2xl p-4 md:p-7">
        {c.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.coverUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 -z-10 h-full w-full scale-110 object-cover opacity-20 blur-2xl" />
        )}
        <div className="grid gap-6 md:grid-cols-[14rem_1fr] md:gap-8">
          <Cover hue={c.hue} title={c.title} src={c.coverUrl} priority className="mx-auto aspect-[2/3] w-44 shadow-2xl md:w-full" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-md bg-[rgba(147,51,234,.3)] px-2 py-0.5 text-[#e9d5ff]">{c.type}</span>
              <span className={`rounded-md px-2 py-0.5 ${STATUS_STYLE[c.status] ?? "bg-black/40"}`}>{c.status}</span>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold leading-tight md:text-4xl">{c.title}</h1>
            {c.altTitle && <p className="mt-1 text-sm text-muted">{c.altTitle}</p>}
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5 font-semibold"><Star size={16} className="fill-yellow-300 text-yellow-300" aria-hidden />{c.rating > 0 ? c.rating.toFixed(1) : "Not rated"}<span className="font-normal text-muted">/ 10</span></span>
              {creators && <span className="text-muted">By {creators}</span>}
              <span className="text-muted">{c.chapters.length} chapters</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.genres.map((g) => <Link key={g} href={`/browse?genre=${encodeURIComponent(g)}`} className="cv-chip">{g}</Link>)}
            </div>
            <p className="mt-4 max-w-prose text-sm leading-7 text-[#cfc9d8]">{c.description}</p>
            {c.chapters.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <ContinueButton comicId={c.id} slug={c.slug} />
                <Link href={`/comics/${c.slug}/chapter/${c.chapters[0].id}`} className="cv-btn cv-btn-primary">Start Reading</Link>
                <Link href={`/comics/${c.slug}/chapter/${last.id}`} className="cv-btn">Latest: Ch. {chapterLabel(last)}</Link>
                <BookmarkButton comicId={c.id} />
                <ReportButton comicId={c.id} />
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap items-center gap-2"><p className="text-sm text-muted">No chapters published yet.</p><BookmarkButton comicId={c.id} /><ReportButton comicId={c.id} /></div>
            )}
            <dl className="mt-6 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {meta.map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}
            </dl>
          </div>
        </div>
      </div>

      <ChapterList slug={c.slug} comicId={c.id} chapters={c.chapters} />
      <ReviewsSection comicId={c.id} />
    </article>
  );
}

export function generateStaticParams() {
  return [{ slug: 'default' }];
}
