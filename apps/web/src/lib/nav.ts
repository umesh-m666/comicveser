import { BookOpen, BookText, Bookmark, Compass, Home } from "lucide-react";

/** The five primary destinations, shared by the desktop links and the mobile bottom bar (same order, same targets). */
export const TABS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/novels", label: "Novels", Icon: BookText },
  { href: "/manga", label: "Manga", Icon: BookOpen },
  { href: "/browse", label: "Browse", Icon: Compass },
  { href: "/profile/bookmarks", label: "Bookmarks", Icon: Bookmark },
] as const;

/** Resources dropdown: every informational page the site already has. */
export const RESOURCES = [
  { href: "/sources", label: "Source library" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/copyright-policy", label: "Copyright" },
] as const;

/** Index of the tab that owns `path`, or -1 when the page isn't one of the five (account, reader, comic details...). */
export function tabIndex(path: string | null | undefined): number {
  if (!path) return -1;
  return TABS.findIndex((t) => (t.href === "/" ? path === "/" : path === t.href || path.startsWith(t.href + "/")));
}
