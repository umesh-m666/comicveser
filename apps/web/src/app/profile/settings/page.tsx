"use client";
import Link from "next/link";
import { useState } from "react";
import { State } from "@/components/admin/ui";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { UserAvatar } from "@/components/ProfileMenu";
import { ComicVerseLogo } from "@/components/ComicVerseLogo";
import { act, errMsg, useLoad } from "@/lib/useApi";

const Msg = ({ ok, err }: { ok: string; err: string }) => (
  <>
    {ok && (
      <p role="status" className="mt-2 text-sm text-success">
        {ok}
      </p>
    )}
    {err && (
      <p role="alert" className="mt-2 text-sm text-danger">
        {err}
      </p>
    )}
  </>
);

/**
 * Asura Account Settings (#frame-user-settings & #frame-mobile-user-settings):
 * Profile Picture & Banner, Username & Email with verified note, Change Password, Preferences toggles, and Account Deletion.
 */
export default function Settings() {
  const { user, logout } = useAuth();
  const profile = useLoad<{
    username: string;
    email: string;
    bio: string | null;
    avatarUrl?: string | null;
    createdAt: string;
  }>("/user/profile");
  const notes = useLoad<{ prefs: { newChapter: boolean } }>("/user/notifications");
  const [m, setM] = useState<Record<string, { ok: string; err: string }>>({});
  const set = (k: string, ok: string, err = "") => setM((x) => ({ ...x, [k]: { ok, err } }));

  if (profile.error instanceof ApiError && profile.error.status === 401) {
    return (
      <p>
        Please{" "}
        <Link href="/login" className="text-primary">
          log in
        </Link>{" "}
        to change your settings.
      </p>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }} className="space-y-5">
      <State loading={profile.loading} error={profile.error} />

      {profile.data && (
        <>
          <section className="panel" data-layer="Account Settings">
            <h1 style={{ fontSize: 19, margin: "0 0 4px", fontWeight: 700, color: "#fff" }}>
              Account Settings
            </h1>
            <p
              style={{
                color: "var(--muted)",
                fontSize: 12.5,
                margin: "0 0 10px",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Manage your profile, change your password, and control your account settings.
            </p>

            <span className="set-label">Profile Picture</span>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <span
                className="overflow-hidden rounded-full border-2 border-[#a855f7] bg-[#2b1d42] grid place-items-center text-xl font-extrabold text-white"
                style={{ width: 74, height: 74 }}
              >
                <UserAvatar url={profile.data.avatarUrl} name={profile.data.username} />
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {profile.data.email} · member since{" "}
                {new Date(profile.data.createdAt).toLocaleDateString("en-IN")}
              </span>
            </div>

            <span className="set-label">Profile Banner</span>
            <div
              style={{
                height: 96,
                borderRadius: 10,
                background: "linear-gradient(120deg,#2a1150,#4c1d95)",
                display: "grid",
                placeItems: "center",
                color: "var(--muted)",
                fontSize: 12.5,
              }}
            >
              <span className="inline-flex items-center gap-3"><ComicVerseLogo className="h-12 w-auto" /><span>ComicVerse Official Banner</span></span>
            </div>

            <form
              className="acct-profile-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  await act("/user/profile", "PUT", {
                    username: f.get("username"),
                    bio: f.get("bio"),
                  });
                  set("p", "Saved.");
                  profile.reload();
                  window.dispatchEvent(new Event("cv:notifications"));
                } catch (x) {
                  set("p", "", errMsg(x));
                }
              }}
            >
              <label className="block">
                <span className="set-label">Username</span>
                <input
                  name="username"
                  required
                  defaultValue={profile.data.username}
                  pattern="[a-zA-Z0-9_]{3,30}"
                  title="3-30 letters, numbers or underscores"
                  className="set-input"
                />
              </label>
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--muted-2)",
                  display: "block",
                  marginTop: 5,
                }}
              >
                3–30 characters. Letters, numbers, and underscores only.
              </span>

              <label className="block">
                <span className="set-label">About you</span>
                <textarea
                  name="bio"
                  rows={3}
                  maxLength={500}
                  defaultValue={profile.data.bio ?? ""}
                  className="w-full rounded-lg border border-[#353247] bg-[#17141f] p-3 text-sm text-white"
                />
              </label>

              <span className="set-label">Email</span>
              <input
                type="email"
                value={profile.data.email}
                readOnly
                aria-label="Email"
                className="set-input opacity-80"
              />

              <div className="verified-note" style={{ marginTop: 12 }}>
                <span style={{ fontSize: 16, color: "#34d399" }} aria-hidden="true">
                  ✓
                </span>
                <span>
                  <b>{user?.emailVerified ? "Email verified" : "Account active"}</b>
                  Your account is active on ComicVerse. Bookmarks, ratings, and reading progress sync across devices.
                </span>
              </div>

              <div style={{ textAlign: "right", marginTop: 14 }}>
                <button className="pillbtn" type="submit">
                  Save profile
                </button>
              </div>
              <Msg ok={m.p?.ok ?? ""} err={m.p?.err ?? ""} />
            </form>
          </section>

          <section className="panel" data-layer="Change Password">
            <h2 style={{ fontSize: 16, margin: "0 0 4px", fontWeight: 700, color: "#fff" }}>
              Change Password
            </h2>
            <form
              className="acct-pass-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                if (f.get("next") !== f.get("again"))
                  return set("w", "", "The new passwords don't match.");
                try {
                  await act("/user/password", "PUT", {
                    current: f.get("current"),
                    next: f.get("next"),
                  });
                  form.reset();
                  set("w", "Password changed. Your other devices were signed out.");
                } catch (x) {
                  set("w", "", errMsg(x));
                }
              }}
            >
              <span className="set-label">Current password</span>
              <input
                name="current"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Current password"
                aria-label="Current password"
                className="set-input"
              />
              <span className="set-label">New password</span>
              <input
                name="next"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                placeholder="New password (10+ characters)"
                aria-label="New password"
                className="set-input"
              />
              <span className="set-label">Confirm new password</span>
              <input
                name="again"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                placeholder="Repeat new password"
                aria-label="Repeat new password"
                className="set-input"
              />
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--muted-2)",
                  display: "block",
                  marginTop: 5,
                }}
              >
                Password must be at least 10 characters.
              </span>
              <div style={{ textAlign: "right", marginTop: 14 }}>
                <button className="pillbtn" type="submit">
                  Change password
                </button>
              </div>
              <Msg ok={m.w?.ok ?? ""} err={m.w?.err ?? ""} />
            </form>
          </section>

          <section className="panel" data-layer="Profile & Preferences">
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <h2 style={{ fontSize: 16, margin: "0 0 3px", fontWeight: 700, color: "#fff" }}>
                  Profile
                </h2>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  View your reading stats, bookmarks, and activity on your public profile page.
                </span>
              </div>
              <Link href="/account" className="pillbtn ghost">
                View profile
              </Link>
            </div>

            <div
              style={{
                borderTop: "1px solid var(--row-line)",
                marginTop: 16,
                paddingTop: 16,
              }}
            >
              <h2 style={{ fontSize: 16, margin: "0 0 3px", fontWeight: 700, color: "#fff" }}>
                Notifications &amp; Preferences
              </h2>
              <span
                style={{
                  fontSize: 12.5,
                  color: "var(--muted)",
                  display: "block",
                  marginBottom: 8,
                }}
              >
                How your reading notifications behave.
              </span>
              {notes.data && (
                <div className="upd" style={{ alignItems: "center" }}>
                  <div className="u-main">
                    <h3 style={{ whiteSpace: "normal", fontSize: 13.5 }}>New-chapter alerts</h3>
                    <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      Tell me when a bookmarked comic has a new chapter
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={notes.data.prefs.newChapter}
                      onChange={async (e) => {
                        try {
                          await act("/user/notification-settings", "PUT", {
                            newChapter: e.target.checked,
                          });
                          notes.reload();
                          set("n", "Saved.");
                        } catch (x) {
                          set("n", "", errMsg(x));
                        }
                      }}
                    />
                    <span>{notes.data.prefs.newChapter ? "On" : "Off"}</span>
                  </label>
                </div>
              )}
              <Msg ok={m.n?.ok ?? ""} err={m.n?.err ?? ""} />
            </div>
          </section>

          <section
            className="panel"
            data-layer="Delete Account"
            style={{ borderColor: "rgba(248,113,113,.35)" }}
          >
            <h2 style={{ fontSize: 16, margin: "0 0 4px", fontWeight: 700, color: "#f87171" }}>
              Delete account
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "0 0 12px" }}>
              This removes your email, bookmarks, history, notifications and reviews and signs you out everywhere. It can&apos;t be undone.
            </p>
            <button
              type="button"
              className="rowbtn danger"
              onClick={async () => {
                const password = prompt("To delete your account, enter your password:");
                if (!password) return;
                if (!confirm("Delete your account permanently?")) return;
                try {
                  await act("/user/account", "DELETE", { password });
                  await logout();
                } catch (x) {
                  set("d", "", errMsg(x));
                }
              }}
            >
              Delete my account
            </button>
            <Msg ok={m.d?.ok ?? ""} err={m.d?.err ?? ""} />
          </section>
        </>
      )}
    </div>
  );
}
