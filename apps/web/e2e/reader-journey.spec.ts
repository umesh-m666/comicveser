import { expect, test } from "@playwright/test";
import { login, stubImages } from "./fixtures";

test("reader journey: register, log in, browse, read, bookmark, leave, return and continue", async ({ page }) => {
  await stubImages(page);
  const stamp = Date.now(), username = `reader${stamp}`, email = `reader-${stamp}@example.com`, password = "a-long-test-password";

  await page.goto("/register");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (10+ characters)").fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Account created")).toBeVisible();

  await login(page, email, password);
  await expect(page.getByRole("link", { name: username })).toBeVisible();

  await page.goto("/browse");
  await page.getByRole("link", { name: /E2E Test Comic/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "E2E Test Comic" })).toBeVisible();

  await page.getByRole("link", { name: "Start reading" }).click();
  await expect(page).toHaveURL(/chapter\/e2e-chapter-0001/);
  await expect(page.getByAltText("Page 1")).toBeVisible();

  const saved = page.waitForResponse((r) => r.url().endsWith("/user/progress") && r.request().method() === "POST");
  await page.getByAltText("Page 3").scrollIntoViewIfNeeded();
  await expect(page.getByText("Page 3 / 3")).toBeVisible();
  expect((await saved).status()).toBe(204); // progress is saved after a pause, not on every scroll

  await page.getByRole("link", { name: "Back to comic" }).click();
  await page.getByRole("button", { name: "Bookmark", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bookmarked" })).toBeVisible();

  await page.goto("/");
  await page.goto("/comics/e2e-test-comic");
  await page.getByRole("link", { name: /Continue reading/ }).click();
  await expect(page).toHaveURL(/chapter\/e2e-chapter-0001/);
  await expect(page.getByText("Page 3 / 3")).toBeVisible({ timeout: 15_000 }); // position restored

  await page.goto("/profile/bookmarks");
  await expect(page.getByText("E2E Test Comic")).toBeVisible();
});
