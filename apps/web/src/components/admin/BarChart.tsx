export default function BarChart({ title, data, color = "var(--primary)" }: { title: string; data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value)); const total = data.reduce((s, d) => s + d.value, 0);
  const w = 600, h = 120, bw = w / Math.max(1, data.length);
  return (
    <figure className="rounded-lg border border-line bg-card p-4">
      <figcaption className="mb-2 flex justify-between text-sm"><span className="font-semibold">{title}</span><span className="text-muted">{total.toLocaleString()} total</span></figcaption>
      <svg viewBox={`0 0 ${w} ${h + 16}`} className="w-full" role="img" aria-label={`${title}: ${total} in total`}>
        {data.map((d, i) => { const bh = (d.value / max) * h; return <rect key={d.label} x={i * bw + 1} y={h - bh} width={Math.max(1, bw - 2)} height={bh} rx={2} fill={color}><title>{`${d.label}: ${d.value}`}</title></rect>; })}
        <text x={0} y={h + 12} fontSize="10" fill="var(--muted)">{data[0]?.label}</text>
        <text x={w} y={h + 12} fontSize="10" fill="var(--muted)" textAnchor="end">{data[data.length - 1]?.label}</text>
      </svg>
    </figure>
  );
}
