import Link from "next/link";
import AccountLink from "./AccountLink";
import { DesktopLinks, SearchControl, UpgradeLink } from "./NavClient";

export function Header() {
  return (
    <header className="cv-header sticky top-0 z-30">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:gap-4">
        <Link href="/" className="flex shrink-0 items-center text-lg font-extrabold tracking-tight text-fg" aria-label="ComicVerse home">
          <span className="cv-logo-mark">C</span>
          <span className="max-[380px]:hidden">Comic<span className="text-primary">Verse</span></span>
        </Link>
        <DesktopLinks />
        <div className="ml-auto flex min-w-0 items-center gap-2.5">
          <SearchControl />
          <UpgradeLink />
          <AccountLink />
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const f = [["About","/about"],["Contact","/contact"],["Privacy","/privacy"],["Terms","/terms"],["Copyright","/copyright-policy"]];
  return (
    <footer className="mt-20 border-t border-line pb-28 lg:pb-8">
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
