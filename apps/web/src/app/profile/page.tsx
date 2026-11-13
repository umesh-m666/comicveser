"use client";
import Link from "next/link";
import { useState } from "react";
import { MessageSquare, Pencil } from "lucide-react";
import ProfileNav from "@/components/ProfileNav";
import { Cover } from "@/components/ComicCard";
import { ProfileActivityList, type ActivityItem } from "@/components/ProfileActivity";
import { ProfileAvatar, ProfileStats, capType, hueOf } from "@/components/ProfileStats";
import { State } from "@/components/admin/ui";
import { ApiError } from "@/lib/api";
import { useLoad } from "@/lib/useApi";

type Profile = { id: string; username: string; email: string; createdAt: string; avatarUrl: string | null; bio: string | null };
type BookmarkItem = {
  bookmarkedAt: string;
  comic: {
    id: string;
    slug: string;
    title: string;
    type: string;
    latestChapter: { id: string; number: number; displayNumber?: string } | null;
  };
};
type HistoryItem = {
  comic: { id: string; slug: string; title: string };
  chapter: { id: string; number: number; displayNumber?: string; title: string };
  imageIndex: number;
  lastReadAt: string;
};
type Review = { id: string; body: string; rating: number | null; createdAt: string; comic: { slug: string; title: string } };

function BookmarkCard({ item }: { item: BookmarkItem }) {
  const latest = item.comic.latestChapter;
  return (
    <Link href={`/comics/${item.comic.slug}`} className="group block w-full">
      <div className="relative">
        <Cover
          hue={hueOf(item.comic.slug)}
          title={item.comic.title}
          className="aspect-[2/3] transition duration-200 group-hover:border-[#9333EA]"
        />
        <span className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90">
          {capType(item.comic.type)}
        </span>
      </div>
      <h3 className="mt-2 line-clamp-1 text-sm font-bold text-white group-hover:text-[#C084FC]">{item.comic.title}</h3>
      <p className="mt-0.5 text-xs text-[#A8A1B5]">
        {latest ? `Chapter ${latest.displayNumber ?? latest.number}` : "No chapters yet"}
      </p>
    </Link>
  );
}

