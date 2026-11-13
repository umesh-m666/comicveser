"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";

interface Rev {
  id: string;
  body: string;
  helpfulCount: number;
  createdAt: string;
  rating: number | null;
  user: { id: string; username: string };
}
const call = <T,>(p: string, method = "GET", json?: unknown) =>
  api<T>(p, { method, json, credentials: "include", cache: "no-store" });

export default function ReviewsSection({ comicId }: { comicId: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    average: number | null;
    ratingCount: number;
    total: number;
    pages: number;
    items: Rev[];
  } | null>(null);
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [mine, setMine] = useState<{
    rating: number | null;
    review: { id: string; body: string } | null;
  } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    call<any>(`/comics/${comicId}/reviews?page=${page}`)
      .then(setData)
      .catch(() => setMsg("Couldn't load reviews."));
  const loadMine = () =>
    call<any>(`/comics/${comicId}/mine`)
      .then(setMine)
      .catch(() => setMine(null));
  useEffect(() => {
    load();
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    call<{ id: string }>("/auth/me")
      .then((u) => {
        setMe(u);
        loadMine();
      })
      .catch(() => setMe(null));
  }, [comicId]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn: () => Promise<unknown>, after?: () => void) => {
    setMsg("");
    setBusy(true);
    try {
      await fn();
      after?.();
      load();
      loadMine();
    } catch (e) {
      setMsg(e instanceof ApiError ? (e.details?.join(" ") ?? e.message) : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="rev-h" data-layer="Ratings & Reviews">
      <div className="panel-h2">
        <span className="ic" aria-hidden="true">
          ★
        </span>
        <h2 id="rev-h">Ratings and reviews</h2>
        <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12.5 }}>
          {data?.average
            ? `★ ${data.average.toFixed(1)} / 10 (${data.ratingCount} rating${
                data.ratingCount === 1 ? "" : "s"
              })`
            : "No ratings yet"}
        </span>
      </div>

      {me ? (
        <div
          style={{
            background: "var(--panel-2)",
            border: "1px solid var(--row-line)",
            borderRadius: 9,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }}>Your rating</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Your rating">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
              <button
                key={v}
                type="button"
                disabled={busy}
                aria-pressed={mine?.rating === v}
                onClick={() => act(() => call(`/comics/${comicId}/rating`, "PUT", { value: v }))}
                className={`chip ${mine?.rating === v ? "on" : ""}`}
                style={{ minWidth: 34, justifyContent: "center", padding: "5px 10px" }}
              >
                {v}
              </button>
            ))}
          </div>

          <form
            style={{ marginTop: 14 }}
            onSubmit={(e) => {
              e.preventDefault();
              const body = String(new FormData(e.currentTarget).get("body"));
              act(() =>
                mine?.review
                  ? call(`/reviews/${mine.review.id}`, "PUT", { body })
                  : call(`/comics/${comicId}/reviews`, "POST", { body }),
              );
            }}
          >
            <label className="block">
              <span className="set-label" style={{ marginTop: 0 }}>
                {mine?.review ? "Edit your review" : "Write a review"} (10+ characters)
              </span>
              <textarea
                key={mine?.review?.id ?? "new"}
                name="body"
                required
                minLength={10}
                maxLength={3000}
                rows={3}
                defaultValue={mine?.review?.body ?? ""}
                className="w-full rounded-lg border border-[#353247] bg-[#17141f] p-3 text-sm text-white"
              />
            </label>
            <div className="mt-2.5 flex gap-2">
              <button disabled={busy} className="pillbtn" style={{ marginLeft: 0 }}>
                {mine?.review ? "Save review" : "Post review"}
              </button>
              {mine?.review && (
                <button
                  type="button"
                  disabled={busy}
                  className="rowbtn danger"
                  onClick={() =>
                    confirm("Delete your review?") &&
                    act(() => call(`/reviews/${mine.review!.id}`, "DELETE"))
                  }
                >
                  Delete
                </button>
              )}
            </div>
          </form>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
          <Link href="/login" style={{ color: "var(--purple-2)", fontWeight: 600 }}>
            Log in
          </Link>{" "}
          to rate and review this series.
        </p>
      )}

      {msg && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {msg}
        </p>
      )}

      {data && data.items.length > 0 ? (
        <div className="space-y-2.5">
          {data.items.map((r) => (
            <div key={r.id} className="upd" style={{ alignItems: "flex-start" }}>
              <div className="u-main">
                <div className="flex items-center justify-between text-xs">
                  <span style={{ fontWeight: 700, color: "#fff" }}>
                    @{r.user.username}
                    {r.rating && (
                      <span style={{ color: "var(--gold)", marginLeft: 8 }}>★ {r.rating}/10</span>
                    )}
                  </span>
                  <span style={{ color: "var(--muted-2)" }}>
                    {new Date(r.createdAt).toLocaleDateString("en-IN")}
                  </span>
                </div>
                <p
                  style={{
                    margin: "6px 0",
                    fontSize: 13,
                    color: "#ddd9ea",
                    fontFamily: "Inter, sans-serif",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {r.body}
                </p>
                {me && me.id !== r.user.id ? (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="rowbtn"
                      disabled={busy}
                      onClick={() => act(() => call(`/reviews/${r.id}/helpful`, "POST"))}
                    >
                      Helpful ({r.helpfulCount})
                    </button>
                    <button
                      type="button"
                      className="rowbtn danger"
                      disabled={busy}
                      onClick={() => {
                        const reason = prompt("Why are you reporting this review?");
                        if (reason && reason.trim().length >= 5)
                          act(
                            () =>
                              call("/reports", "POST", {
                                targetType: "REVIEW",
                                targetId: r.id,
                                reason: reason.trim(),
                              }),
                            () => setMsg("Thanks, we'll take a look."),
                          );
                      }}
                    >
                      Report
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize: 11.5, color: "var(--muted-2)" }}>
                    {r.helpfulCount} found this helpful
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
          No reviews yet. Be the first to review this comic!
        </p>
      )}

      {data && data.pages > 1 && (
        <div className="pager">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ‹ Previous
          </button>
          <button type="button" className="on">
            {page} / {data.pages}
          </button>
          <button type="button" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
            Next ›
          </button>
        </div>
      )}
    </section>
  );
}
