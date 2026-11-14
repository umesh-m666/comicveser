"use client";
import Link from "next/link";
import { useState } from "react";
import { UserRound } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { Cover } from "./ComicCard";
import { ComicVerseLogo } from "./ComicVerseLogo";
import { UserAvatar } from "./ProfileMenu";
import { act, useLoad } from "@/lib/useApi";
import { timeAgo } from "@/lib/comics";
import { coverSrc, hueOf } from "@/lib/media";

type Profile = { avatarUrl: string | null; bio: string | null; createdAt: string };
type Stats = {
  bookmarks: number;
  chaptersRead: number;
  comicsStarted: number;
  shelves: Record<string, number>;
};
type Hist = {
  comic: { id: string; slug: string; title: string };
  chapter: { id: string; displayNumber?: string; number: number };
  imageIndex: number;
  lastReadAt: string;
}[];
type Marks = {
  items: {
    comic: { id: string; slug: string; title: string; coverUrl: string | null };
    progress: { percent: number };
  }[];
};
type ReadRows = {
  comic: { slug: string; title: string };
  chapter: { id: string; displayNumber: string };
  readAt: string;
}[];
type Notes = { prefs: { newChapter: boolean } };

/**
 * Asura Reader Profile Page (#frame-profile & #frame-mobile-profile):
 * Purple banner (.acct-banner), overlapping avatar (.acct-head), ADMIN/role badge (.pm-badge),
 * 3-column stats (.acct-stats), Overview / Completed switcher, Favourites / Bookmarks cover strip (.fav-row),
 * and Activity list.
 */
