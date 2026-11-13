"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABS, tabIndex } from "@/lib/nav";

/**
 * Fixed mobile/tablet bottom navigation bar with 4 primary comic destinations:
 * Home, Manga, Browse, and Bookmarks.
 */
export default function BottomNav() {
  const path = usePathname();
  const active = tabIndex(path);
  return (
    <nav aria-label="Primary" className="cv-tabbar lg:hidden">
      <div className="relative grid grid-cols-4">
        <span
          aria-hidden
          className="cv-tabbar-ind"
          style={{
            transform: `translateX(${Math.max(active, 0) * 100}%)`,
            opacity: active >= 0 ? 1 : 0,
          }}
        >
          <span />
        </span>
        {TABS.map(({ href, label, Icon }, i) => (
          <Link
            key={href}
            href={href}
            aria-current={i === active ? "page" : undefined}
            className="cv-tab-link"
          >
            <Icon size={19} className="cv-tab-icon" aria-hidden />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
