"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { UserAvatar } from "@/components/ProfileMenu";
import { Badge, Pager, State, btnDanger, btnGhost, table } from "@/components/admin/ui";
import { act, errMsg, useLoad } from "@/lib/useApi";

/**
 * Asura Admin Users Page (#frame-admin-users):
 * .a-top header with search, .a-panel with .atable user rows displaying profile images,
 * GOLD badge for ADMIN role, and PURPLE badge for USER role.
 */
export default function AdminUsers({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const myProfile = useLoad<{ avatarUrl: string | null }>(currentUser ? "/user/profile" : null);
  const [err, setErr] = useState("");
  const sp = new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => v) as [string, string][],
  );
  const { data, error, loading, reload } = useLoad<{
    items: any[];
    page: number;
    pages: number;
  }>(`/admin/users?${sp}`);

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

  return (
    <div>
      <div className="a-top" data-layer="Admin Topbar">
        <div>
          <h1>Users</h1>
          <div className="sub">Manage accounts, roles and account status.</div>
        </div>
        <form
          className="flex gap-2"
          style={{ marginLeft: "auto" }}
          onSubmit={(e) => {
            e.preventDefault();
            router.push(
              `/admin/users?q=${encodeURIComponent(
                String(new FormData(e.currentTarget).get("q") ?? ""),
              )}`,
            );
          }}
        >
          <label className="s-search" style={{ background: "var(--panel)" }}>
            <span aria-hidden="true">⌕</span>
            <input
              name="q"
              defaultValue={searchParams.q}
              placeholder="Search username or email"
              aria-label="Search users"
            />
          </label>
          <button className={btnGhost}>Search</button>
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
            <table className={table}>
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
                      <td>
                        <span className="tcell">
                          <span
                            className="a-avatar overflow-hidden"
                            style={{ width: 36, height: 36, fontSize: 12 }}
                          >
                            <UserAvatar url={avatarUrl} name={u.username || "U"} />
                          </span>
                          <span>{u.username}</span>
                        </span>
                      </td>
                      <td>
                        {u.email}
                        {!u.emailVerifiedAt && (
                          <span className="ml-1 text-xs text-muted">(unverified)</span>
                        )}
                      </td>
                      <td>
                        {isAdminRole ? (
                          <span className="tag gold">★ {roleStr}</span>
                        ) : (
                          <span className="tag purple">{roleStr}</span>
                        )}
                      </td>
                      <td>
                        <Badge v={u.status} />
                      </td>
                      <td>{new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
                      <td className="text-right">
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
            page={data.page}
            pages={data.pages}
            href={(p) =>
              `/admin/users?${new URLSearchParams({ ...Object.fromEntries(sp), page: String(p) })}`
            }
          />
        )}
      </div>
    </div>
  );
}
