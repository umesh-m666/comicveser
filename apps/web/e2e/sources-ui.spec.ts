import { expect, test } from "@playwright/test";

const MANGA_ID = "solo-leveling-ragnarok-ab39de10";
const ITEM = {
  id: MANGA_ID,
  externalId: MANGA_ID,
  sourceId: "asurascans",
  title: "Mocked Solo Leveling",
  alternativeTitles: [],
  coverUrl: null,
  description: "A mocked description.",
  status: "ongoing",
  genres: [],
  contentType: "manhwa",
  language: "en",
  sourceUrl: `https://asurascans.com/comics/${MANGA_ID}`,
};

test("external catalog explains the approval gate and links to published comics", async ({ page }) => {
  await page.goto("/sources");
  await expect(page.getByRole("heading", { name: "External title catalog" })).toBeVisible();
  await expect(page.getByText(/reviewed by ComicVerse administrators/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse published comics" })).toHaveAttribute("href", "/browse");
});

test("chapter list retries a failed page and keeps its selected language on read links", async ({ page }) => {
  const manga = { ...ITEM, authors: [], artists: [], year: null, availableLanguages: ["en"] };
  await page.route(new RegExp(`/api/sources/asurascans/manga/${MANGA_ID}$`), (route) => route.fulfill({ json: manga }));
  let attempts = 0;
  await page.route(new RegExp(`/api/sources/asurascans/manga/${MANGA_ID}/chapters(?:\\?.*)?$`), (route) => {
    attempts += 1;
    return attempts === 1
      ? route.fulfill({ status: 503, json: { error: { message: "Asura Scans could not be reached right now." } } })
      : route.fulfill({ json: { items: [{ id: "1", number: 1, numberLabel: "1", title: null, groups: [], publishedAt: null, duplicateNumber: false }], total: 1, page: 1, limit: 100, hasMore: false } });
  });
  await page.goto(`/sources/asurascans/${MANGA_ID}`);
  await expect(page.locator("article [role=alert]")).toContainText("could not be reached");
  await page.getByRole("button", { name: "Retry" }).click();
  const readLink = page.getByRole("link", { name: "Read Chapter 1" });
  await expect(readLink).toBeVisible();
  await expect(readLink).toHaveAttribute("href", `/sources/asurascans/${MANGA_ID}/read/1?lang=en`);
});
