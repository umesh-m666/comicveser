"use client";
import Link from "next/link";
import { Bell, Bookmark, BookOpen, BookCheck, ChevronRight, History, Library, PenLine, Settings, Sparkles, Star, UserCog, UserRound } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { Cover } from "./ComicCard";
import { UserAvatar } from "./ProfileMenu";
import { act, useLoad } from "@/lib/useApi";
import { timeAgo } from "@/lib/comics";
import { coverSrc, hueOf } from "@/lib/media";

type Profile = { avatarUrl: string | null; bio: string | null; createdAt: string };
type Stats = { bookmarks: number; chaptersRead: number; comicsStarted: number; shelves: Record<string, number> };
type Hist = { comic: { id: string; slug: string; title: string }; chapter: { id: string; displayNumber?: string; number: number }; imageIndex: number; lastReadAt: string }[];
type Marks = { items: { comic: { id: string; slug: string; title: string; coverUrl: string | null }; progress: { percent: number } }[] };
type ReadRows = { comic: { slug: string; title: string }; chapter: { id: string; displayNumber: string }; readAt: string }[];
type Notes = { prefs: { newChapter: boolean } };

const panel = "cv-panel p-4 sm:p-5";
const H = ({ id, children, href, link }: { id: string; children: React.ReactNode; href?: string; link?: string }) => (
  <div className="mb-3 flex items-center justify-between gap-3"><h2 id={id} className="cv-section-title text-lg font-bold text-white">{children}</h2>{href && <Link href={href} className="text-xs font-semibold text-[#c084fc] hover:underline">{link ?? "View all"}</Link>}</div>
);
const Stat = ({ label, value, Icon }: { label: string; value: number | string; Icon: typeof Bookmark }) => (
  <div className="cv-panel flex items-center gap-3 p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[rgba(147,51,234,.2)] text-[#c084fc]"><Icon size={20} aria-hidden /></span><div className="min-w-0"><p className="text-2xl font-extrabold leading-none text-white">{value}</p><p className="mt-1 truncate text-xs text-[#a8a1b5]">{label}</p></div></div>
);
const row = "flex min-h-14 items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 transition hover:border-primary active:scale-[.99]";
function Tile({ href, label, hint, Icon }: { href: string; label: string; hint: string; Icon: typeof Bell }) {
  return <Link href={href} className={row}><Icon size={20} className="shrink-0 text-[#c084fc]" aria-hidden /><span className="min-w-0 flex-1"><span className="block font-medium text-white">{label}</span><span className="block truncate text-xs text-[#a8a1b5]">{hint}</span></span><ChevronRight size={18} className="shrink-0 text-[#a8a1b5]" aria-hidden /></Link>;
}

