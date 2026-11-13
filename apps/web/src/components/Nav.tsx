"use client";

import Link from "next/link";
import AccountLink from "./AccountLink";
import { BackToTopButton, DesktopLinks, SearchControl } from "./NavClient";
import { ComicVerseMark } from "./ComicVerseLogo";

export function Header() {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<PopupUser | null | undefined>(undefined);
  const [unread, setUnread] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const headerRef = useRef<HTMLElement>(null);

  const refreshUser = useCallback(() => {
    let active = true;
    api<PopupUser>("/auth/me", { credentials: "include" })
      .then((data) => {
        if (!active) return;
        setUser(data);
        api<{ unread: number }>("/user/notifications", { credentials: "include" })
          .then((n) => active && setUnread(n.unread))
          .catch(() => {});
      })
      .catch(() => { if (active) setUser(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => refreshUser(), [path, refreshUser]);

  useEffect(() => {
    const onChange = () => refreshUser();
    window.addEventListener("cv:notifications", onChange);
    return () => window.removeEventListener("cv:notifications", onChange);
  }, [refreshUser]);

  // Ctrl/Cmd+K opens search, Esc closes any open panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPanel((p) => (p === "search" ? null : "search")); }
      if (e.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close panels on outside click.
  useEffect(() => {
    if (!panel) return;
    const onDown = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setPanel(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [panel]);

  const toggle = (p: Exclude<Panel, null>) => setPanel((cur) => (cur === p ? null : p));
  const isActive = (href: string) => href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);

  return (
<<<<<<< HEAD
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
=======
    <header ref={headerRef} className="cv-header sticky top-0 z-40">
      <div className="relative mx-auto flex min-h-[4.5rem] max-w-7xl items-center gap-2 px-4 md:gap-4">
        <Link href="/" className="flex shrink-0 items-center text-lg font-black tracking-tight text-fg">
          <span className="cv-logo-mark">C</span>
          <span className="max-[380px]:hidden">Comic<span className="text-[#A855F7]">Verse</span></span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 text-sm text-muted md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined} className="cv-nav-link">{l.label}</Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 md:gap-2">
          <button
            type="button"
            onClick={() => toggle("search")}
            aria-label="Search comics (Ctrl K)"
            aria-expanded={panel === "search"}
            className="rounded-full border border-line bg-card/70 p-2.5 text-fg hover:border-primary hover:text-white"
          >
            <Search size={18} />
          </button>
          <Link href="/profile/bookmarks" aria-label="Bookmarks" className="hidden rounded-full border border-line bg-card/70 p-2.5 text-fg hover:border-primary hover:text-white sm:block">
            <Bookmark size={18} />
          </Link>
          <div className="relative">
            <button
              type="button"
              onClick={() => toggle("notif")}
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
              aria-expanded={panel === "notif"}
              className="relative rounded-full border border-line bg-card/70 p-2.5 text-fg hover:border-primary hover:text-white"
            >
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-black text-white ring-2 ring-[#2a1650]">{unread > 99 ? "99+" : unread}</span>
              )}
            </button>
            <NotificationsDropdown open={panel === "notif"} onClose={() => setPanel(null)} onUnreadChange={setUnread} />
          </div>
          <div className="relative">
            {user === undefined ? (
              <span className="block h-10 w-10 animate-pulse rounded-full bg-card" aria-hidden />
            ) : user ? (
              <button
                type="button"
                onClick={() => toggle("profile")}
                aria-label="Profile menu"
                aria-expanded={panel === "profile"}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-base font-black text-white ring-2 ring-white/20 hover:ring-white/50"
              >
                {user.username.slice(0, 1).toUpperCase()}
              </button>
            ) : (
              <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:-translate-y-0.5">
                <UserRound size={16} /> Log in
              </Link>
            )}
            <ProfilePopup
              open={panel === "profile" && !!user}
              onClose={() => setPanel(null)}
              user={user ?? null}
              onLoggedOut={() => { setUser(null); setUnread(0); router.refresh(); }}
            />
          </div>
>>>>>>> 44714f483b778704646c40bf4db1fe37e116786e
        </div>

        <SearchPanel open={panel === "search"} onClose={() => setPanel(null)} />
      </div>
    </header>
  );
}

<<<<<<< HEAD
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
=======
export function BottomNav() {
  const path = usePathname();
  const isActive = (href: string) => href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
  return (
    <nav aria-label="Mobile" className="cv-mobile-nav fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 gap-1 p-1.5 md:hidden">
      {links.map(({ href, label, Icon }) => {
        const active = isActive(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-0.5 rounded-full px-4 py-2 text-[11px] font-bold transition ${active ? "bg-primary text-white shadow-lg shadow-violet-950/50" : "text-muted hover:text-fg"}`}>
            <Icon size={19} aria-hidden />{label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Footer() {
  const f = [["About", "/about"], ["Contact", "/contact"], ["Privacy", "/privacy"], ["Terms", "/terms"], ["Copyright", "/copyright-policy"]];
  return (
    <footer className="mt-20 border-t border-line pb-28 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-9 text-sm text-muted">
        <div><p className="font-bold text-fg">Comic<span className="text-primary">Verse</span></p><p className="mt-1 text-xs">Stories worth staying up for.</p></div>
        <nav aria-label="Footer" className="flex flex-wrap gap-4">
          {f.map(([l, h]) => <Link key={h} href={h} className="text-[#A8A1B5] hover:text-white">{l}</Link>)}
        </nav>
        <span className="w-full text-xs text-[#A8A1B5] md:w-auto">© 2026 ComicVerse. All series are original or licensed.</span>
      </div>
    </footer>
>>>>>>> 44714f483b778704646c40bf4db1fe37e116786e
  );
}
