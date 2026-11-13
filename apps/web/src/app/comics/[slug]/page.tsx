import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ComicCard, { Cover } from "@/components/ComicCard";
import ReportButton from "@/components/ReportButton";
import ContinueButton from "@/components/ContinueButton";
import Track from "@/components/Track";
import ReviewsSection from "@/components/ReviewsSection";
import BookmarkButton from "@/components/BookmarkButton";
import ChapterList from "@/components/ChapterList";
import { allComics, chapterLabel, getComic, latestChapter, timeAgo } from "@/lib/comics";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getComic(params.slug);
  return c
    ? {
        title: c.title,
        description: c.description,
        alternates: { canonical: `/comics/${c.slug}` },
      }
    : { title: "Comic not found" };
}

export default async function ComicPage({ params }: Props) {
  const [c, catalogue] = await Promise.all([getComic(params.slug), allComics()]);
  if (!c) notFound();

  const last = latestChapter(c);
  const creators = [...new Set([c.author, c.artist].filter(Boolean))].join(" · ");
  const ratingText = c.rating > 0 ? c.rating.toFixed(1) : "9.5";
  const alsoLike = catalogue.filter((x) => x.id !== c.id).slice(0, 5);

  return (
    <article>
      <Track type="COMIC_VIEW" comicId={c.id} />

      {/* Asura Blurred Cover Banner Hero (.detail-hero) */}
      <div className="detail-hero" data-layer="Hero / Blurred Cover Banner">
        {c.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.coverUrl} alt="" referrerPolicy="no-referrer" className="bgimg" />
        )}
        <div className="wrap">
          <div className="cov">
            <Cover
              hue={c.hue}
              title={c.title}
              src={c.coverUrl}
              priority
              className="h-full w-full rounded-none border-0"
            />
          </div>

          <div style={{ minWidth: 0 }}>
            <div className="mb-1 flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <span className="tag purple">{(c.status || "Ongoing").toUpperCase()}</span>
              <span className="tag grey">{(c.type || "Manhwa").toUpperCase()}</span>
            </div>

            <h1>{c.title}</h1>
            {c.altTitle && (
              <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "0 0 8px" }}>
                {c.altTitle}
              </p>
            )}

            <div className="meta-line">
              <span>
                ★ <b>{ratingText}</b>
              </span>
              <span>
                Status <b>{c.status}</b>
              </span>
              <span>
                Chapters <b>{c.chapters.length}</b>
              </span>
              {creators && (
                <span>
                  By <b>{creators}</b>
                </span>
              )}
              <span suppressHydrationWarning>
                Updated <b>{timeAgo(c.updatedAt) || new Date(c.updatedAt).toLocaleDateString("en-IN")}</b>
              </span>
            </div>

            <div className="genre-chips">
              {c.genres.map((g) => (
                <Link key={g} href={`/browse?genre=${encodeURIComponent(g)}`} className="chip">
                  {g}
                </Link>
              ))}
            </div>

            <p className="synop">{c.description}</p>

            <div className="detail-actions">
              {c.chapters.length > 0 ? (
                <>
                  <ContinueButton comicId={c.id} slug={c.slug} />
                  <Link
                    href={`/comics/${c.slug}/chapter/${c.chapters[0].id}`}
                    className="pillbtn"
                    style={{ padding: "11px 22px", fontSize: 13.5, marginLeft: 0 }}
                  >
                    ▶ Start Reading — Ch. {chapterLabel(c.chapters[0])}
                  </Link>
                  <Link
                    href={`/comics/${c.slug}/chapter/${last.id}`}
                    className="pillbtn ghost"
                    style={{ padding: "11px 20px", fontSize: 13.5, marginLeft: 0 }}
                  >
                    Latest: Ch. {chapterLabel(last)}
                  </Link>
                </>
              ) : (
                <span style={{ color: "var(--muted)", fontSize: 13 }}>
                  No chapters published yet.
                </span>
              )}
              <BookmarkButton comicId={c.id} />
              <ReportButton targetType="comic" targetId={c.id} comicId={c.id} label="★ Report / Feedback" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Panels */}
      <div className="wrap" style={{ paddingBottom: 34 }}>
        <ChapterList slug={c.slug} comicId={c.id} chapters={c.chapters} />

        <ReviewsSection comicId={c.id} />

        {alsoLike.length > 0 && (
          <section className="panel" data-layer="You May Also Like">
            <div className="panel-h2">
              <span className="ic" aria-hidden="true">
                ★
              </span>
              <h2>You May Also Like</h2>
              <Link href="/browse" className="pillbtn" style={{ marginLeft: "auto" }}>
                All Comics
              </Link>
            </div>
            <div className="trend-row" id="alsoRow">
              {alsoLike.map((item) => (
                <ComicCard key={item.slug} comic={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}

export function generateStaticParams() {
  return [{ slug: "default" }];
}
