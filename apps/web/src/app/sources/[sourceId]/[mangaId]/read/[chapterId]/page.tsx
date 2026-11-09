import Link from "next/link";
import { notFound } from "next/navigation";

import Reader, {
  ChapterMeta,
  Img,
} from "@/components/Reader";

import { ApiError, api } from "@/lib/api";
import { buildNav, loadAllChapters } from "@/lib/chapter-nav";

import type {
  AlternativeSourceMatch,
  ExtChapter,
  ExtPages,
  MangaDetails,
  Paged,
  SourceInfo,
} from "@/lib/sources";

type RouteParams = {
  sourceId: string;
  mangaId: string;
  chapterId: string;
};

type SearchParams = {
  lang?: string;
};

type Props = {
  params: RouteParams | Promise<RouteParams>;
  searchParams?: SearchParams | Promise<SearchParams>;
};

const CHAPTER_PAGE_LIMIT = 500;
const MAX_CHAPTER_PAGES = 20;

export default async function ExternalRead({
  params,
}: {
  params: RouteParams | Promise<RouteParams>;
}) {
  // Compatible with Next.js versions where params are promises.
  const { sourceId, mangaId, chapterId } = await params;
  const query: SearchParams = {};

  const source = encodeURIComponent(sourceId);
  const manga = encodeURIComponent(mangaId);
  const chapter = encodeURIComponent(chapterId);

  const requestedLang =
    /^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(query.lang ?? "")
      ? query.lang!.toLowerCase()
      : null;

  const basePath = `/sources/${source}/manga/${manga}`;

  let pages: ExtPages;
  let mangaDetails: MangaDetails;
  let sourceInfo: SourceInfo;

  // Fetch chapter pages, manga information and source information.
  try {
    [pages, mangaDetails, sourceInfo] = await Promise.all([
      api<ExtPages>(
        `${basePath}/chapters/${chapter}/pages`,
        { cache: "no-store" }
      ),

      api<MangaDetails>(
        basePath,
        { cache: "no-store" }
      ),

      api<SourceInfo>(
        `/sources/${source}`,
        { cache: "no-store" }
      ),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    const altRes = sourceId === "comick"
      ? await api<{ alternatives: AlternativeSourceMatch[] }>(
          `${basePath}/alternatives?language=${encodeURIComponent(requestedLang ?? "en")}`,
          { cache: "no-store" }
        ).catch(() => ({ alternatives: [] }))
      : { alternatives: [] };

    const message =
      error instanceof ApiError
        ? error.message
        : "Something went wrong while loading this chapter.";

    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <h1 className="text-xl font-bold">
          This chapter cannot be loaded
        </h1>

        <p className="mt-2 text-sm text-muted">
          {message}
        </p>

        {altRes.alternatives.length > 0 && (
          <div className="mt-6 rounded-xl border border-line bg-card p-5 text-left">
            <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
              Alternative chapter sources (WeebCentral / Asura Scans)
            </h2>
            <p className="mt-1 text-xs text-muted">
              Switch to an alternative source below (uses that provider&apos;s own manga ID, chapter IDs, and reader URLs):
            </p>
            <div className="mt-4 space-y-3">
              {altRes.alternatives.map((alt) => (
                <div key={`${alt.sourceId}:${alt.externalId}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3 text-sm">
                  <div>
                    <p className="font-semibold">{alt.title}</p>
                    <p className="text-xs text-muted">{alt.sourceName} · ID: {alt.externalId} · {alt.totalChapters} chapters</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {alt.chapters[0] && (
                      <Link
                        href={alt.chapters[0].readerUrl}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Read on {alt.sourceName}
                      </Link>
                    )}
                    <Link
                      href={alt.catalogUrl}
                      className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold hover:bg-card"
                    >
                      All {alt.sourceName} chapters
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href={`/sources/${source}/${manga}`}
            className="rounded-md bg-primary px-4 py-2 font-semibold text-white"
          >
            Back to chapters
          </Link>

          <Link
            href="/sources"
            className="rounded-md border border-line px-4 py-2"
          >
            Search sources
          </Link>
        </div>
      </div>
    );
  }

  const chapterLanguage =
    /^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(pages.language ?? "")
      ? pages.language!.toLowerCase()
      : null;
  const lang =
    requestedLang ??
    chapterLanguage ??
    (mangaDetails.availableLanguages.includes("en")
      ? "en"
      : mangaDetails.availableLanguages[0] ?? "en");

  // Load chapters for previous/next navigation.
  let chapterItems: ExtChapter[] = [];

  try {
    chapterItems = await loadAllChapters(async (currentPage) => {
      const params = new URLSearchParams({
        language: lang,
        limit: String(CHAPTER_PAGE_LIMIT),
        page: String(currentPage),
      });

      const response = await api<Paged<ExtChapter>>(
        `${basePath}/chapters?${params}`,
        { cache: "no-store" }
      );
      return response;
    }, MAX_CHAPTER_PAGES);
  } catch {
    // The current chapter can still be read without navigation data.
    chapterItems = [];
  }

  const navigation = buildNav(chapterItems.map((item) => ({
    id: item.id,
    number: item.number,
    numberLabel: item.numberLabel,
    title: item.title,
    groups: item.groups,
  })), chapterId);

  const chapterNumber =
    navigation.current?.number ??
    (Number.parseFloat(pages.chapterNumber ?? "") || 1);

  const meta: ChapterMeta = {
    id: chapterId,
    number: chapterNumber,
    title: pages.chapterTitle ?? "",
    comic: {
      id: `ext:${sourceId}:${mangaId}`,
      slug: mangaId,
      title: mangaDetails.title,
    },
    imageCount: pages.pages.length,
    prev: navigation.prev,
    next: navigation.next,
  };

  // Convert source image URLs to ComicVerse reader images.
  const initial: Img[] = pages.pages.map((page) => ({
    id: `p${page.pageNumber}`,
    position: page.pageNumber - 1,
    width: page.width ?? 0,
    height: page.height ?? 0,
    url: page.imageUrl,
  }));

  const chapterMenu = navigation.list.length
    ? navigation.list
    : [{ id: chapterId, number: chapterNumber }];

  if (initial.length === 0) {
    const altRes = sourceId === "comick"
      ? await api<{ alternatives: AlternativeSourceMatch[] }>(
          `${basePath}/alternatives?language=${encodeURIComponent(lang)}`,
          { cache: "no-store" }
        ).catch(() => ({ alternatives: [] }))
      : { alternatives: [] };

    const targetLabel = pages.chapterNumber ?? String(navigation.current?.number ?? chapterNumber);
    const targetNum = Number.parseFloat(targetLabel);

    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <h1 className="text-xl font-bold">
          No chapter pages found on {sourceInfo.displayName}
        </h1>

        <p className="mt-2 text-sm text-muted">
          {sourceInfo.displayName} did not return any readable pages for this chapter.
        </p>

        {altRes.alternatives.length > 0 && (
          <div className="mt-6 rounded-xl border border-line bg-card p-5 text-left">
            <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
              Alternative chapter sources (WeebCentral / Asura Scans)
            </h2>
            <p className="mt-1 text-xs text-muted">
              Read this chapter on an alternative source (preserving that source&apos;s own chapter ID and reader URL):
            </p>
            <div className="mt-4 space-y-3">
              {altRes.alternatives.map((alt) => {
                const matched = alt.chapters.find((ch) =>
                  (ch.numberLabel && ch.numberLabel.trim() === targetLabel.trim()) ||
                  (!Number.isNaN(targetNum) && ch.number !== null && Math.abs(ch.number - targetNum) < 0.001)
                );
                return (
                  <div key={`${alt.sourceId}:${alt.externalId}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3 text-sm">
                    <div>
                      <p className="font-semibold">{alt.title}</p>
                      <p className="text-xs text-muted">
                        {alt.sourceName} · Manga ID: {alt.externalId}
                        {matched ? ` · Chapter ID: ${matched.id}` : ` · ${alt.totalChapters} chapters`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {matched && (
                        <Link
                          href={matched.readerUrl}
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Read Ch. {matched.numberLabel ?? targetLabel} on {alt.sourceName}
                        </Link>
                      )}
                      <Link
                        href={alt.catalogUrl}
                        className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold hover:bg-card"
                      >
                        Browse {alt.sourceName} chapters
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href={`/sources/${source}/${manga}`}
            className="rounded-md bg-primary px-4 py-2 font-semibold text-white"
          >
            Back to chapters
          </Link>
          <a
            href={pages.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-line px-4 py-2"
          >
            Open on {sourceInfo.displayName}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* External source information */}
      <div className="mx-auto max-w-4xl rounded-lg border border-line bg-card px-4 py-3 text-xs text-muted">
        <span className="font-semibold text-fg">
          External chapter
        </span>

        {" "}from {sourceInfo.displayName} (ID: {chapterId})

        {pages.groups.length > 0 && (
          <> · Group: {pages.groups.join(", ")}</>
        )}

        {" "}·{" "}

        <a
          href={pages.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >
          Open on {sourceInfo.displayName}
        </a>
      </div>

      {/* ComicVerse reader */}
      <Reader
        key={`${sourceId}:${mangaId}:${chapterId}`}
        slug={mangaId}
        meta={meta}
        initial={initial}
        chapters={chapterMenu}
        external={{
          basePath: `/sources/${sourceId}/${mangaId}`,
          query: `?lang=${lang}`,
        }}
      />
    </div>
  );
}

export function generateStaticParams() {
  return [{ sourceId: 'default', mangaId: 'default', chapterId: '1' }];
}
