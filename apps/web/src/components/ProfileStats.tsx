import { Bookmark, MessageSquare, Sparkles } from "lucide-react";

/** Short relative time, e.g. "just now", "3 hr ago", "2 days ago". */
export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const w = Math.floor(days / 7);
  if (w < 5) return `${w} wk ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Day-group heading for history, e.g. "Today", "Yesterday", "2 days ago". */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(new Date()) - startOf(d)) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  if (diff < 14) return "Last week";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function hueOf(s: string): number {
  return [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
}

/** API comic types arrive upper-case ("MANHWA"); display them as "Manhwa". */
export function capType(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function ProfileAvatar({
  username,
  avatarUrl,
  className = "h-20 w-20 text-2xl",
}: {
  username: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt={`${username}'s profile picture`} className={`rounded-full border-4 border-[#100e16] object-cover ${className}`} />;
  }
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-4 border-[#100e16] bg-gradient-to-br from-[#9333EA] to-[#C084FC] font-extrabold text-white ${className}`}
    >
      {username.charAt(0).toUpperCase()}
    </span>
  );
}

export function ProfileStats({ aura, comments, bookmarks }: { aura: number; comments: number; bookmarks: number }) {
  const cards = [
    { label: "Aura", value: aura, icon: Sparkles, tint: "text-[#FBBF24]" },
    { label: "Comments", value: comments, icon: MessageSquare, tint: "text-[#C084FC]" },
    { label: "Bookmarks", value: bookmarks, icon: Bookmark, tint: "text-[#34D399]" },
  ];
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      {cards.map(({ label, value, icon: Icon, tint }) => (
        <div key={label} className="rounded-xl border border-[#322A42] bg-[#17141F] p-3 sm:p-4">
          <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A8A1B5]`}>
            <Icon size={14} className={tint} aria-hidden /> {label}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">{value}</p>
        </div>
      ))}
    </div>
  );
}
