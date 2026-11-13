"use client";
import { useState } from "react";
import { api } from "@/lib/api";

const CATEGORIES = [
  { value: "BROKEN_CHAPTER", label: "Broken Chapter / Missing Pages" },
  { value: "CONTENT_ISSUE", label: "Wrong Title / Metadata Issue" },
  { value: "BUG", label: "Technical Bug" },
  { value: "LOGIN_ISSUE", label: "Login / Account Issue" },
  { value: "ABUSE", label: "Spam / Inappropriate Content" },
  { value: "FEATURE_REQUEST", label: "Feature Request" },
  { value: "GENERAL", label: "General Feedback" },
];

export default function ReportButton({
  targetType = "platform",
  targetId = "general",
  comicId,
  chapterId,
  label = "Report issue",
}: {
  targetType?: "comic" | "chapter" | "review" | "comment" | "platform" | "account";
  targetId?: string;
  comicId?: string;
  chapterId?: string;
  label?: string;
}) {
  const defaultCategory =
    targetType === "chapter"
      ? "BROKEN_CHAPTER"
      : targetType === "comic"
      ? "CONTENT_ISSUE"
      : targetType === "comment" || targetType === "review"
      ? "ABUSE"
      : "GENERAL";

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(defaultCategory);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 3) {
      setError("Please describe the issue (at least 3 characters).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/reports", {
        method: "POST",
        body: JSON.stringify({
          targetType,
          targetId,
          category,
          subject: subject.trim() || `${category}: ${targetType} ${targetId}`,
          description: description.trim(),
          reason: description.trim(),
          comicId,
          chapterId,
        }),
      });
      setSent(true);
      setOpen(false);
      setSubject("");
      setDescription("");
    } catch (err) {
      setError((err as Error).message || "Could not submit report. Make sure you are logged in.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return <span className="text-xs font-medium text-emerald-400">Issue reported — Admin notified</span>;
  }

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-muted hover:text-danger transition"
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-line bg-card p-5 text-left shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-fg">Report an Issue to Admin</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-muted hover:text-fg"
              >
                Close
              </button>
            </div>

            {error && (
              <p role="alert" className="rounded-md bg-danger/15 p-2.5 text-xs text-danger">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <label className="block space-y-1">
                <span className="text-muted">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-fg outline-none focus:border-primary"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-muted">Subject</span>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="Short summary of the problem"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-fg outline-none focus:border-primary"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-muted">Description</span>
                <textarea
                  required
                  rows={4}
                  maxLength={2000}
                  placeholder="Describe what happened so our admins can fix it..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-fg outline-none focus:border-primary"
                />
              </label>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-line px-3 py-2 text-muted hover:text-fg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {busy ? "Sending..." : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
