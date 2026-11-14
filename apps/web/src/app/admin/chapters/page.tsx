"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge, State, btn, table } from "@/components/admin/ui";
import AvailableSourceChapters from "@/components/admin/AvailableSourceChapters";
import { useLoad } from "@/lib/useApi";

/**
 * Asura Admin Chapters Page (#frame-admin-chapters):
 * .a-top header, .a-panel for comic selector & chapters table, and AvailableSourceChapters.
 */
export default function AdminChapters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("comicId") ?? undefined;
  const comics = useLoad<{ items: { id: string; title: string }[] }>("/admin/comics?pageSize=100");
  const list = useLoad<any[]>(id ? `/admin/chapters?comicId=${id}` : null);

  return (
    <div>
      <div className="a-top" data-layer="Admin Topbar">
        <div>
          <h1>Chapters</h1>
          <div className="sub">Publish and manage chapters for any comic.</div>
        </div>
        {id && (
          <Link
            href={`/admin/chapters/new?comicId=${id}`}
            className={btn}
            style={{ marginLeft: "auto", minHeight: 38 }}
          >
            ＋ New chapter
          </Link>
        )}
      </div>

      <div className="a-panel" data-layer="Select Comic">
        <h3>Select comic</h3>
        <div className="psub">Choose a comic to inspect, upload, or manage its chapters.</div>
        <label className="block max-w-sm text-sm">
          <select
            value={id ?? ""}
            onChange={(e) =>
              router.push(
                e.target.value ? `/admin/chapters?comicId=${e.target.value}` : "/admin/chapters",
              )
            }
            className="set-input mt-1"
            aria-label="Select comic"
          >
            <option value="">Choose a comic…</option>
            {comics.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>

        {id && (
          <div className="mt-5">
            <State loading={list.loading} error={list.error} />
            {list.data &&
              (list.data.length === 0 ? (
                <p className="text-muted">No chapters yet for this comic.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className={table}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Pages</th>
                        <th>Published</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {list.data.map((ch) => (
                        <tr key={ch.id}>
                          <td className="font-bold text-white">
                            Chapter {ch.sourceChapter?.numberLabel ?? ch.number}
                          </td>
                          <td>{ch.title || "—"}</td>
                          <td>
                            <Badge v={ch.publishState} />
                          </td>
                          <td>{ch._count.images}</td>
                          <td>
                            {ch.publishedAt
                              ? new Date(ch.publishedAt).toLocaleDateString("en-IN")
                              : ch.scheduledAt
                              ? `Scheduled ${new Date(ch.scheduledAt).toLocaleString("en-IN")}`
                              : "—"}
                          </td>
                          <td className="text-right">
                            <Link href={`/admin/chapters/${ch.id}`} className="rowbtn">
                              Manage
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>
        )}
      </div>

      {id && (
        <div className="mt-5">
          <AvailableSourceChapters comicId={id} onPublished={() => list.reload()} />
        </div>
      )}
    </div>
  );
}
