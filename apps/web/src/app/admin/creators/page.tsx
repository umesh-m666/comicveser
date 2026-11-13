"use client";
import { useState } from "react";
import { Badge, State, btn, btnDanger, btnGhost, table } from "@/components/admin/ui";
import { act, errMsg, useLoad } from "@/lib/useApi";

/**
 * Asura Admin Creators Page (#frame-admin-creators):
 * .a-top header, .a-panel with .atable creator rows and avatar badges.
 */
export default function AdminCreators() {
  const { data, error, loading, reload } = useLoad<any[]>("/admin/creators");
  const [err, setErr] = useState("");
  const set = async (id: string, status: string) => {
    setErr("");
    try {
      await act(`/admin/creators/${id}`, "PUT", { status });
      reload();
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  return (
    <div>
      <div className="a-top" data-layer="Admin Topbar">
        <div>
          <h1>Creators</h1>
          <div className="sub">Scanlation groups and authors publishing on ComicVerse.</div>
        </div>
      </div>

      <div className="a-panel" data-layer="Creators Table">
        <h3>Creator accounts</h3>
        <div className="psub">
          Creators publish through the same chapter tools as admins, limited to their own comics.
        </div>
        {err && (
          <p role="alert" className="mb-2 text-danger">
            {err}
          </p>
        )}
        <State loading={loading} error={error} />
        {data &&
          (data.length === 0 ? (
            <p className="text-muted">No creator applications yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className={table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>User</th>
                    <th>Status</th>
                    <th>Comics</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="tcell">
                          <span
                            className="a-avatar"
                            style={{ width: 32, height: 32, fontSize: 11 }}
                          >
                            {(c.displayName || "C").slice(0, 2).toUpperCase()}
                          </span>
                          {c.displayName}
                        </span>
                      </td>
                      <td>
                        {c.user.username} <span className="text-muted">({c.user.email})</span>
                      </td>
                      <td>
                        <Badge v={c.status} />
                      </td>
                      <td>{c._count.comics}</td>
                      <td className="flex flex-wrap justify-end gap-2">
                        {c.status !== "APPROVED" && (
                          <button className={btn} onClick={() => set(c.id, "APPROVED")}>
                            Approve
                          </button>
                        )}
                        {c.status === "PENDING" && (
                          <button className={btnGhost} onClick={() => set(c.id, "REJECTED")}>
                            Reject
                          </button>
                        )}
                        {c.status === "APPROVED" && (
                          <button
                            className={btnDanger}
                            onClick={() =>
                              confirm(`Suspend ${c.displayName}?`) && set(c.id, "SUSPENDED")
                            }
                          >
                            Suspend
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        <p className="mt-4 text-xs text-muted">
          Approve submitted comics from Comics (look for the PENDING state) and chapters from Chapters.
        </p>
      </div>
    </div>
  );
}
