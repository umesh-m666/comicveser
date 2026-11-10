import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import ComicCard from "@/components/ComicCard";
import FeaturedCarousel from "@/components/FeaturedCarousel";
import PopularTabs from "@/components/PopularTabs";
import LatestUpdates from "@/components/LatestUpdates";
import EmptyState from "@/components/EmptyState";
import { allComics, popularComics } from "@/lib/comics";
import type { Comic } from "@/lib/comics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Section({
  title,
  subtitle,
  href,
  children,
  className = "mt-12",
}: {
  title: string;
  subtitle?: string;
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="cv-section-title text-xl font-bold text-white md:text-2xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-[#A8A1B5]">{subtitle}</p>}
        </div>
        {href && (
          <Link
            href={href}
            className="group inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#C084FC] hover:text-white sm:text-sm"
          >
            View all{" "}
            <ArrowUpRight
              size={15}
              className="transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function Home() {
  const [comics, weekly, monthly, allTime] = await Promise.all([
    allComics(),
    popularComics("weekly"),
    popularComics("monthly"),
    popularComics("all"),
  ]);

  const activeComics: Comic[] = comics;
  const byViews = [...activeComics].sort((a, b) => b.views - a.views);
  const featured = byViews.slice(0, 7);
  const latest = [...activeComics]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 10);
  const trending = byViews.slice(0, 10);
  const added = [...activeComics]
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
    .slice(0, 10);

  const popular = {
    weekly: weekly.length ? weekly : byViews,
    monthly: monthly.length ? monthly : byViews,
    all: allTime.length ? allTime : byViews,
  };

  return (
    <div className="space-y-12">
      <h1 className="sr-only">ComicVerse – Read Manga, Manhwa, Manhua and Webtoons</h1>

      {/* 1. Featured Comic Poster Carousel */}
      {featured.length ? (
        <FeaturedCarousel comics={featured} />
      ) : (
        <EmptyState
          title="No published comics available yet"
          body="Approve or publish series from the Admin Panel to feature them on the homepage."
        />
      )}

      {/* 2. Latest Chapter Updates (2-col desktop, 1-col mobile) */}
      <Section
        title="Latest Chapter Updates"
        subtitle="Freshly released chapters from ongoing series"
        href="/browse?sort=updated"
      >
        <LatestUpdates comics={latest} />
      </Section>

      {/* 3. Trending Comics (Large Poster Cards) */}
      <Section
        title="Trending Comics"
        subtitle="Most-read series across ComicVerse right now"
        href="/browse?sort=popular"
      >
        {trending.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {trending.slice(0, 10).map((c, i) => (
              <ComicCard key={c.slug} comic={c} priority={i < 5} />
            ))}
          </div>
        ) : (
          <EmptyState title="Nothing trending yet" />
        )}
      </Section>

      {/* 4. Popular Comics (Ranked List with Weekly, Monthly, All Time Filters) */}
      <Section
        title="Popular Comics"
        subtitle="Top-ranked series by reader activity"
        href="/browse?sort=popular"
      >
        <PopularTabs lists={popular} />
      </Section>

      {/* 5. Recently Added */}
      <Section
        title="Recently Added"
        subtitle="New manga, manhwa, and manhua added to the catalogue"
        href="/browse?sort=added"
      >
        {added.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {added.map((c) => (
              <ComicCard key={c.slug} comic={c} />
            ))}
          </div>
        ) : (
          <EmptyState title="No new series yet" />
        )}
      </Section>
    </div>
  );
}
