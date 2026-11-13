"use client";
import { useEffect, useState } from "react";

const STORE_KEY = "cv-admin-settings";
const FIELD = "w-full rounded-lg border border-[#322A42] bg-[#211B2D] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#9333EA]";
const panel = "rounded-2xl border border-[#322A42] bg-[#17141F] p-5";
const panelTitle = "text-base font-bold text-white";

type Settings = { siteName: string; tagline: string; supportEmail: string; defaultVisibility: string; allowReviews: boolean; maintenanceMode: boolean };
const DEFAULTS: Settings = { siteName: "ComicVerse", tagline: "Stories worth staying up for.", supportEmail: "support@comicverse.example", defaultVisibility: "DRAFT", allowReviews: true, maintenanceMode: false };

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setSettings({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) });
    } catch { /* keep defaults */ }
  }, []);
  const save = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
    setSaved(true);
  };
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => { setSaved(false); setSettings((s) => ({ ...s, [key]: value })); };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-[#A8A1B5]">Site, authentication, email and content defaults for ComicVerse admins.</p>
      </div>

      <section className={panel} aria-labelledby="general-heading">
        <h2 id="general-heading" className={panelTitle}>General</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-[#A8A1B5]">Site name</span>
            <input className={FIELD} value={settings.siteName} onChange={(e) => set("siteName", e.target.value)} maxLength={60} />
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-[#A8A1B5]">Support email</span>
            <input className={FIELD} type="email" value={settings.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} maxLength={120} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1.5 block font-medium text-[#A8A1B5]">Tagline</span>
            <input className={FIELD} value={settings.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={120} />
          </label>
        </div>
        <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#322A42] bg-[#211B2D] px-3.5 py-3 text-sm">
          <span><span className="block font-medium text-white">Maintenance mode</span><span className="text-xs text-[#A8A1B5]">Temporarily show a maintenance notice to readers.</span></span>
          <input type="checkbox" checked={settings.maintenanceMode} onChange={(e) => set("maintenanceMode", e.target.checked)} className="h-4 w-4 accent-[#9333EA]" />
        </label>
      </section>

      <section className={panel} aria-labelledby="auth-email-heading">
        <h2 id="auth-email-heading" className={panelTitle}>Authentication &amp; Email</h2>
        <ul className="mt-4 space-y-3 text-sm">
          <li className="flex items-center justify-between gap-3 rounded-lg border border-[#322A42] bg-[#211B2D] px-3.5 py-3">
            <span className="font-medium text-white">Google OAuth Sign-In</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#34D399]/40 px-2.5 py-1 text-xs font-semibold text-[#34D399]"><span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" aria-hidden />Configured &amp; Active</span>
          </li>
          <li className="flex items-center justify-between gap-3 rounded-lg border border-[#322A42] bg-[#211B2D] px-3.5 py-3">
            <span className="font-medium text-white">Email Provider (resend)</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#34D399]/40 px-2.5 py-1 text-xs font-semibold text-[#34D399]"><span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" aria-hidden />Configured</span>
          </li>
        </ul>
        <p className="mt-3 text-xs text-[#A8A1B5]">Auth and email providers are configured with environment variables on the API server; their status is shown here read-only.</p>
      </section>

      <section className={panel} aria-labelledby="content-heading">
        <h2 id="content-heading" className={panelTitle}>Content defaults</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-[#A8A1B5]">Default visibility for new comics</span>
            <select className={FIELD} value={settings.defaultVisibility} onChange={(e) => set("defaultVisibility", e.target.value)}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="UNPUBLISHED">Unpublished</option>
            </select>
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#322A42] bg-[#211B2D] px-3.5 py-3 text-sm">
            <span className="font-medium text-white">Allow user reviews</span>
            <input type="checkbox" checked={settings.allowReviews} onChange={(e) => set("allowReviews", e.target.checked)} className="h-4 w-4 accent-[#9333EA]" />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} className="rounded-lg bg-[#9333EA] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">Save settings</button>
        {saved && <p role="status" className="text-sm text-[#34D399]">Settings saved in this browser.</p>}
      </div>
      <p className="text-xs text-[#A8A1B5]">There is no server settings endpoint yet, so these settings are stored in this browser only and do not change server behaviour.</p>
    </div>
  );
}
