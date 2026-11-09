import Link from "next/link";
import AccountLink from "./AccountLink";
import { BookOpen, Bookmark, Compass, Home, Search } from "lucide-react";

const links = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/browse", label: "Discover", Icon: Compass },
  { href: "/manga", label: "Manga", Icon: BookOpen },
  { href: "/profile/bookmarks", label: "My Library", Icon: Bookmark },
];

export function Header() {
  return (
    <header className="cv-header sticky top-0 z-30">
      <div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center gap-3 px-4 md:gap-6">
        <Link href="/" className="flex shrink-0 items-center text-lg font-black tracking-tight text-fg">
          <span className="cv-logo-mark">C</span>
          Comic<span className="text-primary">Verse</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 text-sm text-muted md:flex">
          {links.map((l) => <Link key={l.href} href={l.href} className="cv-nav-link">{l.label}</Link>)}
        </nav>
        <form action="/browse" role="search" className="ml-auto flex min-w-0 items-center">
          <label htmlFor="hq" className="sr-only">Search comics</label>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input id="hq" name="q" placeholder="Search stories..." className="cv-search w-32 py-2 pl-9 pr-3 text-sm placeholder:text-muted sm:w-56" />
          </div>
        </form>
        <div className="shrink-0"><AccountLink /></div>
      </div>
    </header>
  );
}

export function Footer() {
  const f = [["About","/about"],["Contact","/contact"],["Privacy","/privacy"],["Terms","/terms"],["Copyright","/copyright-policy"]];
  return (
    <footer className="mt-20 border-t border-line pb-24 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-9 text-sm text-muted">
        <div><p className="font-bold text-fg">Comic<span className="text-primary">Verse</span></p><p className="mt-1 text-xs">Stories worth staying up for.</p></div>
        <nav aria-label="Footer" className="flex flex-wrap gap-4">
          {f.map(([l, h]) => <Link key={h} href={h} className="hover:text-fg">{l}</Link>)}
        </nav>
        <span className="w-full text-xs text-muted md:w-auto">© 2026 ComicVerse. All series are original or licensed.</span>
      </div>
    </footer>
  );
}
