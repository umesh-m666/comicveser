"use client";
import { Pager, State, table } from "@/components/admin/ui";
import { useLoad } from "@/lib/useApi";

/**
 * Asura Admin Audit Logs Page (#frame-admin-audit):
 * .a-top header, .a-panel with .atable audit log entries.
 */
export default function AuditLogs({ searchParams }: { searchParams: { page?: string } }) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const { data, error, loading } = useLoad<{ items: any[]; page: number; pages: number }>(
    `/admin/audit-logs?page=${page}`,
  );

  return (
    <div>
      <div className="a-top" data-layer="Admin Topbar">
        <div>
          <h1>Audit logs</h1>
          <div className="sub">A permanent record of admin and creator actions.</div>
        </div>
      </div>

      <div className="a-panel" data-layer="Audit Table">
        <h3>Recent activity</h3>
        <div className="psub">Newest first · kept for 12 months</div>
        <State loading={loading} error={error} />
        {data &&
          (data.items.length === 0 ? (
            <p className="text-muted">No activity recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className={table}>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>Action</th>
                    <th>Resource</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((l) => (
                    <tr key={l.id}>
                      <td className="whitespace-nowrap">
                        {new Date(l.createdAt).toLocaleString("en-IN")}
                      </td>
                      <td>
                        <b className="text-white">{l.actor}</b>
                      </td>
                      <td>
                        <span className="tag purple">{l.action}</span>
                      </td>
                      <td className="text-muted">
                        {l.resource}
                        {l.resourceId ? ` · ${l.resourceId.slice(0, 8)}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        {data && <Pager page={data.page} pages={data.pages} href={(p) => `/admin/audit-logs?page=${p}`} />}
      </div>
    </div>
  );
}
