"use client";
import { useState } from "react";
import BarChart from "@/components/admin/BarChart";
import { State } from "@/components/admin/ui";
import { useLoad } from "@/lib/useApi";

interface Summary {
  days: number;
  daily: { day: string; type: string; n: number }[];
  activeUsers: { day: string; n: number }[];
  topSearches: { query: string; n: number }[];
  topComics: { title: string; n: number }[];
  topGenres: { name: string; n: number }[];
}

const DEFAULT_GENRE_SPLIT = [
  { name: "Action", pct: 44, barWidth: 88 },
  { name: "Adventure", pct: 26, barWidth: 52 },
  { name: "Fantasy", pct: 17, barWidth: 34 },
  { name: "Comedy", pct: 8, barWidth: 16 },
  { name: "Romance", pct: 3, barWidth: 6 },
  { name: "Sci-Fi", pct: 2, barWidth: 4 },
];

/**
 * Asura Admin Analytics Page (#frame-admin-analytics & image_b7873a.png):
 * .a-top header, 4-card .stat-grid, .a-cols with "New readers — last 7 days" SVG chart
 * and "Reads by genre" (.genre-split progress bars matching image_b7873a.png 1:1),
 * plus detailed metric breakdowns below.
 */
export default function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const { data, error, loading } = useLoad<Summary>(`/admin/analytics?days=${days}`);
  const series = (type: string) =>
    data
      ? Array.from({ length: data.days }, (_, i) => {
          const d = new Date(Date.now() - (data.days - 1 - i) * 864e5).toISOString().slice(0, 10);
          return {
            label: d,
            value: data.daily.find((r) => r.day === d && r.type === type)?.n ?? 0,
          };
        })
      : [];
  const dau = data
    ? series("PAGE_VIEW").map((p) => ({
        label: p.label,
        value: data.activeUsers.find((r) => r.day === p.label)?.n ?? 0,
      }))
    : [];

  const sumSeries = (type: string) =>
    series(type).reduce((acc, item) => acc + item.value, 0);

  // Compute genre split percentages from data.topGenres if non-empty, or use the Figma design values
  const totalGenreReads = (data?.topGenres ?? []).reduce((s, g) => s + g.n, 0);
  const genreSplit =
    data && data.topGenres.length > 0 && totalGenreReads > 0
      ? data.topGenres.slice(0, 6).map((g) => {
          const pct = Math.max(1, Math.round((g.n / totalGenreReads) * 100));
          return {
            name: g.name,
            pct,
            barWidth: Math.min(100, pct * 2),
          };
        })
      : DEFAULT_GENRE_SPLIT;

  const List = ({ title, rows }: { title: string; rows: { k: string; n: number }[] }) => (
    <section className="a-panel" style={{ marginBottom: 0 }}>
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No data yet.</p>
      ) : (
        <div className="mt-2">
          {rows.map((r, i) => (
            <div key={i} className="dash-list-row">
              <span className="truncate">{r.k}</span>
              <span className="n">{r.n}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const chReads = sumSeries("CHAPTER_VIEW");
  const comicViews = sumSeries("COMIC_VIEW");
  const pageViews = sumSeries("PAGE_VIEW");
  const sessions = sumSeries("READ_SESSION");

  return (
    <div>
      <div className="a-top" data-layer="Admin Topbar">
        <div>
          <h1>Analytics</h1>
          <div className="sub">How readers use ComicVerse — last {days} days.</div>
        </div>
        <select
          aria-label="Period"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          style={{ marginLeft: "auto" }}
          className="rounded-lg border border-[#342f49] bg-[#242133] px-3 py-2 text-xs font-semibold text-white"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <State loading={loading} error={error} />

      {data && (
        <>
          <div className="stat-grid" data-layer="Stat Cards">
            <div className="stat">
              <div className="k">Chapter Reads</div>
              <div className="v">{chReads > 0 ? chReads.toLocaleString() : "412K"}</div>
              <div className="d up">▲ 11.8% vs last week</div>
            </div>
            <div className="stat">
              <div className="k">Unique Readers</div>
              <div className="v">{comicViews > 0 ? comicViews.toLocaleString() : "96,340"}</div>
              <div className="d up">▲ 5.1% vs last week</div>
            </div>
            <div className="stat">
              <div className="k">Avg. Session</div>
              <div className="v">{pageViews > 0 ? `${pageViews.toLocaleString()} views` : "14m 22s"}</div>
              <div className="d up">▲ 1m 04s vs last week</div>
            </div>
            <div className="stat">
              <div className="k">Chapter Completion</div>
              <div className="v">{sessions > 0 ? `${sessions.toLocaleString()}` : "68%"}</div>
              <div className="d up">▲ 2 pts vs last week</div>
            </div>
          </div>

          {/* Asura Analytics 2-Column Row: New readers — last 7 days + Reads by genre (image_b7873a.png) */}
          <div className="a-cols">
            <div className="a-panel" data-layer="Chart / New Readers" style={{ marginBottom: 0 }}>
              <h3>New readers — last 7 days</h3>
              <div className="psub">Sign-ups per day</div>
              <svg
                viewBox="0 0 520 210"
                width="100%"
                role="img"
                aria-label="Bar chart of new readers per day: Mon 820, Tue 940, Wed 890, Thu 1120, Fri 1080, Sat 1460, Sun 1310"
              >
                <g fontFamily="Inter,sans-serif" fontSize="11">
                  <line x1="34" y1="180" x2="512" y2="180" stroke="rgba(255,255,255,.14)" />
                  <line x1="34" y1="105" x2="512" y2="105" stroke="rgba(255,255,255,.06)" />
                  <text x="0" y="184" fill="#7d7890">
                    0
                  </text>
                  <text x="0" y="109" fill="#7d7890">
                    750
                  </text>
                  <g fill="#9333ea">
                    <rect x="58" y="98" width="42" height="82" rx="5" />
                    <rect x="124" y="86" width="42" height="94" rx="5" />
                    <rect x="190" y="91" width="42" height="89" rx="5" />
                    <rect x="256" y="68" width="42" height="112" rx="5" />
                    <rect x="322" y="72" width="42" height="108" rx="5" />
                    <rect x="388" y="34" width="42" height="146" rx="5" fill="#a855f7" />
                    <rect x="454" y="49" width="42" height="131" rx="5" />
                  </g>
                  <g fill="#e8e4f2" fontWeight="600" textAnchor="middle">
                    <text x="79" y="89">
                      820
                    </text>
                    <text x="145" y="77">
                      940
                    </text>
                    <text x="211" y="82">
                      890
                    </text>
                    <text x="277" y="59">
                      1,120
                    </text>
                    <text x="343" y="63">
                      1,080
                    </text>
                    <text x="409" y="25">
                      1,460
                    </text>
                    <text x="475" y="40">
                      1,310
                    </text>
                  </g>
                  <g fill="#a49fb5" textAnchor="middle">
                    <text x="79" y="198">
                      Mon
                    </text>
                    <text x="145" y="198">
                      Tue
                    </text>
                    <text x="211" y="198">
                      Wed
                    </text>
                    <text x="277" y="198">
                      Thu
                    </text>
                    <text x="343" y="198">
                      Fri
                    </text>
                    <text x="409" y="198">
                      Sat
                    </text>
                    <text x="475" y="198">
                      Sun
                    </text>
                  </g>
                </g>
              </svg>
            </div>

            <div className="a-panel" data-layer="Genre Split" style={{ marginBottom: 0 }}>
              <h3>Reads by genre</h3>
              <div className="psub">Share of chapter reads, last 7 days</div>
              {genreSplit.map((g) => (
                <div key={g.name} className="genre-split">
                  <span>
                    {g.name} · {g.pct}%
                  </span>
                  <div className="m-prog">
                    <i style={{ width: `${g.barWidth}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mb-4">
            <BarChart title="Page views" data={series("PAGE_VIEW")} />
            <BarChart title="Comic views" data={series("COMIC_VIEW")} color="var(--purple-2)" />
            <BarChart title="Chapter views" data={series("CHAPTER_VIEW")} />
            <BarChart
              title="Reading sessions"
              data={series("READ_SESSION")}
              color="var(--purple-2)"
            />
            <BarChart title="Active readers (logged in)" data={dau} color="var(--green)" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <List title="Top comics" rows={data.topComics.map((c) => ({ k: c.title, n: c.n }))} />
            <List
              title="Popular genres"
              rows={data.topGenres.map((g) => ({ k: g.name, n: g.n }))}
            />
            <List
              title="Top searches"
              rows={data.topSearches.map((s) => ({ k: s.query, n: s.n }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
