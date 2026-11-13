import Link from "next/link";
import { ComicVerseMark } from "./ComicVerseLogo";

export default function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: { href?: string; label: string; onClick?: () => void };
}) {
  return (
    <div className="cv-panel flex flex-col items-center px-6 py-14 text-center">
      <span
        aria-hidden="true"
        className="mb-3.5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-[#2F2250] p-2 shadow-md"
      >
        <ComicVerseMark className="h-full w-full" />
      </span>
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action &&
        (action.href ? (
          <Link href={action.href} className="cv-btn cv-btn-primary mt-5">
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className="cv-btn cv-btn-primary mt-5">
            {action.label}
          </button>
        ))}
    </div>
  );
}
