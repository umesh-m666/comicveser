import { expect, test } from "@playwright/test";
import { ADMIN, API, PNG, login } from "./fixtures";

const stamp = Date.now(), title = `E2E Admin Comic ${stamp}`, slug = `e2e-admin-comic-${stamp}`;

test("admin journey: create a comic and chapter; drafts stay private and cannot be published empty", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/admin/comics/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill("Created by an automated test.");
  await page.getByLabel("Author", { exact: true }).fill("Test Author");
  await page.getByLabel("Artist", { exact: true }).fill("Test Artist");
  await page.getByRole("button", { name: "Create comic" }).click();
  await expect(page.getByText(title)).toBeVisible();

  expect((await page.request.get(`${API}/comics/${slug}`)).status()).toBe(404); // draft is not public

  await page.getByRole("row", { name: new RegExp(title) }).getByRole("link", { name: "Chapters" }).click();
  await page.getByRole("link", { name: "New chapter" }).click();
  await page.getByLabel("Chapter number").fill("1");
  await page.getByLabel("Title").fill("First");
  await page.getByRole("button", { name: /Create draft/ }).click();
  await expect(page.getByRole("button", { name: "Publish chapter" })).toBeDisabled(); // no pages yet
});

// Needs a real S3-compatible bucket with CORS allowing PUT from the web origin. Run with E2E_S3=1.
test("admin journey: upload a page, publish, and the chapter is public", async ({ page }) => {
  test.skip(!process.env.E2E_S3, "set E2E_S3=1 and configure S3_* to run the upload journey");
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/admin/comics");
  await page.getByRole("row", { name: new RegExp(title) }).getByRole("button", { name: "Publish" }).click();
  await page.getByRole("row", { name: new RegExp(title) }).getByRole("link", { name: "Chapters" }).click();
  await page.getByRole("link", { name: "Manage" }).first().click();
  await page.locator('input[type="file"]').first().setInputFiles([{ name: "page1.png", mimeType: "image/png", buffer: PNG }]);
  await expect(page.getByText("Pages uploaded.")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Publish chapter" }).click();
  await expect(page.getByText("Chapter published.")).toBeVisible();
  expect((await page.request.get(`${API}/comics/${slug}`)).status()).toBe(200);
});
