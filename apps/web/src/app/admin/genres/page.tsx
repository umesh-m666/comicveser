"use client";
import { useState } from "react";
import { State, btn, btnDanger, btnGhost, table } from "@/components/admin/ui";
import { act, errMsg, useLoad } from "@/lib/useApi";

/**
 * Asura Admin Genres Page (#frame-admin-genres):
 * .a-top header, 3-card .stat-grid, Add a genre .a-panel form, and .atable genres table.
 */
export default function AdminGenres() {
  const { data, error, loading, reload } = useLoad<
    { id: string; name: string; _count: { comics: number } }[]
  >("/genres");
  const [err, setErr] = useState("");
  const run = async (fn: () => Promise<unknown>) => {
    setErr("");
    try {
      await fn();
      reload();
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  const sorted = data ? [...data].sort((a, b) => b._count.comics - a._count.comics) : [];
  const topGenre = sorted[0];

  return (
    <div>
      <div className="a-top" data-layer="Admin Topbar">
        <div>
          <h1>Genres</h1>
          <div className="sub">The taxonomy behind Browse filters and comic cards.</div>
        </div>
      </div>

      <div
        className="stat-grid"
        data-layer="Stat Cards"
        style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
      >
        <div className="stat">
          <div className="k">Total Genres</div>
          <div className="v">{data?.length ?? 0}</div>
          <div className="d up">Active in Browse filters</div>
        </div>
        <div className="stat">
          <div className="k">Most Used</div>
          <div className="v">{topGenre?.name ?? "—"}</div>
          <div className="d">{topGenre ? `${topGenre._count.comics} comics` : "No comics yet"}</div>
        </div>
        <div className="stat">
          <div className="k">Tagged Assignments</div>
          <div className="v">
            {data ? data.reduce((acc, g) => acc + g._count.comics, 0) : 0}
          </div>
          <div className="d up">Across live catalogue</div>
        </div>
      </div>

      <div className="a-panel" data-layer="Add Genre Form">
        <h3>Add a genre</h3>
        <div className="psub">It becomes a Browse filter chip and a card label immediately.</div>
        <form
          className="a-form"
          style={{ gridTemplateColumns: "1fr auto" }}
          onSubmit={(e) => {
            e.preventDefault();
            const f = e.currentTarget;
            const name = String(new FormData(f).get("name")).trim();
            if (name)
              run(async () => {
                await act("/admin/genres", "POST", { name });
                f.reset();
              });
          }}
        >
          <label>
            Genre name
            <input
              name="name"
              placeholder="e.g. Martial Arts"
              maxLength={60}
              aria-label="New genre name"
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <button className={btn} style={{ minHeight: 38, justifyContent: "center" }}>
              ＋ Add Genre
            </button>
          </label>
        </form>
        {err && (
          <p role="alert" className="mt-2 text-danger">
            {err}
          </p>
        )}
      </div>

      <div className="a-panel" data-layer="Genres Table">
        <h3>All genres</h3>
        <div className="psub">Comics per genre across the live catalogue</div>
        <State loading={loading} error={error} />
        {data && (
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Comics</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <b>{g.name}</b>
                    </td>
                    <td>{g._count.comics}</td>
                    <td className="flex justify-end gap-2">
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={() => {
                          const n = prompt("Rename genre", g.name)?.trim();
                          if (n && n !== g.name)
                            run(() => act(`/admin/genres/${g.id}`, "PUT", { name: n }));
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className={btnDanger}
                        onClick={() =>
                          confirm(
                            `Delete "${g.name}"? It will be removed from ${g._count.comics} comic(s).`,
                          ) && run(() => act(`/admin/genres/${g.id}`, "DELETE"))
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
