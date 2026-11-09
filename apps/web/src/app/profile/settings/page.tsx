"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ProfileNav from "@/components/ProfileNav";
import { State, btn, btnDanger, input } from "@/components/admin/ui";
import { ApiError } from "@/lib/api";
import { act, errMsg, useLoad } from "@/lib/useApi";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-line bg-card p-4"><h2 className="mb-3 font-semibold">{title}</h2>{children}</section>;
}
const Msg = ({ ok, err }: { ok: string; err: string }) => <>{ok && <p role="status" className="mt-2 text-sm text-success">{ok}</p>}{err && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}</>;

export default function Settings() {
  const router = useRouter();
  const profile = useLoad<{ username: string; email: string; bio: string | null; createdAt: string }>("/user/profile");
  const notes = useLoad<{ prefs: { newChapter: boolean } }>("/user/notifications");
  const [m, setM] = useState<Record<string, { ok: string; err: string }>>({});
  const set = (k: string, ok: string, err = "") => setM((x) => ({ ...x, [k]: { ok, err } }));
  if (profile.error instanceof ApiError && profile.error.status === 401) return <p>Please <Link href="/login" className="text-primary">log in</Link> to change your settings.</p>;

  return (
    <div className="max-w-xl space-y-5"><ProfileNav active="/profile/settings" /><State loading={profile.loading} error={profile.error} />
      {profile.data && (<>
        <Section title="Profile">
          <p className="mb-3 text-sm text-muted">{profile.data.email} · member since {new Date(profile.data.createdAt).toLocaleDateString("en-IN")}</p>
          <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget);
            try { await act("/user/profile", "PUT", { username: f.get("username"), bio: f.get("bio") }); set("p", "Saved."); profile.reload(); window.dispatchEvent(new Event("cv:notifications")); } catch (x) { set("p", "", errMsg(x)); } }}>
            <label className="block text-sm"><span className="mb-1 block text-muted">Username</span><input name="username" required defaultValue={profile.data.username} pattern="[a-zA-Z0-9_]{3,30}" title="3-30 letters, numbers or underscores" className={input} /></label>
            <label className="block text-sm"><span className="mb-1 block text-muted">About you</span><textarea name="bio" rows={3} maxLength={500} defaultValue={profile.data.bio ?? ""} className={input} /></label>
            <button className={btn}>Save profile</button><Msg ok={m.p?.ok ?? ""} err={m.p?.err ?? ""} /></form>
        </Section>

        <Section title="Change password">
          <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
            if (f.get("next") !== f.get("again")) return set("w", "", "The new passwords don't match.");
            try { await act("/user/password", "PUT", { current: f.get("current"), next: f.get("next") }); form.reset(); set("w", "Password changed. Your other devices were signed out."); } catch (x) { set("w", "", errMsg(x)); } }}>
            <input name="current" type="password" required autoComplete="current-password" placeholder="Current password" aria-label="Current password" className={input} />
            <input name="next" type="password" required minLength={10} autoComplete="new-password" placeholder="New password (10+ characters)" aria-label="New password" className={input} />
            <input name="again" type="password" required minLength={10} autoComplete="new-password" placeholder="Repeat new password" aria-label="Repeat new password" className={input} />
            <button className={btn}>Change password</button><Msg ok={m.w?.ok ?? ""} err={m.w?.err ?? ""} /></form>
        </Section>

        <Section title="Notifications">
          {notes.data && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notes.data.prefs.newChapter}
            onChange={async (e) => { try { await act("/user/notification-settings", "PUT", { newChapter: e.target.checked }); notes.reload(); set("n", "Saved."); } catch (x) { set("n", "", errMsg(x)); } }} />
            Tell me when a bookmarked comic has a new chapter</label>}<Msg ok={m.n?.ok ?? ""} err={m.n?.err ?? ""} />
        </Section>

        <Section title="Delete account">
          <p className="mb-3 text-sm text-muted">This removes your email, bookmarks, history, notifications and reviews and signs you out everywhere. It can't be undone.</p>
          <button className={btnDanger} onClick={async () => {
            const password = prompt("To delete your account, enter your password:"); if (!password) return;
            if (!confirm("Delete your account permanently?")) return;
            try { await act("/user/account", "DELETE", { password }); router.push("/"); router.refresh(); window.dispatchEvent(new Event("cv:notifications")); } catch (x) { set("d", "", errMsg(x)); } }}>Delete my account</button>
          <Msg ok={m.d?.ok ?? ""} err={m.d?.err ?? ""} />
        </Section>
      </>)}
    </div>
  );
}
