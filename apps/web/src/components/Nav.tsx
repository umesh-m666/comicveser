import Link from "next/link";
import AccountLink from "./AccountLink";
import { BackToTopButton, DesktopLinks, SearchControl } from "./NavClient";
import { ComicVerseMark } from "./ComicVerseLogo";

export function Header() {
  return (
    <header className="s-header" data-layer="Header / Purple Nav">
      <div className="wrap">
        <Link href="/" className="s-logo" aria-label="ComicVerse home">
          <span className="mark" aria-hidden="true">
            <ComicVerseMark className="cv-mark-svg" />
          </span>
          <span>
            Comic<em>Verse</em>
          </span>
        </Link>
        <DesktopLinks />
        <div className="s-head-r">
          <SearchControl />
          <Link
            href="/profile/bookmarks"
            className="s-book hidden lg:inline-flex"
            aria-label="Bookmarks"
            title="Bookmarks"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ width: 20, height: 20 }}
            >
              <path d="M6.5 3.5h11V21L12 16.6 6.5 21z" />
            </svg>
          </Link>
          <AccountLink />
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <>
      <footer className="s-footer" data-layer="Footer">
        <div className="wrap">
          <div className="flogo">
            <span className="mark" aria-hidden="true">
              <ComicVerseMark className="cv-mark-svg" />
            </span>
            Comic<em>Verse</em>
          </div>
          <nav aria-label="Footer">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/copyright-policy">DMCA</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Report Issue</Link>
          </nav>
          <div className="soc">
            <a className="dc" href="https://discord.com" target="_blank" rel="noopener noreferrer">
              Discord
            </a>
            <a className="rd" href="https://reddit.com" target="_blank" rel="noopener noreferrer">
              Reddit <span className="new">NEW</span>
            </a>
          </div>
          <div className="copy">© 2026 ComicVerse. All rights reserved.</div>
        </div>
      </footer>
      <BackToTopButton />
    </>
  );
}
