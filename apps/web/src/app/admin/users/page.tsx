"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { UserAvatar } from "@/components/ProfileMenu";
import { Badge, Pager, State, btnDanger, btnGhost, table } from "@/components/admin/ui";
import { act, errMsg, useLoad } from "@/lib/useApi";

/**
 * Asura Admin Users Page (#frame-admin-users):
 * - Reactive pagination via useSearchParams() + local page state so clicking Next/Prev always loads the next page.
 * - Clean mobile card arrangement: Avatar + Username/Email on row 1, and Role + Status + Joined + Suspend button aligned on row 2.
 */
export default function AdminUsers() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: currentUser } = useAuth();
  const myProfile = useLoad<{ avatarUrl: string | null }>(currentUser ? "/user/profile" : null);
  const [err, setErr] = useState("");

  const urlQ = searchParams.get("q") ?? "";
  const urlPage = Math.max(1, Number(searchParams.get("page")) || 1);
  const [page, setPage] = useState(urlPage);
  const [qInput, setQInput] = useState(urlQ);

  useEffect(() => {
    setPage(urlPage);
  }, [urlPage]);

  useEffect(() => {
    setQInput(urlQ);
  }, [urlQ]);

  const sp = new URLSearchParams();
  if (urlQ) sp.set("q", urlQ);
  sp.set("page", String(page));

  const { data, error, loading, reload } = useLoad<{
    items: any[];
    page: number;
    pages: number;
  }>(`/admin/users?${sp.toString()}`);

  const toggle = async (u: any) => {
    setErr("");
    try {
      await act(`/admin/users/${u.id}/status`, "PUT", {
        status: u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
      });
      reload();
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  const buildHref = (targetPage: number, nextQ = urlQ) => {
    const p = new URLSearchParams();
    if (nextQ) p.set("q", nextQ);
    p.set("page", String(targetPage));
    return `/admin/users?${p.toString()}`;
  };

  return (
    <div>
      <div className="a-top" data-layer="Admin Topbar">
        <div>
          <h1>Users</h1>
          <div className="sub">Manage accounts, roles and account status.</div>
        </div>
        <form
          className="a-search-form"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = qInput.trim();
            setPage(1);
            router.push(buildHref(1, trimmed));
          }}
        >
          <label className="s-search" style={{ background: "var(--panel)" }}>
            <span aria-hidden="true">⌕</span>
            <input
              name="q"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search username or email"
              aria-label="Search users"
            />
          </label>
          <button type="submit" className={btnGhost}>
            Search
          </button>
        </form>
      </div>

      <div className="a-panel" data-layer="Users Table">
        <h3>Users</h3>
        <div className="psub">Creators can publish comics; Admins can open this panel.</div>
        {err && (
          <p role="alert" className="mb-2 text-danger">
            {err}
          </p>
        )}
        <State loading={loading} error={error} />
        {data && (
          <div className="overflow-x-auto">
            <table className={`${table} atable-users`}>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => {
                  const roleStr = String(u.role ?? "USER").toUpperCase();
                  const isAdminRole = roleStr === "ADMIN";
                  const isSelf =
                    currentUser &&
                    (u.id === currentUser.id || u.username === currentUser.username);
                  const avatarUrl =
                    u.avatarUrl ??
                    u.profile?.avatarUrl ??
                    (isSelf ? myProfile.data?.avatarUrl : null);

                  return (
                    <tr key={u.id}>
                      <td className="u-cell-main">
                        <span className="tcell">
                          <span
                            className="a-avatar overflow-hidden"
                            style={{ width: 40, height: 40, fontSize: 13 }}
                          >
                            <UserAvatar url={avatarUrl} name={u.username || "U"} />
                          </span>
                          <span className="u-name-stack">
                            <strong className="u-name">{u.username}</strong>
                            <span className="u-email-mobile">
                              {u.email}
                              {!u.emailVerifiedAt && " (unverified)"}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="u-cell-email">
                        {u.email}
                        {!u.emailVerifiedAt && (
                          <span className="ml-1 text-xs text-muted">(unverified)</span>
                        )}
                      </td>
                      <td className="u-cell-meta">
                        {isAdminRole ? (
                          <span className="tag gold">★ {roleStr}</span>
                        ) : (
                          <span className="tag purple">{roleStr}</span>
                        )}
                      </td>
                      <td className="u-cell-meta">
                        <Badge v={u.status} />
                      </td>
                      <td className="u-cell-date">
                        {new Date(u.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="u-cell-act text-right">
                        <button
                          type="button"
                          className={u.status === "ACTIVE" ? btnDanger : btnGhost}
                          onClick={() =>
                            (u.status !== "ACTIVE" ||
                              confirm(`Suspend ${u.username}? They will be signed out.`)) &&
                            toggle(u)
                          }
                        >
                          {u.status === "ACTIVE" ? "Suspend" : "Restore"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <Pager
            page={page}
            pages={data.pages}
            onPageChange={(p) => setPage(p)}
            href={(p) => buildHref(p)}
          />
        )}
      </div>
    </div>
  );
}
