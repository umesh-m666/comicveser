import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Track from "@/components/Track";
import Reader, { ChapterMeta, ImgPage } from "@/components/Reader";
import { ApiError, api } from "@/lib/api";
import type { ExtPages } from "@/lib/sources";

type Props = { params: { slug: string; chapterId: string } };
export const metadata: Metadata = { title: "Reader" };

export default async function ChapterPage({ params }: Props) {
  let meta: ChapterMeta, first: ImgPage, chapters: { id: string; number: number }[];
  try {
    meta = await api<ChapterMeta>(`/chapters/${params.chapterId}`, { cache: "no-store" });
    if (meta.external) {
      const { sourceId, mangaId, chapterId } = meta.external;
      try {
        const pages = await api<ExtPages>(`/sources/${encodeURIComponent(sourceId)}/manga/${encodeURIComponent(mangaId)}/chapters/${encodeURIComponent(chapterId)}/pages`, { cache: "no-store" });
        first = {
          total: pages.pages.length,
          items: pages.pages.map((page) => ({
            id: `p${page.pageNumber}`,
            position: page.pageNumber - 1,
            width: page.width ?? 0,
            height: page.height ?? 0,
            url: page.imageUrl,
          })),
        };
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 400)) throw err;
        first = { total: 0, items: [] };
      }
      meta = { ...meta, imageCount: first.total };
    } else {
      first = await api<ImgPage>(`/chapters/${params.chapterId}/images?from=0&limit=10`, { cache: "no-store" });
    }
    chapters = await api(`/comics/${meta.comic.id}/chapters?order=asc`, { cache: "no-store" });
  } catch (e) {
    notFound();
  }
  if (meta.comic.slug !== params.slug) notFound();
  return <><Track type="CHAPTER_VIEW" comicId={meta.comic.id} chapterId={meta.id} /><Reader key={meta.id} slug={params.slug} meta={meta} initial={first.items} chapters={chapters} /></>;
}

export function generateStaticParams() {
  return [{ slug: 'default', chapterId: '1' }];
}
