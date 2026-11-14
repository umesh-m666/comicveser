"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export const input = "set-input";
export const btn = "pillbtn !ml-0";
export const btnGhost = "rowbtn";
export const btnDanger = "rowbtn danger";
export const table = "atable";

export function State({ loading, error }: { loading: boolean; error: { message: string } | null }) {
  if (error) return <p role="alert" className="text-danger">{error.message}</p>;
  return loading ? <div className="skeleton h-24" aria-busy="true" /> : null;
}

export function Pager({
  page,
  pages,
  href,
  onPageChange,
}: {
  page: number;
  pages: number;
  href: (p: number) => string;
  onPageChange?: (p: number) => void;
}) {
  const router = useRouter();
  if (pages <= 1) return null;

  const go = (e: React.MouseEvent, targetPage: number) => {
    e.preventDefault();
    if (targetPage < 1 || targetPage > pages || targetPage === page) return;
    if (onPageChange) onPageChange(targetPage);
    router.push(href(targetPage));
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <nav aria-label="Pagination" className="pager">
      {page > 1 && (
        <Link href={href(page - 1)} onClick={(e) => go(e, page - 1)}>
          ‹ Prev
        </Link>
      )}
      <span
        className="on"
        style={{
          padding: "0 12px",
          borderRadius: 7,
          background: "var(--purple)",
          color: "#fff",
          display: "inline-grid",
          placeItems: "center",
          height: 34,
          fontSize: 12.5,
          fontWeight: 600,
        }}
      >
        Page {page} of {pages}
      </span>
      {page < pages && (
        <Link href={href(page + 1)} onClick={(e) => go(e, page + 1)}>
          Next ›
        </Link>
      )}
    </nav>
  );
}

export const Badge = ({ v }: { v: string }) => {
  const upper = String(v).toUpperCase();
  const tone =
    upper === "ADMIN"
      ? "gold"
      : upper === "USER" || upper === "READER" || upper === "CREATOR"
      ? "purple"
      : v === "PUBLISHED" || v === "ACTIVE" || v === "APPROVED" || v === "Live"
      ? "green"
      : v === "SUSPENDED" || v === "REJECTED" || v === "FAILED"
      ? "red"
      : v === "PENDING" || v === "Scheduled"
      ? "amber"
      : "grey";
  return <span className={`tag ${tone}`}>{upper === "ADMIN" ? `★ ${v}` : v}</span>;
};
