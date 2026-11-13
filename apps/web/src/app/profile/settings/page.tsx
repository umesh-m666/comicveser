"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import ProfileNav from "@/components/ProfileNav";
import { ProfileAvatar } from "@/components/ProfileStats";
import { State, btn, btnDanger, btnGhost, input } from "@/components/admin/ui";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { act, errMsg, useLoad } from "@/lib/useApi";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#322A42] bg-[#17141F] p-4 sm:p-5">
      <h2 className="mb-3 text-base font-bold text-white">{title}</h2>
      {children}
    </section>
  );
}
const Msg = ({ ok, err }: { ok: string; err: string }) => (
  <>
    {ok && <p role="status" className="mt-2 text-sm text-success">{ok}</p>}
    {err && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}
  </>
);

/** Reading preferences kept in this browser only — there is no API for them. */
const PREFS_KEY = "cv:reading-prefs";
type ReadingPrefs = { resumePosition: boolean; autoNextChapter: boolean; compactCovers: boolean };
const DEFAULT_PREFS: ReadingPrefs = { resumePosition: true, autoNextChapter: false, compactCovers: false };
function loadPrefs(): ReadingPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<ReadingPrefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export default function Settings() {
  const router = useRouter();
  const profile = useLoad<{ username: string; email: string; bio: string | null; createdAt: string; avatarUrl: string | null }>("/user/profile");
  const me = useLoad<{ emailVerified: boolean }>("/auth/me");
  const notes = useLoad<{ prefs: { newChapter: boolean } }>("/user/notifications");
  const [m, setM] = useState<Record<string, { ok: string; err: string }>>({});
  const set = (k: string, ok: string, err = "") => setM((x) => ({ ...x, [k]: { ok, err } }));
  // Photo / banner previews live on this device only: PUT /user/profile only
  // accepts username and bio, so there is no server upload to call yet.
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [showEmailNote, setShowEmailNote] = useState(false);
  const [prefs, setPrefs] = useState<ReadingPrefs>(DEFAULT_PREFS);
  useEffect(() => { setPrefs(loadPrefs()); }, []);
  const togglePref = (key: keyof ReadingPrefs) => {
    setPrefs((p) => {
      const next = { ...p, [key]: !p[key] };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* private mode etc. */ }
      return next;
    });
  };
  const pickFile = (e: React.ChangeEvent<HTMLInputElement>, setPreview: (u: string | null) => void) => {
    const f = e.target.files?.[0];
    if (f) setPreview(URL.createObjectURL(f));
    e.target.value = "";
  };

  if (profile.error instanceof ApiError && profile.error.status === 401) {
    return (
      <p>
        Please <Link href="/login" className="text-[#C084FC]">log in</Link> to change your settings.
      </p>
    );
  }

  const prefRows: { key: keyof ReadingPrefs; label: string; hint: string }[] = [
    { key: "resumePosition", label: "Resume where I left off", hint: "Open a chapter at the page you stopped on." },
    { key: "autoNextChapter", label: "Go to the next chapter automatically", hint: "When you reach the end of a chapter, load the next one." },
    { key: "compactCovers", label: "Compact covers in lists", hint: "Show smaller covers in your library and history." },
  ];

  return (
    <div className="max-w-2xl space-y-5">
      <ProfileNav active="/profile/settings" />
      <h1 className="text-2xl font-bold text-white">Settings</h1>
      <State loading={profile.loading} error={profile.error} />
      {profile.data && (
        <>
          <Section title="Profile picture">
            <div className="flex flex-wrap items-center gap-4">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="New profile picture preview" className="h-20 w-20 rounded-full object-cover ring-2 ring-[#9333EA]" />
              ) : (
                <ProfileAvatar username={profile.data.username} avatarUrl={profile.data.avatarUrl} />
              )}
              <div className="flex flex-wrap gap-2">
                <label className={`${btnGhost} cursor-pointer`}>
                  Change photo
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e, setPhotoPreview)} />
                </label>
                {photoPreview && (
                  <button type="button" className={btnGhost} onClick={() => setPhotoPreview(null)}>Remove</button>
                )}
              </div>
            </div>
            <p className="mt-3 text-sm text-[#A8A1B5]">
              Photo upload isn&apos;t connected to the server yet — a photo you pick is only previewed on this device.
            </p>
          </Section>

          <Section title="Profile banner">
            {bannerPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bannerPreview} alt="New profile banner preview" className="h-24 w-full rounded-lg object-cover" />
            ) : (
              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-[#322A42] bg-[#211B2D] text-sm text-[#A8A1B5]">
                No banner set
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <label className={`${btnGhost} cursor-pointer`}>
                Upload banner
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e, setBannerPreview)} />
              </label>
              {bannerPreview && (
                <button type="button" className={btnGhost} onClick={() => setBannerPreview(null)}>Remove banner</button>
              )}
            </div>
            <p className="mt-3 text-sm text-[#A8A1B5]">
              Banner upload isn&apos;t connected to the server yet — a banner you pick is only previewed on this device.
            </p>
          </Section>

          <Section title="Profile">
            <p className="mb-3 text-sm text-[#A8A1B5]">
              Member since {new Date(profile.data.createdAt).toLocaleDateString("en-IN")} ·{" "}
              <Link href="/profile" className="font-semibold text-[#C084FC] hover:underline">View your public profile</Link>
            </p>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  await act("/user/profile", "PUT", { username: f.get("username"), bio: f.get("bio") });
                  set("p", "Saved.");
                  profile.reload();
                  window.dispatchEvent(new Event("cv:notifications"));
                } catch (x) { set("p", "", errMsg(x)); }
              }}
            >
              <label className="block text-sm">
                <span className="mb-1 block text-[#A8A1B5]">Username</span>
                <input name="username" required defaultValue={profile.data.username} pattern="[a-zA-Z0-9_]{3,30}" title="3-30 letters, numbers or underscores" className={input} />
                <span className="mt-1 block text-xs text-[#A8A1B5]">3–30 letters, numbers or underscores. This is the name other readers see.</span>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-[#A8A1B5]">About you</span>
                <textarea name="bio" rows={3} maxLength={500} defaultValue={profile.data.bio ?? ""} className={input} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-[#A8A1B5]">Email</span>
                <span className="flex flex-wrap items-center gap-2">
                  <input value={profile.data.email} readOnly aria-label="Email" className={`${input} flex-1 opacity-70`} />
                  <button type="button" className={btnGhost} onClick={() => setShowEmailNote(true)}>Change</button>
                  {me.data?.emailVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#34D399] px-2 py-1 text-xs font-semibold text-[#34D399]">
                      <CheckCircle2 size={13} aria-hidden /> Email verified
                    </span>
                  ) : me.data ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#FBBF24] px-2 py-1 text-xs font-semibold text-[#FBBF24]">
                      Email not verified
                    </span>
                  ) : null}
                </span>
                {showEmailNote && (
                  <span className="mt-1 block text-xs text-[#A8A1B5]">Changing your email isn&apos;t available yet — there&apos;s no email-change option in the account API.</span>
                )}
              </label>
              <button className={btn}>Save profile</button>
              <Msg ok={m.p?.ok ?? ""} err={m.p?.err ?? ""} />
            </form>
          </Section>

          <Section title="Change password">
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                if (f.get("next") !== f.get("again")) return set("w", "", "The new passwords don't match.");
                try {
                  await act("/user/password", "PUT", { current: f.get("current"), next: f.get("next") });
                  form.reset();
                  set("w", "Password changed. Your other devices were signed out.");
                } catch (x) { set("w", "", errMsg(x)); }
              }}
            >
              <input name="current" type="password" required autoComplete="current-password" placeholder="Current password" aria-label="Current password" className={input} />
              <input name="next" type="password" required minLength={10} autoComplete="new-password" placeholder="New password (10+ characters)" aria-label="New password" className={input} />
              <input name="again" type="password" required minLength={10} autoComplete="new-password" placeholder="Repeat new password" aria-label="Repeat new password" className={input} />
              <button className={btn}>Update password</button>
              <Msg ok={m.w?.ok ?? ""} err={m.w?.err ?? ""} />
            </form>
          </Section>

          <Section title="Preferences">
            <p className="mb-3 text-sm text-[#A8A1B5]">How your reading behaves. These preferences are stored in this browser only.</p>
            <div className="space-y-3">
              {prefRows.map(({ key, label, hint }) => (
                <label key={key} className="flex cursor-pointer items-start justify-between gap-4 text-sm">
                  <span>
                    <span className="block font-medium text-white">{label}</span>
                    <span className="block text-xs text-[#A8A1B5]">{hint}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={prefs[key]}
                    onChange={() => togglePref(key)}
                    aria-label={label}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#9333EA]"
                  />
                </label>
              ))}
            </div>
          </Section>

          <Section title="Notifications">
            {notes.data && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notes.data.prefs.newChapter}
                  onChange={async (e) => {
                    try {
                      await act("/user/notification-settings", "PUT", { newChapter: e.target.checked });
                      notes.reload();
                      set("n", "Saved.");
                    } catch (x) { set("n", "", errMsg(x)); }
                  }}
                />
                Tell me when a bookmarked comic has a new chapter
              </label>
            )}
            <Msg ok={m.n?.ok ?? ""} err={m.n?.err ?? ""} />
          </Section>

          <Section title="Delete account">
            <p className="mb-3 text-sm text-[#A8A1B5]">This removes your email, bookmarks, history, notifications and reviews and signs you out everywhere. It can&apos;t be undone.</p>
            <button
              className={btnDanger}
              onClick={async () => {
                const password = prompt("To delete your account, enter your password:");
                if (!password) return;
                if (!confirm("Delete your account permanently?")) return;
                try {
                  await act("/user/account", "DELETE", { password });
                  router.push("/");
                  router.refresh();
                  window.dispatchEvent(new Event("cv:notifications"));
                } catch (x) { set("d", "", errMsg(x)); }
              }}
            >
              Delete my account
            </button>
            <Msg ok={m.d?.ok ?? ""} err={m.d?.err ?? ""} />
          </Section>
        </>
      )}
    </div>
  );
}
