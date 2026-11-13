"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABS, tabIndex } from "@/lib/nav";

const TAB_SVGS: Record<string, React.ReactNode> = {
  Home: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.8V21h14V9.8" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  ),
  Manga: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 6.2C10.2 4.6 8 4.2 4 4.2v13.6c4 0 6.2.4 8 2 1.8-1.6 4-2 8-2V4.2c-4 0-6.2.4-8 2z" />
      <path d="M12 6.2v13.6" />
    </svg>
  ),
  Browse: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 2.6h6" />
      <circle cx="12" cy="13" r="8.2" />
      <path d="m15.6 9.8-1.9 4.7-4.7 1.9 1.9-4.7z" />
    </svg>
  ),
  Bookmarks: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.5 3.5h11V21L12 16.6 6.5 21z" />
    </svg>
  ),
};

/**
 * Floating Mobile Bottom Navigation Bar (.m-bottomnav) matching the Asura Figma phone frames:
 * Home · Manga · Browse · Bookmarks.
 */
export default function BottomNav() {
  const path = usePathname();
  const active = tabIndex(path);

  return (
    <nav aria-label="Primary" className="m-bottomnav" data-layer="Bottom Tab Bar">
      {TABS.map(({ href, label }, i) => {
        const isOn = i === active || (href === "/manga" && path?.startsWith("/comics/"));
        return (
          <Link
            key={href}
            href={href}
            aria-current={isOn ? "page" : undefined}
            className={isOn ? "on" : undefined}
          >
            <span className="bic">{TAB_SVGS[label]}</span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
