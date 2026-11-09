import Link from "next/link";
import { Star, ArrowUpRight, Sparkles, TrendingUp } from "lucide-react";
import Recommended from "@/components/Recommended";
import ComicCard, { Cover } from "@/components/ComicCard";
import { allComics, getAnnouncements, latestChapter } from "@/lib/comics";

export const dynamic = "force-dynamic";
export const revalidate = 0;



function Section({ title, href, children, eyebrow }: { title: string; href?: string; children: React.ReactNode; eyebrow?: string }) {
  return (
    <section className="mt-14">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div><p className="cv-eyebrow mb-1">{eyebrow ?? "Curated for you"}</p><h2 className="cv-section-title text-xl font-extrabold md:text-2xl">{title}</h2></div>
        {href && <Link href={href} className="group flex items-center gap-1 text-sm font-semibold text-primary hover:text-fg">Explore all <ArrowUpRight size={15} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link>}
      </div>
      {children}
    </section>
  );
}

export default async function Home() {
  const [comics, announcements] = await Promise.all([allComics(), getAnnouncements()]);
  const homeTitles = comics.filter((comic) => comic.type === "Manhwa" || comic.type === "Manhua");
  const byViews = [...homeTitles].sort((a, b) => b.views - a.views);
  const featured = byViews[0] ?? comics[0];
  const latest = [...homeTitles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const added = [...homeTitles].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, 6);
  const last = featured ? latestChapter(featured) : null;

  return (
    <>
      {featured ? (
        <section className="cv-feature grid items-center gap-7 rounded-3xl p-5 md:grid-cols-[minmax(190px,260px)_1fr] md:gap-10 md:p-10">
          <div className="relative mx-auto w-full max-w-[220px] md:max-w-none">
            <div className="absolute -inset-3 rounded-3xl bg-primary/20 blur-2xl" />
            <Cover hue={featured.hue} title={featured.title} src={featured.coverUrl} className="relative mx-auto aspect-[2/3] w-44 rounded-2xl border-white/20 shadow-2xl md:w-full" />
            <span className="absolute -bottom-3 -right-3 rounded-xl border border-white/15 bg-black/65 px-3 py-2 text-xs font-bold text-white backdrop-blur"><Star size={13} className="mr-1 inline fill-yellow-300 text-yellow-300" />{featured.rating.toFixed(1)} rating</span>
          </div>
          <div className="relative">
            <p className="cv-eyebrow flex items-center gap-2"><Sparkles size={14} /> Editor&apos;s spotlight</p>
            <p className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted"><span>{featured.type}</span><span className="text-primary">•</span><span>{last ? `Latest chapter ${last.displayNumber ?? last.number}` : "Fresh release"}</span></p>
            <h1 className="mt-3 max-w-3xl text-3xl font-black leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">{featured.title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted md:text-base">{featured.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {featured.genres.map((g) => <Link key={g} href={`/browse?genre=${encodeURIComponent(g)}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-primary hover:bg-primary/10">{g}</Link>)}
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={`/comics/${featured.slug}`} className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-950/40 hover:-translate-y-0.5">Start reading <ArrowUpRight size={16} /></Link>
              <Link href="/browse" className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold hover:bg-white/10">Discover more</Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="cv-panel p-8 text-center">
          <p className="cv-eyebrow">Library update</p>
          <h1 className="mt-3 text-3xl font-black">No approved manhwa/manhua available yet</h1>
          <p className="mt-2 text-muted">Admins can publish approved titles here once they are ready.</p>
        </section>
      )}

      <Section title="Trending right now" href="/browse?sort=popular" eyebrow="The community is reading">
        <div className="scroll-row">{byViews.map((c) => <div key={c.slug} className="w-36 sm:w-44"><ComicCard comic={c} /></div>)}</div>
      </Section>

      <Recommended />

      <Section title="Fresh chapter drops" href="/browse?sort=updated&type=manhwa&type=manhua" eyebrow="Never miss an update">
        <ul className="grid gap-3 sm:grid-cols-2">
          {latest.slice(0, 8).map((c) => {
            const l = latestChapter(c);
            return (
              <li key={c.slug}>
                <Link href={`/comics/${c.slug}`} className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-card/70 px-4 py-4 hover:border-primary/60 hover:bg-card">
                  <span className="min-w-0"><span className="block truncate font-bold group-hover:text-primary">{c.title}</span><span className="mt-1 block text-xs text-muted">{c.type} · New chapter</span></span>
                  <span className="shrink-0 text-right text-xs text-muted"><span className="block font-bold text-fg">Ch. {l.displayNumber ?? l.number}</span><span className="mt-1 block">{new Date(l.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Reader favourites" eyebrow="Ranked by readers">
        <div className="grid gap-4 md:grid-cols-3">
          {["This week", "This month", "All time"].map((label, k) => (
            <div key={label} className="cv-panel p-5">
              <h3 className="mb-4 flex items-center gap-2 font-bold"><TrendingUp size={16} className="text-primary" />{label}</h3>
              <ol className="space-y-3">
                {[...byViews.slice(k), ...byViews.slice(0, k)].slice(0, 5).map((c, i) => (
                  <li key={c.slug} className="flex items-center gap-3 text-sm">
                    <span className={`w-6 text-lg font-black ${i === 0 ? "text-primary" : "text-muted"}`}>{String(i + 1).padStart(2, "0")}</span>
                    <Link href={`/comics/${c.slug}`} className="min-w-0 truncate font-semibold hover:text-primary">{c.title}</Link>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Just added to ComicVerse" href="/browse?sort=added&type=manhwa&type=manhua" eyebrow="New worlds to explore">
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">{added.map((c) => <ComicCard key={c.slug} comic={c} />)}</div>
      </Section>

      {announcements.length > 0 && <Section title="From the ComicVerse team" eyebrow="News & announcements">
        <ul className="grid gap-3 md:grid-cols-2">
          {announcements.map((a) => (
            <li key={a.id} className="cv-panel p-5"><p className="font-bold">{a.title}</p><p className="mt-2 text-sm leading-6 text-muted">{a.body}</p></li>
          ))}
        </ul>
      </Section>}
    </>
  );
}
