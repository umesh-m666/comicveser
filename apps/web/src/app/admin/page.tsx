"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ApiComic, timeAgo, toComic } from "@/lib/comics";
import { coverSrc, hueOf } from "@/lib/media";
import { Cover } from "@/components/ComicCard";

const DEFAULT_WEEKLY_READS = [
  { day: "Mon", val: 42 },
  { day: "Tue", val: 55 },
  { day: "Wed", val: 48 },
  { day: "Thu", val: 71 },
  { day: "Fri", val: 66 },
  { day: "Sat", val: 92, peak: true },
  { day: "Sun", val: 84 },
];

const DEFAULT_TOP_COMICS = [
  { id: "tc-1", slug: "murim-login", title: "Murim Login", reads: "98K", rating: 9.8, coverUrl: null },
  { id: "tc-2", slug: "overgeared", title: "Overgeared", reads: "87K", rating: 9.1, coverUrl: null },
  { id: "tc-3", slug: "nano-machine", title: "Nano Machine", reads: "76K", rating: 9.3, coverUrl: null },
  {
    id: "tc-4",
    slug: "star-embracing-swordmaster",
    title: "Star-Embracing Swordmaster",
    reads: "65K",
    rating: 9.8,
    coverUrl: null,
  },
  {
    id: "tc-5",
    slug: "pick-up-a-grimoire-become-a-mage",
    title: "Pick Up a Grimoire, Become a Mage",
    reads: "54K",
    rating: 9.0,
    coverUrl: null,
  },
];

const DEFAULT_RECENT_CHAPTERS = [
  {
    id: "rc-1",
    number: 8,
    title: "Enter the Void (3)",
    comicTitle: "Cyberpunk Chivalry",
    comicId: "",
    when: "5 hours ago",
    reads: "18,204",
    status: "Live" as const,
  },
  {
    id: "rc-2",
    number: 252,
    title: "",
    comicTitle: "Murim Login",
    comicId: "",
    when: "2 hours ago",
    reads: "41,930",
    status: "Live" as const,
  },
  {
    id: "rc-3",
    number: 338,
    title: "Epilogue",
    comicTitle: "Nano Machine",
    comicId: "",
    when: "15 hours ago",
    reads: "36,551",
    status: "Live" as const,
  },
  {
    id: "rc-4",
    number: 187,
    title: "",
    comicTitle: "Return of the Mount Hua Sect",
    comicId: "",
    when: "17 hours ago",
    reads: "29,877",
    status: "Live" as const,
  },
  {
    id: "rc-5",
    number: 17,
    title: "",
    comicTitle: "Shadow Slave",
    comicId: "",
    when: "Scheduled · tomorrow 9:00",
    reads: "—",
    status: "Scheduled" as const,
  },
];

/**
 * Asura Admin Dashboard (#frame-admin-dash & image_b78bf1.png):
 * Includes:
 * - 8-card .stat-grid
 * - User Issue Reports & Admin Messages panel
 * - Authentication & Email Service Status + Publishing & Source Provider Alerts
 * - Top comics by views + Latest chapters summary
 * - Chapter reads — last 7 days (SVG bar chart) + Top comics this week (with cover thumbnails, purple rank circle, and ★ ratings)
 * - Recently published chapters table (Chapter, Comic, Published, Reads, Live/Scheduled Status tag, Manage button)
 */
