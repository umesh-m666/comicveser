"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Cover } from "./ComicCard";
import { ApiError, api } from "@/lib/api";
import { timeAgo } from "@/lib/comics";
import { coverSrc, hueOf } from "@/lib/media";
import { act } from "@/lib/useApi";
import { useAuth } from "./AuthProvider";

type Status = "READING" | "COMPLETED" | "PLAN_TO_READ" | "ON_HOLD" | "DROPPED";
type Sort = "updated" | "added" | "title";
interface Item {
  bookmarkedAt: string;
  lastUpdatedAt: string | null;
  status: Status;
  statusSource: "auto" | "manual";
  comic: {
    id: string;
    slug: string;
    title: string;
    type: string;
    status: string;
    coverUrl: string | null;
    totalChapters: number;
    latestChapter: { id: string; number: number; displayNumber: string } | null;
  };
  progress: {
    readCount: number;
    percent: number;
    lastReadAt: string | null;
    current: {
      chapterId: string;
      number: number;
      displayNumber: string;
      imageIndex: number;
    } | null;
  };
}
interface Page {
  total: number;
  page: number;
  pageSize: number;
  counts: Record<string, number>;
  items: Item[];
}

const TABS: { key: "ALL" | Status; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "READING", label: "Reading" },
  { key: "PLAN_TO_READ", label: "Plan to Read" },
  { key: "COMPLETED", label: "Completed" },
  { key: "ON_HOLD", label: "On Hold" },
  { key: "DROPPED", label: "Dropped" },
];
const LABEL = Object.fromEntries(TABS.map((t) => [t.key, t.label])) as Record<string, string>;
const SORTS: { key: Sort; label: string }[] = [
  { key: "updated", label: "Recently updated" },
  { key: "added", label: "Recently added" },
  { key: "title", label: "A – Z" },
];

const STATUS_DOT_COLOR: Record<Status, string> = {
  READING: "#3b82f6",
  COMPLETED: "#34d399",
  PLAN_TO_READ: "#a855f7",
  ON_HOLD: "#f59e0b",
  DROPPED: "#f87171",
};

/**
 * Asura-style Bookmarks Library (#frame-bookmarks & #frame-mobile-bookmarks)
 * with Library Stats, Continue Reading strip, Bookmark Cards with status pill + fraction badge,
 * and Interactive Bookmark Detail Modal (.bm-modal).
 */