export default function AccountDashboard() {
  const { user, status } = useAuth();
  const q = (p: string) => (user ? p : null);
  const profile = useLoad<Profile>(q("/user/profile"));
  const stats = useLoad<Stats>(q("/user/stats"));
  const history = useLoad<Hist>(q("/user/history"));
  const marks = useLoad<Marks>(q("/user/bookmarks?limit=6&sort=updated"));
  const reads = useLoad<ReadRows>(q("/user/read-chapters"));
  const notes = useLoad<Notes>(q("/user/notifications"));

  // Wait for the real session check; never flash the logged-out view to a signed-in user.
  if (status === "loading") return <div className="mx-auto max-w-5xl space-y-3" aria-busy="true"><div className="skeleton h-36" /><div className="skeleton h-56" /></div>;
  if (status === "error") return <p role="alert" className="text-danger">Can&apos;t reach the server to check your session. Check your connection and refresh the page.</p>;
  if (!user) {
    return (
      <div className="mx-auto max-w-sm py-6 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface text-primary ring-1 ring-primary"><UserRound size={28} aria-hidden /></span>
        <h1 className="mt-4 text-2xl font-bold">Your ComicVerse account</h1>
        <p className="mt-2 text-sm text-muted">Log in to sync your bookmarks and reading history across devices.</p>
        <div className="mt-6 grid gap-3">
          <Link href="/login?next=%2Faccount" className="rounded-xl bg-primary py-3 font-semibold text-white">Log in</Link>
          <Link href="/register" className="rounded-xl border border-line py-3 font-semibold hover:border-primary">Create account</Link>
        </div>
      </div>
    );
  }

  const roleLabel = user.role.charAt(0) + user.role.slice(1).toLowerCase();
  const completed = stats.data?.shelves.COMPLETED ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Profile header */}
      <section aria-label="Profile" className="cv-panel relative overflow-hidden p-5 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[rgba(147,51,234,.22)] to-transparent" />
        <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <span className="cv-avatar !h-24 !w-24 shrink-0 !text-3xl"><UserAvatar url={profile.data?.avatarUrl} name={user.username} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="truncate text-2xl font-extrabold text-white">{user.username}</h1>
              <span className="rounded-full border border-[rgba(168,85,247,.6)] px-2.5 py-0.5 text-xs font-bold text-[#e9d5ff]">{roleLabel}</span>
            </div>
            <p className="truncate text-sm text-[#a8a1b5]">{user.email}{!user.emailVerified && " · email not verified yet"}</p>
            {profile.data?.bio && <p className="mt-2 max-w-xl text-sm text-[#d9d4e2]">{profile.data.bio}</p>}
            {profile.data && <p className="mt-1 text-xs text-[#a8a1b5]">Member since {new Date(profile.data.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>}
          </div>
          <Link href="/profile/settings" className="cv-btn shrink-0"><UserCog size={16} aria-hidden />Edit profile</Link>
        </div>
      </section>

      {/* Reading statistics */}
      <section aria-label="Reading statistics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bookmarked comics" value={stats.data?.bookmarks ?? "–"} Icon={Bookmark} />
        <Stat label="Chapters completed" value={stats.data?.chaptersRead ?? "–"} Icon={BookCheck} />
        <Stat label="Comics in progress" value={stats.data?.comicsStarted ?? "–"} Icon={BookOpen} />
        <Stat label="Series completed" value={stats.data ? completed : "–"} Icon={Star} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="cont-h" className={panel}>
            <H id="cont-h" href="/profile/history">Reading history</H>
            {history.loading ? <div className="skeleton h-24" aria-busy="true" /> : !history.data?.length ? <p className="text-sm text-[#a8a1b5]">Nothing read yet. Your place in each comic is saved as you read.</p> : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {history.data.slice(0, 6).map((h) => (
                  <li key={h.comic.id}><Link href={`/comics/${h.comic.slug}/chapter/${h.chapter.id}`} className={row}>
                    <History size={18} className="shrink-0 text-[#c084fc]" aria-hidden />
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-white">{h.comic.title}</span><span className="block text-xs text-[#a8a1b5]">Ch. {h.chapter.displayNumber ?? h.chapter.number} · page {h.imageIndex + 1} · {timeAgo(h.lastReadAt)}</span></span>
                  </Link></li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="bm-h" className={panel}>
            <H id="bm-h" href="/profile/bookmarks">Bookmarked comics</H>
            {marks.loading ? <div className="skeleton h-40" aria-busy="true" /> : !marks.data?.items.length ? <p className="text-sm text-[#a8a1b5]">No bookmarks yet. <Link href="/browse" className="text-[#c084fc] hover:underline">Browse comics</Link> and tap the bookmark icon.</p> : (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {marks.data.items.map((b) => (
                  <li key={b.comic.id}><Link href={`/comics/${b.comic.slug}`} className="group block" aria-label={b.comic.title}>
                    <Cover hue={hueOf(b.comic.slug)} title={b.comic.title} src={coverSrc(b.comic.coverUrl)} className="aspect-[2/3] w-full transition group-hover:border-[#a855f7]" />
                    <div className="cv-progress mt-1.5" aria-hidden><span style={{ width: `${b.progress.percent}%` }} /></div>
                  </Link></li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="done-h" className={panel}>
            <H id="done-h">Completed chapters</H>
            {reads.loading ? <div className="skeleton h-24" aria-busy="true" /> : !reads.data?.length ? <p className="text-sm text-[#a8a1b5]">Chapters you finish appear here, in purple, as you read them.</p> : (
              <ul className="divide-y divide-line">
                {reads.data.slice(0, 8).map((r) => (
                  <li key={r.chapter.id}><Link href={`/comics/${r.comic.slug}/chapter/${r.chapter.id}`} data-state="read" className="cv-ch flex items-center justify-between gap-3 py-2.5 text-sm hover:opacity-80">
                    <span className="min-w-0 truncate"><span className="font-semibold">{r.comic.title}</span> · Chapter {r.chapter.displayNumber}</span>
                    <span className="cv-ch-meta shrink-0 text-xs">{timeAgo(r.readAt)}</span>
                  </Link></li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6" aria-label="Account settings">
          <section aria-labelledby="set-h" className={panel}>
            <H id="set-h">Account settings</H>
            <div className="grid gap-2.5">
              <Tile href="/profile/settings" label="Profile & password" hint="Username, about you, security" Icon={UserRound} />
              <Tile href="/profile/notifications" label="Messages & alerts" hint="New chapters and announcements" Icon={Bell} />
              <Tile href="/profile/external-library" label="Saved sources" hint="Titles saved from external sources" Icon={Library} />
              <Tile href="/profile/reviews" label="My reviews" hint="Reviews you have written" Icon={Star} />
              <Tile href="/profile/settings" label="Account management" hint="Change password or delete account" Icon={Settings} />
              {user.role !== "ADMIN" && <Tile href="/premium" label="Premium plans" hint="Plans and billing" Icon={Sparkles} />}
              {user.role !== "ADMIN" && <Tile href="/creator/dashboard" label="Creator portal" hint="Publish and manage your own comics" Icon={PenLine} />}
            </div>
          </section>
          <section aria-labelledby="np-h" className={panel}>
            <H id="np-h">Notification preferences</H>
            {notes.data ? (
              <label className="flex items-start gap-2.5 text-sm text-[#d9d4e2]">
                <input type="checkbox" className="mt-1" checked={notes.data.prefs.newChapter} onChange={async (e) => { await act("/user/notification-settings", "PUT", { newChapter: e.target.checked }); notes.reload(); }} />
                Tell me when a bookmarked comic has a new chapter
              </label>
            ) : <div className="skeleton h-10" aria-busy="true" />}
          </section>
        </aside>
      </div>
    </div>
  );
}
