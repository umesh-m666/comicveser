"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, State, btn, input, table } from "@/components/admin/ui";
import AvailableSourceChapters from "@/components/admin/AvailableSourceChapters";
import { useLoad } from "@/lib/useApi";

/**
 * Asura Admin Chapters Page (#frame-admin-chapters):
 * .a-top header, .a-panel for comic selector & chapters table, and AvailableSourceChapters.
 */
export default function AdminChapters({ searchParams }: { searchParams: { comicId?: string } }) {
  const router = useRouter();
  const id = searchParams.comicId;
  const comics = useLoad<{ items: { id: string; title: string }[] }>("/admin/comics");
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
            className={input}
            aria-label="Comic"
          >
            <option value="">Select a comic</option>
            {comics.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!id && (
        <div className="a-panel text-muted">
          Choose a comic above to manage its chapters. You can also open this page from a comic&apos;s &ldquo;Chapters&rdquo; button.
        </div>
      )}

      {id && (
        <div className="a-panel" data-layer="Chapter Table">
          <h3>Chapters</h3>
          <div className="psub">Set a chapter to Draft to hide it from readers, or manage pages.</div>
          <State loading={list.loading} error={list.error} />
          {list.data &&
            (list.data.length === 0 ? (
              <p className="text-muted">No chapters yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className={table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Title</th>
                      <th>Source</th>
                      <th>State</th>
                      <th>Pages</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <b>Chapter {c.number}</b>
                        </td>
                        <td>{c.title}</td>
                        <td className="text-xs text-muted">
                          {c.sourceChapter?.sourceTitle ? (
                            <span>
                              <strong className="text-white">
                                {c.sourceChapter.sourceTitle.sourceId}
                              </strong>{" "}
                              · ID: {c.sourceChapter.externalId}
                            </span>
                          ) : (
                            "Local upload"
                          )}
                        </td>
                        <td>
                          <Badge v={c.publishState} />
                        </td>
                        <td>{c.sourceChapter?.pageCount ?? c._count?.images ?? 0}</td>
                        <td className="space-x-2 text-right">
                          {c.comic?.slug && (
                            <Link
                              href={`/comics/${c.comic.slug}/chapter/${c.id}`}
                              target="_blank"
                              className="rowbtn"
                            >
                              Open reader ↗
                            </Link>
                          )}
                          <Link href={`/admin/chapters/${c.id}`} className="rowbtn">
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

      {id && <AvailableSourceChapters key={id} comicId={id} onImported={list.reload} />}
    </div>
  );
}
