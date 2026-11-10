import { expect, test, type Page } from "@playwright/test";
import { stubImages } from "./fixtures";

/** Controls are hidden by default; a tap in the middle of the artwork reveals them. */
const reveal = async (page: Page) => {
  const bar = page.getByRole("button", { name: "Reading settings" });
  if (await bar.isVisible()) return;
  const v = page.viewportSize() ?? { width: 1280, height: 720 };
  await page.mouse.click(v.width / 2, v.height / 2);
  await expect(bar).toBeVisible();
};

const open = async (page: Page, mode: string) => {
  await stubImages(page);
  await page.addInitScript((m) => localStorage.setItem("cv:reader:mode", m), mode);
  await page.goto("/comics/e2e-test-comic/chapter/e2e-chapter-0001");
  await expect(page.getByAltText("Page 1")).toBeVisible();
  await reveal(page);
  await expect(page.getByText("Page 1 / 3")).toBeVisible();
};

test("reader shows only artwork by default; a tap reveals controls", async ({ page }) => {
  await stubImages(page);
  await page.goto("/comics/e2e-test-comic/chapter/e2e-chapter-0001");
  await expect(page.getByAltText("Page 1")).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(0); // no site header
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reading settings" })).toBeHidden();
  await reveal(page);
  await expect(page.getByRole("navigation", { name: "Chapter navigation" })).toBeVisible();
});

test("paged mode: arrow keys and side taps move one page at a time", async ({ page }) => {
  await open(page, "paged");
  await expect(page.getByAltText("Page 2")).toHaveCount(0); // only the current page is rendered
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Page 2 / 3")).toBeVisible();
  const v = page.viewportSize() ?? { width: 1280, height: 720 };
  await page.mouse.click(v.width * 0.5 + 400 > v.width ? v.width - 10 : v.width * 0.5 + 400, v.height / 2);
  await expect(page.getByText("Page 3 / 3")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText("Page 2 / 3")).toBeVisible();
});

test("right-to-left mode: left arrow goes forward", async ({ page }) => {
  await open(page, "rtl");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText("Page 2 / 3")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Page 1 / 3")).toBeVisible();
});
