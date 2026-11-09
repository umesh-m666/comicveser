"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass, Home, User } from "lucide-react";

// Account always points at /account. That page reads the real session (via AuthProvider) and shows the dashboard to
// signed-in users or the Log in / Create account options to everyone else, so this link never needs to guess.
const items = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/browse", label: "Discover", Icon: Compass },
  { href: "/manga", label: "Manga", Icon: BookOpen },
  { href: "/account", label: "Account", Icon: User },
];

export default function BottomNav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/") ||
    (href === "/account" && (path.startsWith("/profile") || path.startsWith("/admin") || path.startsWith("/creator") || path === "/login" || path === "/register")));
  return (
    <nav aria-label="Mobile" className="cv-mobile-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t pb-[env(safe-area-inset-bottom)] md:hidden">
      {items.map(({ href, label, Icon }) => (
        <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}
          className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-1 py-2 text-[11px] hover:text-fg ${active(href) ? "text-primary" : "text-muted"}`}>
          <Icon size={19} aria-hidden />{label}
        </Link>
      ))}
    </nav>
  );
}
