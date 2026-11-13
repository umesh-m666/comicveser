import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Cover } from "./ComicCard";
import { hueOf, timeAgo } from "./ProfileStats";

export interface ActivityItem {
  slug: string;
  title: string;
  chapterId: string;
  /** Display chapter number, e.g. "12" or "Special". */
  chapterNumber: string;
  chapterTitle: string;
  lastReadAt: string;
  /** e.g. "Manhwa" — only when the comic's type is known. */
  type?: string | null;
}

export function ActivityRow({ item, onDelete }: { item: ActivityItem; onDelete?: () => void }) {
  const href = `/comics/${item.slug}/chapter/${item.chapterId}`;
  return (
    <li className="flex items-center gap-3 rounded-xl border border-[#322A42] bg-[#17141F] p-3 sm:gap-4">
      <Link href={`/comics/${item.slug}`} className="shrink-0" aria-label={item.title}>
        <Cover hue={hueOf(item.slug)} title={item.title} className="aspect-[2/3] w-12 sm:w-14" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={href} className="truncate font-semibold text-white hover:text-[#C084FC]">
            {item.title}
          </Link>
          {item.type && (
            <span className="rounded-full border border-[#322A42] bg-[#211B2D] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#A8A1B5]">
              {item.type}
            </span>
          )}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#A8A1B5]">
          <span className="rounded-full bg-[#9333EA] px-2 py-0.5 text-xs font-bold text-white">
            Chapter {item.chapterNumber}
          </span>
          <span className="truncate">{item.chapterTitle}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{timeAgo(item.lastReadAt)}</span>
        </p>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Remove ${item.title} from history`}
          title="Remove from history"
          className="shrink-0 rounded-lg border border-[#322A42] p-2 text-[#A8A1B5] transition hover:border-[#FB7185] hover:text-[#FB7185]"
        >
          <Trash2 size={16} />
        </button>
      )}
      <Link
        href={href}
        className="hidden shrink-0 rounded-lg bg-[#9333EA] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#7E22CE] sm:inline-flex"
      >
        Continue
      </Link>
    </li>
  );
}

export function ProfileActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-[#A8A1B5]">Nothing read yet. Your place in each comic is saved as you read.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <ActivityRow key={`${item.slug}-${item.chapterId}`} item={item} />
      ))}
    </ul>
  );
}
