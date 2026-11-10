import { BookOpen, Bookmark, Compass, Home, Layers } from "lucide-react";

/** Primary comic navigation destinations shared across desktop and mobile. */
export const TABS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/manga", label: "Manga", Icon: BookOpen },
  { href: "/browse", label: "Browse", Icon: Compass },
  { href: "/sources", label: "Resources", Icon: Layers },
  { href: "/profile/bookmarks", label: "Bookmarks", Icon: Bookmark },
] as const;

/** Resources dropdown items on desktop and informational links. */
export const RESOURCES = [
  { href: "/sources", label: "Source library" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/copyright-policy", label: "Copyright" },
] as const;

/** Index of the active primary tab for `path`, or -1 when on another route. */
export function tabIndex(path: string | null | undefined): number {
  if (!path) return -1;
  if (RESOURCES.some((r) => path === r.href || path.startsWith(r.href + "/"))) {
    return 3;
  }
  return TABS.findIndex((t) => (t.href === "/" ? path === "/" : path === t.href || path.startsWith(t.href + "/")));
}
