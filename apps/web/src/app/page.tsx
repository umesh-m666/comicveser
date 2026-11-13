import Link from "next/link";
import { Star, ArrowUpRight, ArrowLeft, ArrowRight, Sparkles, TrendingUp, Crown, Megaphone, Clock } from "lucide-react";
import Recommended from "@/components/Recommended";
import ComicCard, { Cover, chapterCount, relTime } from "@/components/ComicCard";
import { allComics, getAnnouncements, latestChapter } from "@/lib/comics";

function Section({ title, href, children, eyebrow }: { title: string; href?: string; children: React.ReactNode; eyebrow?: string }) {
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

export default async function Home({ searchParams }: { searchParams?: { featured?: string } }) {
  const [comics, announcements] = await Promise.all([allComics(), getAnnouncements()]);
  const homeTitles = comics.filter((comic) => comic.type === "Manhwa" || comic.type === "Manhua");
  const byViews = [...homeTitles].sort((a, b) => b.views - a.views);
  const featuredList = byViews.slice(0, 5);
  const idx = Math.min(Math.max(Number(searchParams?.featured) || 0, 0), Math.max(featuredList.length - 1, 0));
  const featured = featuredList[idx] ?? comics[0];
  const latest = [...homeTitles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const popular = byViews.slice(0, 10);
  const editorsPick = [...homeTitles].sort((a, b) => b.rating - a.rating || b.views - a.views)[0];
  const last = featured ? latestChapter(featured) : null;
  const prev = featuredList.length ? (idx - 1 + featuredList.length) % featuredList.length : 0;
  const next = featuredList.length ? (idx + 1) % featuredList.length : 0;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        {featured ? (
          <section className="cv-feature relative grid items-center gap-7 rounded-3xl p-5 md:grid-cols-[minmax(190px,260px)_1fr] md:gap-10 md:p-10">
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
            {featuredList.length > 1 && (
              <div className="absolute right-4 top-4 flex items-center gap-2">
                <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">{idx + 1} / {featuredList.length}</span>
                <Link href={`/?featured=${prev}`} aria-label="Previous featured comic" className="rounded-full border border-white/15 bg-black/45 p-2 text-white backdrop-blur hover:bg-primary"><ArrowLeft size={15} /></Link>
                <Link href={`/?featured=${next}`} aria-label="Next featured comic" className="rounded-full border border-white/15 bg-black/45 p-2 text-white backdrop-blur hover:bg-primary"><ArrowRight size={15} /></Link>
              </div>
            )}
          </section>
        ) : (
          <section className="cv-panel p-8 text-center">
            <p className="cv-eyebrow">Library update</p>
            <h1 className="mt-3 text-3xl font-black">No approved manhwa/manhua available yet</h1>
            <p className="mt-2 text-muted">Admins can publish approved titles here once they are ready.</p>
          </section>
        )}

        <Section title="Trending Comics" href="/browse?sort=popular" eyebrow="The community is reading">
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
            {byViews.slice(0, 10).map((c) => {
              const l = latestChapter(c);
              return (
                <div key={c.slug}>
                  <ComicCard comic={c} />
                  <p className="mt-1.5 text-xs text-muted">Latest: Ch. {l.displayNumber ?? l.number} · <span className="inline-flex items-center gap-1"><Star size={11} className="fill-yellow-300 text-yellow-300" />{c.rating.toFixed(1)}</span></p>
                </div>
              );
            })}
          </div>
        </Section>

        <Recommended />

        <Section title="Latest Updates" href="/browse?sort=updated&type=manhwa&type=manhua" eyebrow="Never miss an update">
          <ul className="space-y-3">
            {latest.slice(0, 10).map((c) => {
              const l = latestChapter(c);
              return (
                <li key={c.slug} className="cv-panel overflow-hidden">
                  <Link href={`/comics/${c.slug}`} className="group flex items-center gap-4 p-3">
                    <Cover hue={c.hue} title={c.title} src={c.coverUrl} className="aspect-[2/3] w-14 shrink-0 !p-2 md:w-16" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold group-hover:text-primary">{c.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <span className="rounded-full border border-line bg-surface px-2 py-0.5 font-semibold text-fg">Ch. {l.displayNumber ?? l.number}</span>
                        <span className="flex items-center gap-1"><Clock size={12} />{relTime(c.updatedAt)}</span>
                        <span>{chapterCount(c)} chapters</span>
                      </span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-1 text-xs font-bold sm:flex"><Star size={12} className="fill-yellow-300 text-yellow-300" />{c.rating.toFixed(1)}</span>
                  </Link>
                  <Link href={`/comics/${c.slug}`} className="block bg-warn py-2.5 text-center text-sm font-black tracking-wide text-black transition hover:brightness-110">Read the Comic</Link>
                </li>
              );
            })}
          </ul>
        </Section>
      </div>

      {/* Right rail (desktop) */}
      <aside className="space-y-8 lg:pt-2">
        <section className="cv-panel p-5">
          <h2 className="mb-4 flex items-center gap-2 font-extrabold"><TrendingUp size={17} className="text-primary" /> Popular</h2>
          <ol className="space-y-3">
            {popular.map((c, i) => (
              <li key={c.slug} className="flex items-center gap-3 text-sm">
                <span className={`w-6 shrink-0 text-lg font-black ${i < 3 ? "text-warn" : "text-muted"}`}>{String(i + 1).padStart(2, "0")}</span>
                <Cover hue={c.hue} title={c.title} src={c.coverUrl} className="aspect-[2/3] w-9 shrink-0 !p-1" />
                <span className="min-w-0 flex-1">
                  <Link href={`/comics/${c.slug}`} className="block truncate font-semibold hover:text-primary">{c.title}</Link>
                  <span className="text-xs text-muted">{c.type} · <Star size={11} className="inline fill-yellow-300 text-yellow-300" /> {c.rating.toFixed(1)}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {editorsPick && (
          <section className="cv-panel overflow-hidden">
            <h2 className="flex items-center gap-2 px-5 pb-3 pt-5 font-extrabold"><Crown size={17} className="text-warn" /> Editor&apos;s Pick</h2>
            <Link href={`/comics/${editorsPick.slug}`} className="group block px-5 pb-5">
              <Cover hue={editorsPick.hue} title={editorsPick.title} src={editorsPick.coverUrl} className="aspect-[16/9] w-full !items-end" />
              <p className="mt-3 font-bold group-hover:text-primary">{editorsPick.title}</p>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{editorsPick.description}</p>
              <p className="mt-2 text-xs font-semibold text-primary">★ {editorsPick.rating.toFixed(1)} · {editorsPick.type} · {editorsPick.status}</p>
            </Link>
          </section>
        )}

        {announcements.length > 0 && (
          <section className="cv-panel p-5">
            <h2 className="mb-4 flex items-center gap-2 font-extrabold"><Megaphone size={17} className="text-primary" /> Announcements</h2>
            <ul className="space-y-4">
              {announcements.map((a) => (
                <li key={a.id} className="border-l-2 border-primary pl-3">
                  <p className="text-sm font-bold">{a.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{a.body}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