export default function BookmarksView() {
  const router = useRouter();
  const { user, status: sessionStatus } = useAuth();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [tab, setTab] = useState<"ALL" | Status>("ALL");
  const [sort, setSort] = useState<Sort>("updated");
  const [pageNo, setPageNo] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  // Bookmark Detail Modal state
  const [modalItem, setModalItem] = useState<Item | null>(null);
  const [modalChapNum, setModalChapNum] = useState<number>(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setDq(q.trim());
      setPageNo(1);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!user || sessionStatus === "loading") return;
    const controller = new AbortController();
    const p = new URLSearchParams({ sort, page: String(pageNo), limit: "24" });
    if (tab !== "ALL") p.set("status", tab);
    if (dq) p.set("q", dq);
    setState((s) => (data ? s : "loading"));

    api<Page>(`/user/bookmarks?${p}`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => {
        if (controller.signal.aborted) return;
        if (r.items.length === 0 && pageNo > 1) {
          setPageNo(pageNo - 1);
          return;
        }
        setData(r);
        setState("ok");
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        if (!(e instanceof ApiError && e.status === 401)) setState("error");
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sessionStatus, tab, sort, dq, pageNo, reloadTick]);

  const reload = useCallback(() => setReloadTick((n) => n + 1), []);

  const remove = async (it: Item) => {
    setBusy(it.comic.id);
    setErr("");
    try {
      await act(`/user/bookmarks/${it.comic.id}`, "DELETE");
      setData((d) =>
        d
          ? {
              ...d,
              total: d.total - 1,
              items: d.items.filter((x) => x.comic.id !== it.comic.id),
            }
          : d,
      );
      if (modalItem?.comic.id === it.comic.id) setModalItem(null);
      reload();
      window.dispatchEvent(new Event("cv:bookmarks"));
    } catch {
      setErr("Couldn't remove that bookmark. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const setStatus = async (it: Item, s: Status | "AUTO") => {
    setBusy(it.comic.id);
    setErr("");
    try {
      await act(`/user/bookmarks/${it.comic.id}/status`, "PUT", { status: s });
      reload();
    } catch {
      setErr("Couldn't change the status. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const openModal = (it: Item) => {
    const curNum = it.progress.current?.number ?? it.progress.readCount ?? 0;
    setModalItem(it);
    setModalChapNum(curNum);
  };

  const counts = data?.counts ?? {};
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const total = counts.ALL ?? data?.total ?? 0;
  const filtered = tab !== "ALL" || !!dq;

  const items = data?.items ?? [];
  const updatesWaiting = items.filter(
    (it) => it.comic.totalChapters > (it.progress.current?.number ?? it.progress.readCount ?? 0),
  ).length;
  const totalLibraryChapters = items.reduce((acc, it) => acc + (it.comic.totalChapters || 0), 0);
  const avgProgress = items.length
    ? Math.round(items.reduce((acc, it) => acc + (it.progress.percent || 0), 0) / items.length)
    : 0;
  const continueItems = items.filter((it) => it.progress.current).slice(0, 3);

  const skeleton = useMemo(
    () => (
      <div className="browse-grid" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton aspect-[3/4] w-full rounded-xl" />
        ))}
      </div>
    ),
    [],
  );

  return (
    <div>
      {/* 1. Library Header Panel */}
      <section className="panel" data-layer="Library Header">
        <div className="panel-h2">
          <span className="ic" aria-hidden="true">
            ▸
          </span>
          <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: "#fff" }}>
            Your Bookmarks
          </h1>
          <span style={{ color: "var(--muted)", fontSize: 12.5 }} id="bmSummary">
            {data
              ? `${total} saved · ${updatesWaiting} with new chapters`
              : "Loading your library…"}
          </span>
          <Link href="/browse" className="pillbtn" style={{ marginLeft: "auto" }}>
            ＋ Browse Comics
          </Link>
        </div>

        <div className="bm-stats">
          <div className="m-stat" style={{ textAlign: "left" }}>
            <b>{total}</b>
            <span>Saved comics</span>
          </div>
          <div className="m-stat" style={{ textAlign: "left" }}>
            <b style={{ color: "var(--purple-2)" }}>{updatesWaiting}</b>
            <span>New chapters waiting</span>
          </div>
          <div className="m-stat" style={{ textAlign: "left" }}>
            <b>{totalLibraryChapters.toLocaleString()}</b>
            <span>Chapters in library</span>
          </div>
          <div className="m-stat" style={{ textAlign: "left" }}>
            <b>{avgProgress}%</b>
            <span>Average progress</span>
          </div>
        </div>
      </section>

      {/* 2. Continue Reading Strip */}
      {continueItems.length > 0 && (
        <section className="panel" data-layer="Continue Reading">
          <div className="panel-h2">
            <span className="ic" aria-hidden="true">
              ▶
            </span>
            <h2 style={{ fontSize: 17 }}>Continue Reading</h2>
          </div>
          <div className="bm-continue">
            {continueItems.map((it) => {
              const c = it.comic;
              const cur = it.progress.current!;
              const left = Math.max(0, c.totalChapters - cur.number);
              return (
                <div key={c.id} className="bm-cont-card">
                  <Cover
                    hue={hueOf(c.slug)}
                    title={c.title}
                    src={coverSrc(c.coverUrl)}
                    className="bm-cont-cov border-0 !p-1"
                  />
                  <div className="bm-cont-info">
                    <h4>{c.title}</h4>
                    <span>Last read · Chapter {cur.displayNumber}</span>
                    <div className="m-prog">
                      <i style={{ width: `${it.progress.percent}%` }} />
                    </div>
                    <span className="bm-cont-meta">
                      Chapter {cur.displayNumber} of {c.totalChapters}
                      {left > 0 ? ` · ${left} new` : " · Caught up"}
                    </span>
                  </div>
                  <Link
                    href={`/comics/${c.slug}/chapter/${cur.chapterId}`}
                    className="pillbtn"
                    style={{ marginLeft: 0 }}
                  >
                    Continue Ch. {cur.displayNumber}
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Library Filters + Grid Panel */}
      <section className="panel" data-layer="Library Filters + Grid">
        <div className="browse-tools">
          <label className="s-search" htmlFor="bm-q">
            <span aria-hidden="true">⌕</span>
            <input
              id="bm-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search your library…"
              aria-label="Search your bookmarks"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear search"
                style={{
                  background: "none",
                  border: 0,
                  color: "var(--muted)",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                ✕
              </button>
            )}
          </label>

          <span id="bmChips" style={{ display: "contents" }} role="tablist" aria-label="Filter by status">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                data-active={tab === t.key}
                className={`chip${tab === t.key ? " on" : ""}`}
                onClick={() => {
                  setTab(t.key);
                  setPageNo(1);
                }}
              >
                {t.label}
                {data && (
                  <span style={{ opacity: 0.7, fontSize: 11 }}>
                    ({counts[t.key] ?? (t.key === "ALL" ? total : 0)})
                  </span>
                )}
              </button>
            ))}
          </span>

          <span style={{ flex: 1 }} />

          <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
            SORT&nbsp;
            <select
              aria-label="Sort bookmarks"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as Sort);
                setPageNo(1);
              }}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {err && (
          <p role="alert" className="mb-3 text-sm text-danger">
            {err}
          </p>
        )}

        {state === "loading" && skeleton}
        {state === "error" && (
          <div role="alert" className="empty-note">
            We couldn&apos;t load your bookmarks.{" "}
            <button type="button" onClick={reload} className="pillbtn" style={{ marginLeft: 8 }}>
              Try again
            </button>
          </div>
        )}

        {state === "ok" && data && data.items.length === 0 && (
          <div className="empty-note" id="bmEmpty">
            {filtered
              ? "No bookmarks match. Try another filter or clear the search."
              : "Your bookmark library is empty. Click Bookmark on any comic card to save it here."}
            <div style={{ marginTop: 14 }}>
              {filtered ? (
                <button
                  type="button"
                  onClick={() => {
                    setTab("ALL");
                    setQ("");
                  }}
                  className="pillbtn"
                >
                  Clear filters
                </button>
              ) : (
                <Link href="/browse" className="pillbtn">
                  Browse comics
                </Link>
              )}
            </div>
          </div>
        )}

        {state === "ok" && data && data.items.length > 0 && (
          <>
            <div
              className="browse-grid"
              id="bmGrid"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}
            >
              {data.items.map((it) => {
                const c = it.comic;
                const cur = it.progress.current;
                const readNum = cur?.number ?? it.progress.readCount ?? 0;
                const left = Math.max(0, c.totalChapters - readNum);
                const readHref = cur
                  ? `/comics/${c.slug}/chapter/${cur.chapterId}`
                  : it.comic.latestChapter
                  ? `/comics/${c.slug}/chapter/${it.comic.latestChapter.id}`
                  : `/comics/${c.slug}`;
                const dotColor = STATUS_DOT_COLOR[it.status] ?? "#3b82f6";

                return (
                  <div
                    key={c.id}
                    className="bm-card"
                    style={busy === c.id ? { opacity: 0.6, pointerEvents: "none" } : undefined}
                    onClick={(e) => {
                      if (
                        (e.target as HTMLElement).closest(".bm-actions") ||
                        (e.target as HTMLElement).closest("a") ||
                        (e.target as HTMLElement).closest("select")
                      ) {
                        return;
                      }
                      openModal(it);
                    }}
                  >
                    <div className="ccard">
                      <span className="cov">
                        <Cover
                          hue={hueOf(c.slug)}
                          title={c.title}
                          src={coverSrc(c.coverUrl)}
                          className="h-full w-full rounded-none border-0"
                        />
                        <span className="bm-status">
                          <span className="dot" style={{ background: dotColor }} />
                          {LABEL[it.status] ?? "Reading"}
                        </span>
                        {left > 0 && <span className="bm-new">{left} NEW</span>}
                        <span className="bm-frac">
                          {readNum}/{c.totalChapters}
                        </span>
                      </span>
                      <Link href={`/comics/${c.slug}`}>
                        <h3 title={c.title}>{c.title}</h3>
                      </Link>
                    </div>

                    <div className="bm-meta">
                      <span className="stars">
                        ★★★★★<b>9.5</b>
                      </span>
                      <span
                        className="status-dot"
                        style={{
                          background:
                            c.status.toLowerCase() === "completed"
                              ? "var(--purple-2)"
                              : "var(--green)",
                        }}
                      />
                      <span>{c.status}</span>
                    </div>

                    <div className="m-prog" style={{ margin: "7px 0 5px" }}>
                      <i style={{ width: `${it.progress.percent}%` }} />
                    </div>

                    <div className="bm-meta">
                      <span>
                        Read to Ch. {cur?.displayNumber ?? readNum} of {c.totalChapters}
                      </span>
                      <span suppressHydrationWarning>
                        {timeAgo(it.progress.lastReadAt ?? it.bookmarkedAt) || "Saved"}
                      </span>
                    </div>

                    <div className="mt-2">
                      <select
                        aria-label={`Reading status for ${c.title}`}
                        value={it.statusSource === "manual" ? it.status : "AUTO"}
                        onChange={(e) => void setStatus(it, e.target.value as Status | "AUTO")}
                        className="w-full rounded-md border border-[#353247] bg-[#17141f] px-2.5 py-1.5 text-xs font-semibold text-[#d9d5e8]"
                      >
                        <option value="AUTO">{LABEL[it.status]} (auto)</option>
                        {TABS.slice(1).map((t) => (
                          <option key={t.key} value={t.key}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="bm-actions">
                      <Link
                        href={readHref}
                        className="pillbtn"
                        style={{ flex: 1, justifyContent: "center" }}
                      >
                        {cur ? `Continue Ch. ${cur.displayNumber}` : "Start Reading"}
                      </Link>
                      <button
                        type="button"
                        onClick={() => openModal(it)}
                        className="rowbtn"
                        title="Bookmark details"
                        aria-label={`Details for ${c.title}`}
                      >
                        ⚙
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(it)}
                        className="rowbtn danger bm-remove"
                        aria-label={`Remove ${c.title} from bookmarks`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {pages > 1 && (
              <nav aria-label="Pages" className="pager">
                <button
                  type="button"
                  disabled={pageNo <= 1}
                  onClick={() => setPageNo((p) => p - 1)}
                >
                  ‹ Previous
                </button>
                <button type="button" className="on">
                  Page {pageNo} of {pages}
                </button>
                <button
                  type="button"
                  disabled={pageNo >= pages}
                  onClick={() => setPageNo((p) => p + 1)}
                >
                  Next ›
                </button>
              </nav>
            )}
          </>
        )}
      </section>

      {/* Asura Bookmark Detail Modal (.bm-modal-overlay / .bm-modal) */}
      {modalItem && (
        <div
          className="bm-modal-overlay"
          data-layer="Bookmark Detail Modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalItem(null);
          }}
        >
          <div className="bm-modal" role="dialog" aria-modal="true" aria-label={modalItem.comic.title}>
            <div className="bmm-head">
              <Cover
                hue={hueOf(modalItem.comic.slug)}
                title={modalItem.comic.title}
                src={coverSrc(modalItem.comic.coverUrl)}
                className="bmm-cov border-0 !p-1"
              />
              <div style={{ minWidth: 0 }}>
                <h3>{modalItem.comic.title}</h3>
                <span className="bdate">
                  Bookmarked ·{" "}
                  {timeAgo(modalItem.progress.lastReadAt ?? modalItem.bookmarkedAt) || "recently"}
                </span>
                <span className="bmm-type">{modalItem.comic.type || "Manhwa"}</span>
              </div>
              <button
                type="button"
                className="bmm-x"
                aria-label="Close"
                onClick={() => setModalItem(null)}
              >
                ✕
              </button>
            </div>

            <div className="bmm-stepper">
              <button
                type="button"
                className="bmm-step minus"
                aria-label="Previous chapter"
                disabled={modalChapNum <= 0}
                onClick={() => setModalChapNum((n) => Math.max(0, n - 1))}
              >
                −
              </button>
              <span className="bmm-cur">
                Chapter {modalChapNum} / {modalItem.comic.totalChapters}
              </span>
              <button
                type="button"
                className="bmm-step plus"
                aria-label="Next chapter"
                disabled={modalChapNum >= modalItem.comic.totalChapters}
                onClick={() =>
                  setModalChapNum((n) => Math.min(modalItem.comic.totalChapters, n + 1))
                }
              >
                +
              </button>
            </div>

            <button
              type="button"
              className="set-latest"
              onClick={() => setModalChapNum(modalItem.comic.totalChapters)}
            >
              Set to Chapter {modalItem.comic.totalChapters}
            </button>

            <div className="bmm-prog">
              <i
                style={{
                  width: `${
                    modalItem.comic.totalChapters
                      ? Math.round((modalChapNum / modalItem.comic.totalChapters) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="bmm-prog-l">
              <span className="pl">Chapter {modalChapNum}</span>
              <span className="pr">
                {modalItem.comic.totalChapters - modalChapNum > 0
                  ? `${modalItem.comic.totalChapters - modalChapNum} behind`
                  : "Caught up"}
              </span>
            </div>

            <select
              className="status-sel"
              aria-label="Reading status"
              value={modalItem.statusSource === "manual" ? modalItem.status : "AUTO"}
              onChange={(e) => {
                const nextStatus = e.target.value as Status | "AUTO";
                void setStatus(modalItem, nextStatus);
              }}
            >
              <option value="AUTO">{LABEL[modalItem.status]} (auto)</option>
              {TABS.slice(1).map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>

            <div className="bmm-actions">
              <Link
                href={
                  modalItem.progress.current
                    ? `/comics/${modalItem.comic.slug}/chapter/${modalItem.progress.current.chapterId}`
                    : `/comics/${modalItem.comic.slug}`
                }
                className="bmm-play"
                onClick={() => setModalItem(null)}
              >
                ▶{" "}
                {modalItem.progress.current
                  ? `Chapter ${modalItem.progress.current.displayNumber}`
                  : "Read Now"}
              </Link>
              <button
                type="button"
                className="bmm-sq info"
                aria-label="About this comic"
                onClick={() => {
                  const slug = modalItem.comic.slug;
                  setModalItem(null);
                  router.push(`/comics/${slug}`);
                }}
              >
                ⓘ
              </button>
              <button
                type="button"
                className="bmm-sq del"
                aria-label="Remove bookmark"
                onClick={() => void remove(modalItem)}
              >
                🗑
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
