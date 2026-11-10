import Link from "next/link";
import { SearchX } from "lucide-react";

export default function EmptyState({ title, body, action }: { title: string; body?: string; action?: { href?: string; label: string; onClick?: () => void } }) {
  return (
    <div className="cv-panel flex flex-col items-center px-6 py-14 text-center">
      <SearchX size={30} className="mb-3 text-primary" aria-hidden />
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && (action.href
        ? <Link href={action.href} className="cv-btn cv-btn-primary mt-5">{action.label}</Link>
        : <button type="button" onClick={action.onClick} className="cv-btn cv-btn-primary mt-5">{action.label}</button>)}
    </div>
  );
}
