import { expect, test } from "@playwright/test";
import { stubImages } from "./fixtures";

const open = async (page: import("@playwright/test").Page, mode: string) => {
  await stubImages(page);
  await page.addInitScript((m) => localStorage.setItem("cv:reader:mode", m), mode);
  await page.goto("/comics/e2e-test-comic/chapter/e2e-chapter-0001");
  await expect(page.getByText("Page 1 / 3")).toBeVisible();
};

test("paged mode: arrow keys and buttons move one page at a time", async ({ page }) => {
  await open(page, "paged");
  await expect(page.getByAltText("Page 2")).toHaveCount(0); // only the current page is rendered
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Page 2 / 3")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
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