export default function AccountDashboard() {
  const { user, status } = useAuth();
  const [viewTab, setViewTab] = useState<"overview" | "completed">("overview");
  const q = (p: string) => (user ? p : null);
  const profile = useLoad<Profile>(q("/user/profile"));
  const stats = useLoad<Stats>(q("/user/stats"));
  const history = useLoad<Hist>(q("/user/history"));
  const marks = useLoad<Marks>(q("/user/bookmarks?limit=8&sort=updated"));
  const reads = useLoad<ReadRows>(q("/user/read-chapters"));
  const notes = useLoad<Notes>(q("/user/notifications"));

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-5xl space-y-4" aria-busy="true">
        <div className="skeleton h-48" />
        <div className="skeleton h-56" />
      </div>
    );
  }
  if (status === "error") {
    return (
      <p role="alert" className="text-danger">
        Can&apos;t reach the server to check your session. Check your connection and refresh the page.
      </p>
    );
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-sm py-8 text-center">
        <span className="mx-auto inline-flex items-center justify-center rounded-2xl bg-[#2F2250] px-5 py-3.5 border border-white/15 shadow-md">
          <ComicVerseLogo className="h-14 w-auto" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-white">Your ComicVerse account</h1>
        <p className="mt-2 text-sm text-muted">
          Log in to sync your bookmarks and reading history across devices.
        </p>
        <div className="mt-6 grid gap-3">
          <Link href="/login?next=%2Faccount" className="pillbtn justify-center !ml-0 py-3">
            Log in
          </Link>
          <Link href="/register" className="pillbtn ghost justify-center !ml-0 py-3">
            Create account
          </Link>
        </div>
      </div>
    );
  }

  const roleLabel = user.role.toUpperCase();
  const joinedText = profile.data?.createdAt
    ? `Joined ${new Date(profile.data.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`
    : "Active Member";

  return (
    <div>
      {/* 1. Asura Profile Banner + Header */}
      <section className="panel" data-layer="Profile Header" style={{ padding: 0, overflow: "hidden" }}>
        <div className="acct-banner flex items-center justify-end px-6"><ComicVerseLogo className="h-14 w-auto opacity-85 drop-shadow-md" /></div>
        <div className="acct-head">
          <span className="acct-av overflow-hidden">
            <UserAvatar url={profile.data?.avatarUrl} name={user.username} />
          </span>
          <div style={{ paddingBottom: 6, minWidth: 0 }}>
            <h1 style={{ fontSize: 21, margin: 0, fontWeight: 700, color: "#fff" }}>
              {user.username}
            </h1>
            <span style={{ fontSize: 12, color: "var(--muted)", display: "block" }}>
              {user.email} · {joinedText} ·{" "}
              {roleLabel === "ADMIN" ? (
                <span className="pm-badge" style={{ margin: "0 0 0 4px" }}>★ {roleLabel}</span>
              ) : (
                <span className="pm-badge user-badge" style={{ margin: "0 0 0 4px" }}>{roleLabel}</span>
              )}
            </span>
            {profile.data?.bio && (
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#d9d4e2" }}>
                {profile.data.bio}
              </p>
            )}
          </div>
          <Link
            href="/profile/settings"
            className="pillbtn ghost"
            style={{ marginLeft: "auto", marginBottom: 6 }}
          >
            ✎ Customise profile
          </Link>
        </div>

        <div style={{ padding: "4px 22px 20px" }}>
          <div className="acct-stats">
            <div className="m-stat" style={{ textAlign: "left" }}>
              <b>{stats.data?.chaptersRead ?? 0}</b>
              <span>Chapters read</span>
            </div>
            <div className="m-stat" style={{ textAlign: "left" }}>
              <b>{stats.data?.comicsStarted ?? 0}</b>
              <span>Series started</span>
            </div>
            <div className="m-stat" style={{ textAlign: "left" }}>
              <b>{stats.data?.bookmarks ?? 0}</b>
              <span>Bookmarks</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 6,
              background: "#17141f",
              borderRadius: 9,
              padding: 4,
              marginTop: 16,
            }}
          >
            <button
              type="button"
              onClick={() => setViewTab("overview")}
              className={`pillbtn ${viewTab === "overview" ? "" : "ghost"}`}
              style={{ flex: 1, justifyContent: "center", marginLeft: 0 }}
            >
              ▦ Overview
            </button>
            <button
              type="button"
              onClick={() => setViewTab("completed")}
              className={`pillbtn ${viewTab === "completed" ? "" : "ghost"}`}
              style={{ flex: 1, justifyContent: "center", marginLeft: 0 }}
            >
              ✓ Completed Chapters ({reads.data?.length ?? 0})
            </button>
          </div>
        </div>
      </section>

      {viewTab === "overview" ? (
        <>
          {/* 2. Favourites / Bookmarked Strip */}
          <section className="panel" data-layer="Favourites">
            <div className="panel-h2">
              <h2 style={{ fontSize: 16 }}>
                Bookmarks ({stats.data?.bookmarks ?? marks.data?.items.length ?? 0})
              </h2>
              <Link href="/profile/bookmarks" className="pillbtn" style={{ marginLeft: "auto" }}>
                Open library
              </Link>
            </div>
            {marks.loading ? (
              <div className="skeleton h-40" aria-busy="true" />
            ) : !marks.data?.items.length ? (
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
                No bookmarks yet.{" "}
                <Link href="/browse" style={{ color: "var(--purple-2)", fontWeight: 600 }}>
                  Browse comics
                </Link>{" "}
                and tap the bookmark button.
              </p>
            ) : (
              <div className="fav-row" id="profFavs">
                {marks.data.items.slice(0, 4).map((b) => (
                  <div key={b.comic.id}>
                    <Link
                      href={`/comics/${b.comic.slug}`}
                      className="block overflow-hidden rounded-lg"
                      aria-label={b.comic.title}
                    >
                      <Cover
                        hue={hueOf(b.comic.slug)}
                        title={b.comic.title}
                        src={coverSrc(b.comic.coverUrl)}
                        className="aspect-[3/4] w-full rounded-lg border-0"
                      />
                    </Link>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        marginTop: 6,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {b.comic.title}
                    </div>
                    <div className="m-prog" style={{ marginTop: 4 }}>
                      <i style={{ width: `${b.progress.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3. Activity / Reading History */}
          <section className="panel" data-layer="Activity">
            <div className="panel-h2">
              <h2 style={{ fontSize: 16 }}>Activity</h2>
              <Link href="/profile/history" className="pillbtn" style={{ marginLeft: "auto" }}>
                Full history
              </Link>
            </div>
            {history.loading ? (
              <div className="skeleton h-28" aria-busy="true" />
            ) : !history.data?.length ? (
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
                Nothing read yet. Your place in each comic is saved as you read.
              </p>
            ) : (
              <div id="profActivity">
                {history.data.slice(0, 6).map((h) => (
                  <Link
                    key={h.comic.id}
                    href={`/comics/${h.comic.slug}/chapter/${h.chapter.id}`}
                    className="upd"
                    style={{ padding: "10px 0" }}
                  >
                    <Cover
                      hue={hueOf(h.comic.slug)}
                      title={h.comic.title}
                      className="!h-[54px] !w-[40px] rounded-md border-0 !p-0.5"
                    />
                    <div className="u-main">
                      <h3 style={{ fontSize: 13.5, marginBottom: 2 }}>{h.comic.title}</h3>
                      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                        Chapter {h.chapter.displayNumber ?? h.chapter.number} · page{" "}
                        {h.imageIndex + 1} · ◷ {timeAgo(h.lastReadAt)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* 4. Quick Account Links & Notification Toggle */}
          <section className="panel" data-layer="Account Quick Actions">
            <div className="panel-h2">
              <h2 style={{ fontSize: 16 }}>Account &amp; Preferences</h2>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link href="/profile/notifications?tab=messages" className="rowbtn">
                ✉ Messages &amp; Alerts
              </Link>
              <Link href="/profile/history" className="rowbtn">
                ◷ Reading History
              </Link>
              <Link href="/profile/reviews" className="rowbtn">
                ★ My Reviews
              </Link>
              <Link href="/profile/external-library" className="rowbtn">
                ⇄ Saved Sources
              </Link>
              <Link href="/profile/settings" className="rowbtn">
                ⚙ Account Settings
              </Link>
              {user.role !== "ADMIN" && (
                <Link href="/creator/dashboard" className="rowbtn">
                  ✎ Creator Portal
                </Link>
              )}
            </div>
            {notes.data && (
              <label className="mt-4 flex items-center gap-2.5 text-xs text-[#d9d4e2]">
                <input
                  type="checkbox"
                  checked={notes.data.prefs.newChapter}
                  onChange={async (e) => {
                    await act("/user/notification-settings", "PUT", {
                      newChapter: e.target.checked,
                    });
                    notes.reload();
                  }}
                />
                Notify me when a bookmarked comic has a new chapter
              </label>
            )}
          </section>
        </>
      ) : (
        <section className="panel" data-layer="Completed Chapters">
          <div className="panel-h2">
            <h2 style={{ fontSize: 16 }}>Completed Chapters</h2>
          </div>
          {reads.loading ? (
            <div className="skeleton h-28" aria-busy="true" />
          ) : !reads.data?.length ? (
            <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
              Chapters you finish appear here, in purple, as you read them.
            </p>
          ) : (
            <div className="space-y-1.5">
              {reads.data.map((r) => (
                <Link
                  key={r.chapter.id}
                  href={`/comics/${r.comic.slug}/chapter/${r.chapter.id}`}
                  data-state="read"
                  className="chaprow"
                >
                  <span className="n">
                    {r.comic.title} · Chapter {r.chapter.displayNumber}
                  </span>
                  <span className="w">{timeAgo(r.readAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
