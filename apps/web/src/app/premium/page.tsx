"use client";
import Link from "next/link";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { State, table } from "@/components/admin/ui";
import { act, errMsg, useLoad } from "@/lib/useApi";

interface Plan { code: string; name: string; priceMinor: number; currency: string; intervalMonths: number }
const money = (n: number, c: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: c }).format(n / 100);
const loadRzp = () => new Promise<void>((res, rej) => {
  if ((window as any).Razorpay) return res();
  const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = () => res(); s.onerror = () => rej(new Error("Couldn't load the payment window. Check your connection."));
  document.body.appendChild(s);
});

export default function Premium() {
  const plans = useLoad<{ enabled: boolean; plans: Plan[] }>("/billing/plans");
  const status = useLoad<{ premium: boolean; until: string | null; plan: string | null; canceled: boolean }>("/billing/status");
  const history = useLoad<any[]>("/billing/history");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const anon = status.error instanceof ApiError && status.error.status === 401;
  const refresh = () => { status.reload(); history.reload(); };

  async function subscribe(code: string) {
    setErr(""); setMsg(""); setBusy(true);
    try {
      const o = await act<{ orderId: string; amount: number; currency: string; keyId: string; planName: string }>("/billing/checkout", "POST", { planCode: code });
      await loadRzp();
      new (window as any).Razorpay({
        key: o.keyId, order_id: o.orderId, amount: o.amount, currency: o.currency, name: "ComicVerse", description: o.planName, theme: { color: "#8B5CF6" },
        handler: async (r: any) => {
          try { await act("/billing/verify", "POST", { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }); setMsg("Payment received. Premium is active."); }
          catch (e) { setErr(errMsg(e) + " If you were charged, your membership will activate shortly once the payment is confirmed."); }
          refresh(); setBusy(false);
        },
        modal: { ondismiss: () => setBusy(false) },
      }).open();
    } catch (e) { setErr(errMsg(e)); setBusy(false); refresh(); }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">Premium</h1>
      <p className="mb-6 text-muted">Premium supports ComicVerse. Premium-only perks such as early chapters and licensed content are not live yet.</p>
      <State loading={plans.loading} error={plans.error} />
      {plans.data && !plans.data.enabled && <p className="rounded-lg border border-line bg-card p-4">Premium memberships aren't available right now.</p>}
      {anon && <p>Please <Link href="/login" className="text-primary">log in</Link> to manage your membership.</p>}
      {status.data?.premium && (
        <div className="mb-6 rounded-lg border border-success bg-card p-4">
          <p className="font-semibold">{status.data.plan} is active</p>
          <p className="text-sm text-muted">{status.data.canceled ? "Cancelled. Access ends" : "Active until"} {new Date(status.data.until!).toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
          {!status.data.canceled && <button className="mt-2 rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface" onClick={async () => { if (confirm("Cancel your membership? You keep access until the end of the paid period.")) { try { await act("/billing/cancel", "POST"); refresh(); } catch (e) { setErr(errMsg(e)); } } }}>Cancel membership</button>}
        </div>)}
      {plans.data?.enabled && !anon && (
        <div className="grid gap-4 sm:grid-cols-2">{plans.data.plans.map((p) => (
          <div key={p.code} className="rounded-lg border border-line bg-card p-5"><h2 className="font-semibold">{p.name}</h2>
            <p className="my-2 text-2xl font-bold">{money(p.priceMinor, p.currency)}<span className="text-sm font-normal text-muted"> / {p.intervalMonths === 12 ? "year" : "month"}</span></p>
            <p className="mb-3 text-xs text-muted">One-time payment. Buying again extends your period; it does not renew automatically.</p>
            <button disabled={busy} onClick={() => subscribe(p.code)} className="w-full rounded-md bg-primary py-2 font-semibold disabled:opacity-60">{status.data?.premium ? "Extend" : "Subscribe"}</button></div>))}</div>)}
      {msg && <p role="status" className="mt-4 text-success">{msg}</p>}{err && <p role="alert" className="mt-4 text-danger">{err}</p>}
      {history.data && history.data.length > 0 && (<section className="mt-8"><h2 className="mb-2 font-semibold">Payment history</h2>
        <div className="overflow-x-auto"><table className={table}><thead><tr><th>Invoice</th><th>Date</th><th>Plan</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>{history.data.map((h) => <tr key={h.id}><td>{h.invoiceNo}</td><td>{new Date(h.createdAt).toLocaleDateString("en-IN")}</td><td>{h.planCode.replace("premium_", "")}</td><td>{money(h.amountMinor, h.currency)}</td><td>{h.status.toLowerCase()}</td></tr>)}</tbody></table></div></section>)}
    </div>
  );
}
