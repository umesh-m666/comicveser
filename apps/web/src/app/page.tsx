import Link from "next/link";
import ComicCard, { Cover } from "@/components/ComicCard";
import FeaturedCarousel from "@/components/FeaturedCarousel";
import PopularTabs from "@/components/PopularTabs";
import LatestUpdates from "@/components/LatestUpdates";
import EmptyState from "@/components/EmptyState";
import { ComicVerseMark } from "@/components/ComicVerseLogo";
import { allComics, getAnnouncements, popularComics } from "@/lib/comics";
import type { Comic } from "@/lib/comics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_ANNOUNCEMENTS = [
  {
    id: "ann-1",
    title: "Faster chapter releases & a new reader — what's new on ComicVerse",
    date: "NOV 12, 2026",
  },
  {
    id: "ann-2",
    title: "Series reviews are here — rate and review any comic",
    date: "NOV 5, 2026",
  },
  {
    id: "ann-3",
    title: "Bookmarks sync, reading history & dark reader improvements",
    date: "OCT 28, 2026",
  },
];

export default async function Home() {
  const [comics, weekly, monthly, allTime, announcements] = await Promise.all([
    allComics(),
    popularComics("weekly"),
    popularComics("monthly"),
    popularComics("all"),
    getAnnouncements(),
  ]);

  const activeComics: Comic[] = comics;
  const byViews = [...activeComics].sort((a, b) => b.views - a.views);
  const featured = byViews.slice(0, 9);
  const latest = [...activeComics]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 12);
  const trending = byViews.slice(0, 10);
  const editorPick = byViews[0] ?? activeComics[0] ?? null;

  const popular = {
    weekly: weekly.length ? weekly : byViews,
    monthly: monthly.length ? monthly : byViews,
    all: allTime.length ? allTime : byViews,
  };

  const annCards =
    announcements && announcements.length > 0
      ? announcements.slice(0, 3).map((a) => ({
          id: a.id,
          title: a.title,
          date: "LATEST UPDATE",
        }))
      : DEFAULT_ANNOUNCEMENTS;

  return (
    <div>
      <h1 className="sr-only">ComicVerse – Read Manga, Manhwa, Manhua and Webtoons</h1>

      {/* 1. Red Announcement Strip + Hero Cover Rail */}
      {featured.length ? (
        <FeaturedCarousel comics={featured} announcement={announcements?.[0] ?? null} />
      ) : (
        <div className="wrap pt-6">
          <EmptyState
            title="No published comics available yet"
            body="Approve or publish series from the Admin Panel to feature them on the homepage."
          />
        </div>
      )}

      {/* 2. Two-Column Asura Home Grid (Left: Trending Comics + Latest Updates | Right: Popular Top 10 + Editor's Pick) */}
      <div className="wrap">
        <div className="home-grid">
          <div>
            <section className="panel" data-layer="Trending Comics">
              <div className="panel-h2">
                <span className="ic" aria-hidden="true">
                  ★
                </span>
                <h2>Trending Comics</h2>
                <Link href="/browse" className="pillbtn">
                  All Comics
                </Link>
              </div>
              {trending.length ? (
                <div className="trend-row" id="trendRow">
                  {trending.slice(0, 5).map((c, i) => (
                    <ComicCard key={c.slug} comic={c} priority={i < 5} />
                  ))}
                </div>
              ) : (
                <EmptyState title="Nothing trending yet" />
              )}
            </section>

            <section className="panel" data-layer="Latest Updates">
              <div className="panel-h2">
                <h2 style={{ fontSize: 19 }}>Latest Updates</h2>
              </div>
              <LatestUpdates comics={latest} />
            </section>
          </div>

          <aside>
            <PopularTabs lists={popular} />

            {editorPick && (
              <Link
                href={`/comics/${editorPick.slug}`}
                className="editor-pick"
                data-layer="Editor's Pick Card"
              >
                <Cover
                  hue={editorPick.hue}
                  title={editorPick.title}
                  src={editorPick.coverUrl}
                  className="h-full w-full rounded-none border-0"
                />
                <div className="cap">
                  <span className="k">EDITOR&apos;S PICK</span>
                  <h3>{editorPick.title}</h3>
                  <p>A must-read recommendation from our editorial team</p>
                </div>
              </Link>
            )}
          </aside>
        </div>

        {/* 3. Announcements Section */}
        <section className="panel" data-layer="Announcements" style={{ marginBottom: 6 }}>
          <div className="panel-h2">
            <h2>Announcements</h2>
            <Link href="/profile/notifications" className="pillbtn" style={{ marginLeft: "auto" }}>
              View All
            </Link>
          </div>
          <div className="ann-grid">
            {annCards.map((a, idx) => {
              const refComic = activeComics[idx];
              return (
                <div key={a.id} className="ann-card">
                  {refComic?.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={refComic.coverUrl} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="ann-ic" aria-hidden="true">
                      <ComicVerseMark className="cv-mark-svg" />
                    </span>
                  )}
                  <div>
                    <h4>{a.title}</h4>
                    <time>{a.date}</time>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
