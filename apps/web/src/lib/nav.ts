import { BookOpen, Bookmark, Compass, Home } from "lucide-react";

/** The four primary navigation destinations shared across desktop header and mobile bottom navigation. */
export const TABS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/manga", label: "Manga", Icon: BookOpen },
  { href: "/browse", label: "Browse", Icon: Compass },
  { href: "/profile/bookmarks", label: "Bookmarks", Icon: Bookmark },
] as const;

/** Index of the active primary tab for `path`, or -1 when on another route. */
export function tabIndex(path: string | null | undefined): number {
  if (!path) return -1;
  return TABS.findIndex((t) => (t.href === "/" ? path === "/" : path === t.href || path.startsWith(t.href + "/")));
}
