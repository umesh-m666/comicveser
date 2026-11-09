"use client";
import Link from "next/link";
import { useState } from "react";
import { Bell, Bookmark, BookOpen, ChevronRight, History, LogOut, PenLine, Settings, ShieldCheck, Star, UserRound, UserCog } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useLoad } from "@/lib/useApi";

type Profile = { avatarUrl: string | null; bio: string | null; createdAt: string };

function Avatar({ url, name }: { url: string | null | undefined; name: string }) {
  const [broken, setBroken] = useState(false);
  const cls = "h-20 w-20 shrink-0 rounded-full ring-2 ring-primary md:h-24 md:w-24";
  if (url && !broken) return <img src={url} alt={`${name}'s profile picture`} onError={() => setBroken(true)} className={`${cls} object-cover`} />; // eslint-disable-line @next/next/no-img-element
  return <span role="img" aria-label={`${name}'s profile picture`} className={`${cls} flex items-center justify-center bg-surface text-3xl font-bold text-primary`}>{name.slice(0, 1).toUpperCase() || <UserRound />}</span>;
}

type Item = { href: string; label: string; hint: string; Icon: typeof Bell };
const row = "flex min-h-14 items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 transition hover:border-primary active:scale-[.99]";

function Tile({ href, label, hint, Icon }: Item) {
  return (
    <Link href={href} className={row}>
      <Icon size={20} className="shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1"><span className="block font-medium">{label}</span><span className="block truncate text-xs text-muted">{hint}</span></span>
      <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
    </Link>
  );
}

export default function AccountDashboard() {
  const { user, status, logout, isAdmin } = useAuth();
  const profile = useLoad<Profile>(user ? "/user/profile" : null);

  // Wait for the real session check; never flash the logged-out view to a signed-in user.
  if (status === "loading") return <div className="mx-auto max-w-5xl space-y-3" aria-busy="true"><div className="skeleton h-36" /><div className="skeleton h-56" /></div>;
  if (status === "error") return <p role="alert" className="text-danger">Can't reach the server to check your session. Check your connection and refresh the page.</p>;

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

  const library: Item[] = [
    { href: "/profile/bookmarks", label: "Bookmarks & library", hint: "Comics you saved", Icon: Bookmark },
    { href: "/profile/history", label: "Reading history", hint: "Pick up where you left off", Icon: History },
    { href: "/profile/external-library", label: "Saved sources", hint: "Titles saved from external sources", Icon: BookOpen },
    { href: "/profile/reviews", label: "My reviews", hint: "Reviews you have written", Icon: Star },
  ];
  const manage: Item[] = [
    { href: "/profile/notifications", label: "Messages & alerts", hint: "New chapters and announcements", Icon: Bell },
    { href: "/profile/settings", label: "Profile", hint: "Username and about you", Icon: UserRound },
    { href: "/profile/settings", label: "Settings", hint: "Notifications and preferences", Icon: Settings },
    { href: "/profile/settings", label: "Account management", hint: "Change password or delete account", Icon: UserCog },
  ];
  const roleLabel = user.role.charAt(0) + user.role.slice(1).toLowerCase();

  return (
    <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[300px_1fr] md:items-start">
      <section aria-label="Profile" className="cv-panel p-5 text-center md:sticky md:top-24">
        <div className="flex flex-col items-center gap-3">
          <Avatar url={profile.data?.avatarUrl} name={user.username} />
          <div className="min-w-0 max-w-full">
            <h1 className="truncate text-xl font-bold">{user.username}</h1>
            <p className="truncate text-sm text-muted">{user.email}</p>
          </div>
          <span className="rounded-full border border-primary px-3 py-0.5 text-xs font-semibold text-primary">{roleLabel}</span>
          {!user.emailVerified && <p className="text-xs text-muted">Email not verified yet.</p>}
          {profile.data?.bio && <p className="text-sm text-muted">{profile.data.bio}</p>}
          {profile.data && <p className="text-xs text-muted">Member since {new Date(profile.data.createdAt).toLocaleDateString("en-IN")}</p>}
        </div>
        <button type="button" onClick={() => void logout()} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line font-medium text-muted hover:border-red-500 hover:text-red-500">
          <LogOut size={18} aria-hidden />Log out
        </button>
      </section>

      <div className="min-w-0 space-y-6">
        <section aria-label="Portals" className="grid gap-3">
          {isAdmin
            ? <Tile href="/admin" label="Admin Panel" hint="Manage comics, chapters, sources and users" Icon={ShieldCheck} />
            : <Tile href="/creator/dashboard" label="Creator portal" hint="Publish and manage your own comics" Icon={PenLine} />}
        </section>
        <section aria-labelledby="lib-h"><h2 id="lib-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Library</h2>
          <div className="grid gap-3 sm:grid-cols-2">{library.map((i) => <Tile key={i.label} {...i} />)}</div></section>
        <section aria-labelledby="acc-h"><h2 id="acc-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Account</h2>
          <div className="grid gap-3 sm:grid-cols-2">{manage.map((i) => <Tile key={i.label} {...i} />)}</div></section>
      </div>
    </div>
  );
}