export default function Profile() {
  const profile = useLoad<Profile>("/user/profile");
  const bookmarks = useLoad<{ total: number; page: number; items: BookmarkItem[] }>("/user/bookmarks");
  const history = useLoad<HistoryItem[]>("/user/history");
  const reviews = useLoad<Review[]>("/user/reviews");
  const [tab, setTab] = useState<"overview" | "comments">("overview");

  if (profile.error instanceof ApiError && profile.error.status === 401) {
    return (
      <p>
        Please <Link href="/login" className="text-[#C084FC]">log in</Link> to see your profile.
      </p>
    );
  }

  const typeBySlug = new Map((bookmarks.data?.items ?? []).map((b) => [b.comic.slug, capType(b.comic.type)]));
  const activity: ActivityItem[] = (history.data ?? []).map((h) => ({
    slug: h.comic.slug,
    title: h.comic.title,
    chapterId: h.chapter.id,
    chapterNumber: h.chapter.displayNumber ?? String(h.chapter.number),
    chapterTitle: h.chapter.title,
    lastReadAt: h.lastReadAt,
    type: typeBySlug.get(h.comic.slug) ?? null,
  }));

  return (
    <div className="space-y-6">
      <ProfileNav active="/profile" />
      <State loading={profile.loading} error={profile.error} />
      {profile.data && (
        <>
          {/* Header: banner, avatar, name, joined date */}
          <section aria-label="Profile header">
            <div className="h-28 rounded-2xl border border-[#322A42] bg-gradient-to-r from-[#9333EA] via-[#5B21B6] to-[#211B2D] sm:h-36" />
            <div className="-mt-10 flex flex-wrap items-end gap-4 px-2 sm:px-4">
              <ProfileAvatar username={profile.data.username} avatarUrl={profile.data.avatarUrl} />
              <div className="min-w-0 flex-1 pb-1">
                <h1 className="truncate text-2xl font-extrabold text-white">{profile.data.username}</h1>
                <p className="text-sm text-[#A8A1B5]">
                  Joined {new Date(profile.data.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </p>
                {profile.data.bio && <p className="mt-1 text-sm text-white/90">{profile.data.bio}</p>}
              </div>
              <div className="flex flex-wrap gap-2 pb-1">
                <Link
                  href="/profile/messages"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#322A42] bg-[#17141F] px-3 py-2 text-sm font-semibold text-white transition hover:border-[#9333EA]"
                >
                  <MessageSquare size={15} /> Messages
                </Link>
                <Link
                  href="/profile/settings"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#9333EA] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#7E22CE]"
                >
                  <Pencil size={15} /> Customise profile
                </Link>
              </div>
            </div>
          </section>

          {/* Stat cards — Aura has no API yet, so it reads 0; Comments and Bookmarks are real counts. */}
          <ProfileStats aura={0} comments={reviews.data?.length ?? 0} bookmarks={bookmarks.data?.total ?? 0} />

          {/* Tabs */}
          <div role="tablist" aria-label="Profile sections" className="flex gap-1 border-b border-[#322A42]">
            {(
              [
                ["overview", "Overview"],
                ["comments", `Comments${reviews.data ? ` (${reviews.data.length})` : ""}`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
                  tab === key ? "border-[#9333EA] text-white" : "border-transparent text-[#A8A1B5] hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "overview" ? (
            <div className="space-y-8">
              {/* Favourites */}
              <section aria-label="Favourites">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-lg font-bold text-white">Favourites</h2>
                  <Link href="/profile/bookmarks" className="text-sm font-semibold text-[#C084FC] hover:underline">
                    View all
                  </Link>
                </div>
                {bookmarks.loading ? (
                  <div className="flex gap-3" aria-busy="true">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="skeleton aspect-[2/3] w-28 shrink-0 sm:w-32" />
                    ))}
                  </div>
                ) : bookmarks.data && bookmarks.data.items.length > 0 ? (
                  <div className="scroll-row">
                    {bookmarks.data.items.map((b) => (
                      <div key={b.comic.id} className="w-28 shrink-0 sm:w-32">
                        <BookmarkCard item={b} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#A8A1B5]">
                    No favourites yet. Open a comic and choose Bookmark — it will show up here.{" "}
                    <Link href="/browse" className="font-semibold text-[#C084FC] hover:underline">
                      Browse comics
                    </Link>
                  </p>
                )}
              </section>

              {/* Activity */}
              <section aria-label="Activity">
                <h2 className="mb-3 text-lg font-bold text-white">Activity</h2>
                {history.loading ? (
                  <div className="space-y-2" aria-busy="true">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="skeleton h-20" />
                    ))}
                  </div>
                ) : (
                  <ProfileActivityList items={activity.slice(0, 6)} />
                )}
                {activity.length > 6 && (
                  <Link href="/profile/history" className="mt-3 inline-block text-sm font-semibold text-[#C084FC] hover:underline">
                    View full history
                  </Link>
                )}
              </section>

              {/* Bookmarks grid */}
              <section aria-label="Bookmarks">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-lg font-bold text-white">Bookmarks</h2>
                  <Link href="/profile/bookmarks" className="text-sm font-semibold text-[#C084FC] hover:underline">
                    View all
                  </Link>
                </div>
                {bookmarks.loading ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6" aria-busy="true">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="skeleton aspect-[2/3]" />
                    ))}
                  </div>
                ) : bookmarks.data && bookmarks.data.items.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                    {bookmarks.data.items.map((b) => (
                      <BookmarkCard key={b.comic.id} item={b} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#A8A1B5]">No bookmarks yet. Open a comic and choose Bookmark.</p>
                )}
              </section>
            </div>
          ) : (
            /* Comments tab: the user's own reviews. */
            <section aria-label="Comments">
              <h2 className="mb-3 text-lg font-bold text-white">Comments</h2>
              {reviews.loading ? (
                <div className="space-y-2" aria-busy="true">
                  {[0, 1].map((i) => (
                    <div key={i} className="skeleton h-20" />
                  ))}
                </div>
              ) : reviews.data && reviews.data.length > 0 ? (
                <ul className="space-y-3">
                  {reviews.data.map((r) => (
                    <li key={r.id} className="rounded-xl border border-[#322A42] bg-[#17141F] p-4">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/comics/${r.comic.slug}`} className="font-semibold text-white hover:text-[#C084FC]">
                          {r.comic.title}
                        </Link>
                        <span className="shrink-0 text-sm text-[#A8A1B5]">
                          {r.rating ? `${r.rating}/10 · ` : ""}
                          {new Date(r.createdAt).toLocaleDateString("en-IN")}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-white/90">{r.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#A8A1B5]">You haven&apos;t written any comments yet.</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