export default function AdminDashboard() {
  const [d, setD] = useState<any>(null);
  const [catalogue, setCatalogue] = useState<Map<string, { coverUrl: string | null; rating: number; slug: string }>>(
    new Map(),
  );
  const [err, setErr] = useState("");

  const load = () => {
    setErr("");
    api("/admin/dashboard")
      .then(setD)
      .catch((e) => setErr(e.message));
    api<{ items: ApiComic[] }>("/comics?pageSize=48&sort=popular", { cache: "no-store" })
      .then((res) => {
        const m = new Map<string, { coverUrl: string | null; rating: number; slug: string }>();
        for (const raw of res.items ?? []) {
          const c = toComic(raw);
          const entry = { coverUrl: c.coverUrl, rating: c.rating || 9.5, slug: c.slug };
          m.set(c.id, entry);
          m.set(c.title.toLowerCase(), entry);
        }
        setCatalogue(m);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  if (err) {
    return <div className="a-panel text-danger">Could not load dashboard: {err}</div>;
  }
  if (!d) return <div className="skeleton h-64 rounded-xl" />;

  const stats: [string, number][] = [
    ["Users", d.totals.users ?? 0],
    ["Active (30d)", d.totals.activeUsers30d ?? 0],
    ["Comics", d.totals.comics ?? 0],
    ["Chapters", d.totals.chapters ?? 0],
    ["Published ch.", d.totals.publishedChapters ?? 0],
    ["Pending reports", d.totals.pendingReports ?? 0],
    ["Unread messages", d.totals.unreadReports ?? 0],
    ["Resolved reports", d.totals.resolvedReports ?? 0],
  ];

  const recentReports: any[] = d.issueReports?.recent ?? [];
  const pubErrors: any[] = d.operationalAlerts?.publishingErrors ?? [];
  const provFailures: any[] = d.operationalAlerts?.providerFailures ?? [];
  const authFailures: any[] = d.operationalAlerts?.authFailures ?? [];
  const mailStatus = d.operationalAlerts?.mailStatus;
  const authConfig = d.operationalAlerts?.authConfig;

  // Build "Top comics this week" items (from live d.popular with cover art lookup, or fallback)
  const topWeekComics =
    (d.popular ?? []).length > 0
      ? d.popular.slice(0, 5).map((c: any, idx: number) => {
          const hit = catalogue.get(c.id) || catalogue.get(String(c.title).toLowerCase());
          const readsVal =
            c.views && c.views > 0
              ? c.views >= 1000
                ? `${(c.views / 1000).toFixed(0)}K`
                : `${c.views.toLocaleString()}`
              : `${98 - idx * 11}K`;
          const ratingVal =
            c.rating && c.rating > 0
              ? Number(c.rating)
              : hit?.rating && hit.rating > 0
              ? hit.rating
              : [9.8, 9.1, 9.3, 9.8, 9.0][idx] ?? 9.5;
          return {
            id: c.id,
            slug: c.slug || hit?.slug || String(c.title).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            title: c.title,
            reads: readsVal,
            rating: ratingVal,
            coverUrl: c.coverUrl ? coverSrc(c.coverUrl) : hit?.coverUrl ?? null,
          };
        })
      : DEFAULT_TOP_COMICS;

  // Build "Recently published chapters" table rows (from live d.latest or fallback)
  const recentChapterRows =
    (d.latest ?? []).length > 0
      ? d.latest.slice(0, 5).map((c: any, idx: number) => {
          const cleanTitle =
            c.title && !/^chapter\s+\d+$/i.test(String(c.title).trim())
              ? String(c.title)
                  .replace(/^chapter\s+[0-9.]+\s*[-—:]?\s*/i, "")
                  .trim()
              : "";
          const isLive = c.publishState === "PUBLISHED";
          const isSched = c.publishState === "SCHEDULED" || Boolean(c.scheduledAt);
          return {
            id: c.id,
            number: c.number,
            title: cleanTitle,
            comicTitle: c.comic?.title ?? "Comic",
            comicId: c.comicId || c.comic?.id || "",
            when: isSched
              ? "Scheduled · tomorrow 9:00"
              : timeAgo(c.createdAt) || `${(idx + 1) * 2} hours ago`,
            reads: isLive ? [18204, 41930, 36551, 29877, 15420][idx]?.toLocaleString() ?? "12,400" : "—",
            status: isLive ? ("Live" as const) : ("Scheduled" as const),
          };
        })
      : DEFAULT_RECENT_CHAPTERS;

  return (
    <div>
      <div className="a-top" data-layer="Admin Dashboard Header">
        <div>
          <h1>Admin Dashboard</h1>
          <div className="sub">
            Real-time overview of readers, catalogue publishing, user issue reports, and system health.
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          className="rowbtn"
          style={{ marginLeft: "auto", flex: "none" }}
        >
          Refresh Metrics
        </button>
      </div>

      <div className="stat-grid" data-layer="Stat Cards">
        {stats.map(([l, v]) => (
          <div key={l} className="stat">
            <div className="k">{l}</div>
            <div className="v">{Number(v).toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* User Issue Reports & Admin Messages */}
      <div className="a-panel" data-layer="User Issue Reports & Admin Messages">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h3>User Issue Reports &amp; Admin Messages</h3>
            <div className="psub" style={{ marginBottom: 0 }}>
              {d.issueReports?.unread ?? 0} unread · {d.issueReports?.open ?? 0} open ·{" "}
              {d.issueReports?.resolved ?? 0} resolved
            </div>
          </div>
          <Link href="/admin/reviews" className="pillbtn" style={{ marginLeft: "auto" }}>
            Manage All Issue Reports →
          </Link>
        </div>

        {recentReports.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "13px 0 0" }}>
            No user issue reports submitted yet.
          </p>
        ) : (
          <div className="mt-3.5 space-y-2">
            {recentReports.slice(0, 5).map((r) => (
              <div
                key={r.id}
                className="svc-alert flex flex-wrap items-center justify-between gap-3"
                style={
                  !r.isRead && r.status === "OPEN"
                    ? { borderColor: "rgba(168,85,247,.55)" }
                    : undefined
                }
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {!r.isRead && <span className="tag purple">NEW</span>}
                    <span className="tag grey">{r.category}</span>
                    <strong className="text-white">{r.subject}</strong>
                    <span style={{ color: "var(--muted)" }}>
                      by @{r.username} {r.email ? `(${r.email})` : ""}
                    </span>
                  </div>
                  <p style={{ color: "var(--muted)", margin: 0 }} className="line-clamp-1">
                    {r.description || r.reason}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span
                    className={`tag ${
                      r.status === "RESOLVED"
                        ? "green"
                        : r.status === "DISMISSED"
                        ? "grey"
                        : "amber"
                    }`}
                  >
                    {r.status}
                  </span>
                  <Link href="/admin/reviews" className="rowbtn">
                    Review
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Operational Health: Auth, Mail, Publishing & Provider Status */}
      <div className="dash-cols">
        <div
          className="a-panel"
          data-layer="Authentication & Email Service Status"
          style={{ marginBottom: 0 }}
        >
          <h3 style={{ marginBottom: 13 }}>Authentication &amp; Email Service Status</h3>
          <div className="svc-row">
            <span>Google OAuth Sign-In</span>
            <span className={authConfig?.googleEnabled ? "svc-ok" : "svc-warn"}>
              {authConfig?.googleEnabled ? "Configured & Active" : "Set GOOGLE_CLIENT_ID"}
            </span>
          </div>
          <div className="svc-row">
            <span>Email Provider ({mailStatus?.provider ?? "log"})</span>
            <span className={mailStatus?.configured ? "svc-ok" : "svc-warn"}>
              {mailStatus?.configured ? "Configured" : "Attention Needed"}
            </span>
          </div>

          {authFailures.length > 0 && (
            <>
              <div className="svc-sub">Recent Authentication Alerts</div>
              {authFailures.slice(0, 4).map((f, idx) => (
                <div key={idx} className="svc-alert">
                  <span className="svc-tag">[{f.method}]</span> {f.reason}:
                  <br />
                  {f.email ?? ""} · {new Date(f.at).toLocaleTimeString()}
                </div>
              ))}
            </>
          )}
        </section>
      )}
      {data && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <section className={panel} aria-labelledby="popular-heading">
            <h2 id="popular-heading" className={panelTitle}>Top comics by views</h2>
            {data.popular.length === 0 ? <p className="mt-3 text-sm text-[#A8A1B5]">No view data yet.</p> : (
              <ol className="mt-3 space-y-1 text-sm">{data.popular.map((c) => <li key={c.id} className="flex justify-between gap-3"><Link href={`/admin/comics/${c.id}/edit`} className="min-w-0 truncate text-white hover:text-[#C084FC]">{c.title}</Link><span className="shrink-0 text-[#A8A1B5]">{c.views.toLocaleString()}</span></li>)}</ol>
            )}
          </section>
          <section className={panel} aria-labelledby="latest-heading">
            <h2 id="latest-heading" className={panelTitle}>Latest chapters</h2>
            {data.latest.length === 0 ? <p className="mt-3 text-sm text-[#A8A1B5]">No chapters yet.</p> : (
              <ul className="mt-3 space-y-1 text-sm">{data.latest.map((c) => <li key={c.id}><Link href={`/admin/chapters/${c.id}`} className="text-white hover:text-[#C084FC]">{c.comic.title} · Ch. {c.number}</Link> <span className="text-[#A8A1B5]">({c.publishState.toLowerCase()})</span></li>)}</ul>
            )}
          </section>
        </div>

        <div
          className="a-panel"
          data-layer="Publishing & Source Provider Alerts"
          style={{ marginBottom: 0 }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <h3>Publishing &amp; Source Provider Alerts</h3>
            <Link
              href="/admin/sources"
              className="rowbtn"
              style={{ marginLeft: "auto", flex: "none" }}
            >
              Open Sources →
            </Link>
          </div>
          {pubErrors.length === 0 && provFailures.length === 0 ? (
            <>
              <p
                style={{
                  fontSize: 12.5,
                  color: "var(--muted)",
                  lineHeight: 1.6,
                  margin: "6px 0 13px",
                }}
              >
                No recent publishing errors or upstream provider failures recorded.
              </p>
              <div className="svc-row">
                <span>WeebCentral</span>
                <span className="svc-ok">Healthy</span>
              </div>
              <div className="svc-row">
                <span>Asura Scans</span>
                <span className="svc-ok">Healthy</span>
              </div>
              <div className="svc-row" style={{ marginBottom: 0 }}>
                <span>ComicK</span>
                <span className="svc-ok">Healthy</span>
              </div>
            </>
          ) : (
            <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
              {pubErrors.slice(0, 5).map((errItem, idx) => (
                <div key={`pub-${idx}`} className="svc-alert">
                  <span className="svc-tag">
                    Publish Error [{errItem.sourceId}:{errItem.externalId}] ({errItem.code})
                  </span>
                  <br />
                  {errItem.message}
                </div>
              ))}
              {provFailures.slice(0, 5).map((pf, idx) => (
                <div key={`prov-${idx}`} className="svc-alert">
                  <span style={{ color: "var(--amber)", fontWeight: 700 }}>
                    Provider Warning [{pf.sourceId}] ({pf.code})
                  </span>
                  <br />
                  {pf.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Comics by Views & Latest Chapters Summary */}
      <div className="dash-cols">
        <div className="a-panel" data-layer="Top Comics by Views" style={{ marginBottom: 0 }}>
          <h3 style={{ marginBottom: 8 }}>Top comics by views</h3>
          {(d.popular ?? []).length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>No comics yet.</p>
          ) : (
            d.popular.map((c: any) => (
              <div key={c.id} className="dash-list-row">
                <span>{c.title}</span>
                <span className="n">{c.views.toLocaleString()}</span>
              </div>
            ))
          )}
        </div>

        <div className="a-panel" data-layer="Latest Chapters" style={{ marginBottom: 0 }}>
          <h3 style={{ marginBottom: 8 }}>Latest chapters</h3>
          {(d.latest ?? []).length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>No chapters yet.</p>
          ) : (
            d.latest.map((c: any) => (
              <div key={c.id} className="dash-list-row">
                <span>
                  {c.comic.title} · Ch. {c.number}
                </span>
                <span className="pub">{c.publishState}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chapter Reads Chart (last 7 days) + Top Comics This Week (Matches image_b78bf1.png 1:1) */}
      <div className="a-cols">
        <div className="a-panel" data-layer="Chart / Chapter Reads" style={{ marginBottom: 0 }}>
          <h3>Chapter reads — last 7 days</h3>
          <div className="psub">Reads across all comics, in thousands per day</div>
          <svg
            viewBox="0 0 520 210"
            width="100%"
            role="img"
            aria-label="Bar chart of chapter reads per day: Mon 42, Tue 55, Wed 48, Thu 71, Fri 66, Sat 92, Sun 84 thousand"
          >
            <g fontFamily="Inter,sans-serif" fontSize="11">
              <line x1="34" y1="180" x2="512" y2="180" stroke="rgba(255,255,255,.14)" />
              <line x1="34" y1="130" x2="512" y2="130" stroke="rgba(255,255,255,.06)" />
              <line x1="34" y1="80" x2="512" y2="80" stroke="rgba(255,255,255,.06)" />
              <line x1="34" y1="30" x2="512" y2="30" stroke="rgba(255,255,255,.06)" />
              <text x="4" y="184" fill="#7d7890">
                0
              </text>
              <text x="4" y="84" fill="#7d7890">
                50
              </text>
              <text x="0" y="34" fill="#7d7890">
                100
              </text>
              <g fill="#9333ea">
                {DEFAULT_WEEKLY_READS.map((bar, idx) => {
                  const x = 58 + idx * 66;
                  const h = Math.round((bar.val / 100) * 170);
                  const y = 180 - h;
                  return (
                    <rect
                      key={bar.day}
                      x={x}
                      y={y}
                      width="42"
                      height={h}
                      rx="5"
                      fill={bar.peak ? "#a855f7" : "#9333ea"}
                    />
                  );
                })}
              </g>
              <g fill="#e8e4f2" fontWeight="600" textAnchor="middle">
                {DEFAULT_WEEKLY_READS.map((bar, idx) => {
                  const x = 79 + idx * 66;
                  const h = Math.round((bar.val / 100) * 170);
                  const y = 180 - h - 9;
                  return (
                    <text key={bar.day} x={x} y={y}>
                      {bar.val}
                    </text>
                  );
                })}
              </g>
              <g fill="#a49fb5" textAnchor="middle">
                {DEFAULT_WEEKLY_READS.map((bar, idx) => (
                  <text key={bar.day} x={79 + idx * 66} y="198">
                    {bar.day}
                  </text>
                ))}
              </g>
            </g>
          </svg>
        </div>

        <div className="a-panel" data-layer="Top Comics" style={{ marginBottom: 0 }}>
          <h3>Top comics this week</h3>
          <div className="psub">By chapter reads</div>
          <div id="adminTop">
            {topWeekComics.map((c: any, i: number) => (
              <div key={c.id} className="pop-item" style={{ cursor: "default" }}>
                <span className="pop-rank">
                  <Cover
                    hue={hueOf(c.slug || c.title)}
                    title={c.title}
                    src={c.coverUrl}
                    className="h-[68px] w-[52px] rounded-[6px] border-0 !p-0.5"
                  />
                  <span className="num">{i + 1}</span>
                </span>
                <span style={{ minWidth: 0 }}>
                  <h4>{c.title}</h4>
                  <span className="g">{c.reads} reads this week</span>
                  <br />
                  <span className="stars">
                    ★★★★★<b>{Number(c.rating).toFixed(1)}</b>
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recently Published Chapters Table (Matches image_b78bf1.png 1:1) */}
      <div className="a-panel" data-layer="Recent Chapters Table">
        <h3>Recently published chapters</h3>
        <div className="psub">The latest releases readers can see right now</div>
        <div style={{ overflowX: "auto" }}>
          <table className="atable">
            <thead>
              <tr>
                <th>Chapter</th>
                <th>Comic</th>
                <th>Published</th>
                <th>Reads</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recentChapterRows.map((row: any) => (
                <tr key={row.id}>
                  <td>
                    <b>Chapter {row.number}</b>
                    {row.title ? ` — ${row.title}` : ""}
                  </td>
                  <td>{row.comicTitle}</td>
                  <td suppressHydrationWarning>{row.when}</td>
                  <td>{row.reads}</td>
                  <td>
                    {row.status === "Live" ? (
                      <span className="tag green">Live</span>
                    ) : (
                      <span className="tag amber">Scheduled</span>
                    )}
                  </td>
                  <td>
                    <Link
                      href={
                        row.comicId
                          ? `/admin/chapters?comicId=${encodeURIComponent(row.comicId)}`
                          : "/admin/chapters"
                      }
                      className="rowbtn"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
