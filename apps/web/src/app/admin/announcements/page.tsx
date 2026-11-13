"use client";
import { useState } from "react";
import { State, btn, btnDanger, input } from "@/components/admin/ui";
import { act, errMsg, useLoad } from "@/lib/useApi";

/**
 * Asura Admin Announcements Page (#frame-admin-announce):
 * .a-top header, Post an announcement .a-panel, and active announcements list.
 */
export default function AdminAnnouncements() {
  const { data, error, loading, reload } = useLoad<
    { id: string; title: string; body: string; publishAt: string | null }[]
  >("/admin/announcements");
  const [err, setErr] = useState("");

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const form = e.currentTarget;
    const f = new FormData(form);
    const at = String(f.get("publishAt") ?? "");
    try {
      await act("/admin/announcements", "POST", {
        title: f.get("title"),
        body: f.get("body"),
        publishAt: at ? new Date(at).toISOString() : undefined,
      });
      form.reset();
      reload();
    } catch (x) {
      setErr(errMsg(x));
    }
  }

  return (
    <div>
      <div className="a-top" data-layer="Admin Topbar">
        <div>
          <h1>Announcements</h1>
          <div className="sub">
            Control the red strip and announcement cards on the reader home page.
          </div>
        </div>
      </div>

      <div className="a-panel" data-layer="New Announcement">
        <h3>Post an announcement</h3>
        <div className="psub">Shows on the home page and in the Announcements section.</div>
        <form onSubmit={create} className="max-w-xl space-y-3">
          <label className="block">
            <span className="set-label" style={{ marginTop: 0 }}>
              Announcement title
            </span>
            <input
              name="title"
              required
              maxLength={200}
              placeholder="e.g. Maintenance complete — reader is faster than ever"
              className={input}
              aria-label="Title"
            />
          </label>
          <label className="block">
            <span className="set-label">Message</span>
            <textarea
              name="body"
              required
              maxLength={2000}
              rows={3}
              placeholder="Message"
              className="w-full rounded-lg border border-[#353247] bg-[#17141f] p-3 text-sm text-white"
              aria-label="Message"
            />
          </label>
          <label className="block text-xs text-muted">
            Show from (optional, leave empty to show now)
            <input name="publishAt" type="datetime-local" className={input + " mt-1"} />
          </label>
          {err && (
            <p role="alert" className="text-sm text-danger">
              {err}
            </p>
          )}
          <button className={btn}>Publish announcement</button>
        </form>
      </div>

      <div className="a-panel" data-layer="Announcements List">
        <h3>Published announcements</h3>
        <div className="psub">Active notices shown on the home page</div>
        <State loading={loading} error={error} />
        {data &&
          (data.length === 0 ? (
            <p className="text-muted">No announcements yet.</p>
          ) : (
            <div className="space-y-2">
              {data.map((a) => (
                <div key={a.id} className="upd" style={{ alignItems: "center" }}>
                  <div className="u-main">
                    <h3 style={{ whiteSpace: "normal" }}>{a.title}</h3>
                    <p style={{ margin: "2px 0", fontSize: 12.5, color: "var(--muted)" }}>
                      {a.body}
                    </p>
                    {a.publishAt && (
                      <span style={{ fontSize: 11.5, color: "var(--muted-2)" }}>
                        Shows from {new Date(a.publishAt).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className={btnDanger}
                    onClick={async () => {
                      if (confirm("Delete this announcement?")) {
                        try {
                          await act(`/admin/announcements/${a.id}`, "DELETE");
                          reload();
                        } catch (x) {
                          setErr(errMsg(x));
                        }
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
