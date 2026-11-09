import Link from "next/link";
export const input = "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm";
export const btn = "rounded-md bg-primary px-3 py-1.5 text-sm font-semibold disabled:opacity-60";
export const btnGhost = "rounded-md border border-line px-3 py-1.5 text-sm hover:bg-card disabled:opacity-60";
export const btnDanger = "rounded-md border border-danger px-3 py-1.5 text-sm text-danger hover:bg-card disabled:opacity-60";
export const table = "w-full text-left text-sm [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2 [&_th]:text-muted [&_tr]:border-b [&_tr]:border-line";

export function State({ loading, error }: { loading: boolean; error: { message: string } | null }) {
  if (error) return <p role="alert" className="text-danger">{error.message}</p>;
  return loading ? <div className="skeleton h-24" aria-busy="true" /> : null;
}
export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center gap-3 text-sm">
      {page > 1 && <Link className={btnGhost} href={href(page - 1)}>Previous</Link>}
      <span className="text-muted">Page {page} of {pages}</span>
      {page < pages && <Link className={btnGhost} href={href(page + 1)}>Next</Link>}
    </nav>
  );
}
export const Badge = ({ v }: { v: string }) => (
  <span className={`rounded-full border px-2 py-0.5 text-xs ${v === "PUBLISHED" || v === "ACTIVE" ? "border-success text-success" : v === "SUSPENDED" ? "border-danger text-danger" : "border-line text-muted"}`}>{v}</span>
);
