import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Recommended from "@/components/Recommended";
import ComicCard from "@/components/ComicCard";
import FeaturedCarousel from "@/components/FeaturedCarousel";
import PopularTabs from "@/components/PopularTabs";
import LatestUpdates from "@/components/LatestUpdates";
import EmptyState from "@/components/EmptyState";
import { allComics, getAnnouncements, popularComics } from "@/lib/comics";
import type { Comic } from "@/lib/comics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Section({ title, href, children, className = "mt-12" }: { title: string; href?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="cv-section-title text-xl font-bold md:text-2xl">{title}</h2>
        {href && <Link href={href} className="group flex items-center gap-1 text-sm font-semibold text-primary hover:text-fg">View all <ArrowUpRight size={15} className="transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden /></Link>}
      </div>
      {children}
    </section>
  );
}

const isHomeTitle = (c: Comic) => c.type === "Manhwa" || c.type === "Manhua";

export default async function Home() {
  const [comics, announcements, weekly, monthly, allTime] = await Promise.all([
    allComics(), getAnnouncements(), popularComics("weekly"), popularComics("monthly"), popularComics("all"),
  ]);
  const homeTitles = comics.filter(isHomeTitle);
  const byViews = [...homeTitles].sort((a, b) => b.views - a.views);
  const featured = byViews.slice(0, 5);
  const latest = [...homeTitles].filter((c) => c.latest).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);
  const added = [...homeTitles].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, 6);
  const popular = {
    weekly: weekly.filter(isHomeTitle), monthly: monthly.filter(isHomeTitle),
    all: allTime.filter(isHomeTitle).length ? allTime.filter(isHomeTitle) : byViews,
  };

  return (
    <>
      <h1 className="sr-only">ComicVerse – read manhwa, manhua, manga and webtoons</h1>
      {featured.length ? <FeaturedCarousel comics={featured} /> : (
        <EmptyState title="No approved manhwa/manhua available yet" body="Admins can publish approved titles here once they are ready." />
      )}

      <Section title="Trending Now" href="/browse?sort=popular">
        {byViews.length ? (
          <div className="scroll-row">{byViews.slice(0, 18).map((c, i) => <div key={c.slug} className="w-36 sm:w-40 lg:w-44"><ComicCard comic={c} priority={i < 4} /></div>)}</div>
        ) : <EmptyState title="Nothing trending yet" />}
      </Section>

      <Recommended />

      <Section title="Popular Comics">
        <PopularTabs lists={popular} />
      </Section>

      <Section title="Latest Updates" href="/browse?sort=updated">
        <LatestUpdates comics={latest} />
      </Section>

      <Section title="Recently Added" href="/browse?sort=added">
        {added.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">{added.map((c) => <ComicCard key={c.slug} comic={c} />)}</div>
        ) : <EmptyState title="No new series yet" />}
      </Section>

      {announcements.length > 0 && (
        <Section title="From the ComicVerse team">
          <ul className="grid gap-3 md:grid-cols-2">
            {announcements.map((a) => (
              <li key={a.id} className="cv-panel p-5"><p className="font-semibold">{a.title}</p><p className="mt-2 text-sm leading-6 text-muted">{a.body}</p></li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
