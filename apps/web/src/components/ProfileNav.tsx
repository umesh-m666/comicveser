import Link from "next/link";
const L = [["Bookmarks", "/profile/bookmarks"], ["History", "/profile/history"], ["Saved sources", "/profile/external-library"], ["Reviews", "/profile/reviews"], ["Messages & alerts", "/profile/notifications"], ["Settings", "/profile/settings"]];
export default function ProfileNav({ active }: { active: string }) {
  return <nav aria-label="Profile" className="mb-6 flex flex-wrap gap-4 text-sm">{L.map(([l, h]) => <Link key={h} href={h} className={h === active ? "font-semibold" : "text-muted hover:text-fg"}>{l}</Link>)}</nav>;
}
