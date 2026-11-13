import Link from "next/link";

export const input = "set-input";
export const btn = "pillbtn !ml-0";
export const btnGhost = "rowbtn";
export const btnDanger = "rowbtn danger";
export const table = "atable";

export function State({ loading, error }: { loading: boolean; error: { message: string } | null }) {
  if (error) return <p role="alert" className="text-danger">{error.message}</p>;
  return loading ? <div className="skeleton h-24" aria-busy="true" /> : null;
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="pager">
      {page > 1 && <Link href={href(page - 1)}>‹ Previous</Link>}
      <span className="on" style={{ padding: "0 12px", borderRadius: 7, background: "var(--purple)", color: "#fff", display: "inline-grid", placeItems: "center", height: 34, fontSize: 12.5, fontWeight: 600 }}>
        Page {page} of {pages}
      </span>
      {page < pages && <Link href={href(page + 1)}>Next ›</Link>}
    </nav>
  );
}

export const Badge = ({ v }: { v: string }) => {
  const tone =
    v === "PUBLISHED" || v === "ACTIVE" || v === "APPROVED" || v === "Live"
      ? "green"
      : v === "SUSPENDED" || v === "REJECTED" || v === "FAILED"
      ? "red"
      : v === "PENDING" || v === "Scheduled"
      ? "amber"
      : "grey";
  return <span className={`tag ${tone}`}>{v}</span>;
};
