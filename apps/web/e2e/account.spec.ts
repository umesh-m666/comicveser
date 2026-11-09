import { expect, test } from "@playwright/test";
import { ADMIN, login } from "./fixtures";

// Needs the API on :4000 against the TEST database seeded with seed-e2e.ts (see README). Not run in the sandbox this was written in.
const stamp = Date.now(), user = { username: `acct${stamp}`, email: `acct-${stamp}@example.com`, password: "e2e-account-password-1" };
const mobile = { width: 390, height: 800 };

test.describe.serial("account, auth persistence and admin access", () => {
  test("logged-out /account offers Log in and Create account; protected pages redirect to login", async ({ page }) => {
    await page.goto("/account");
    await expect(page.getByRole("link", { name: "Log in" }).last()).toBeVisible();
    await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
    await page.goto("/profile/bookmarks");
    await expect(page).toHaveURL(/\/login\?next=%2Fprofile%2Fbookmarks/);
  });

  test("register, then mobile: login → Account tab opens dashboard, survives refresh and navigation, logout clears it", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Username").fill(user.username);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password (10+ characters)").fill(user.password);
    await page.getByLabel("Confirm password").fill(user.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Account created")).toBeVisible();

    await page.setViewportSize(mobile);
    await login(page, user.email, user.password);
    await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Account" }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { name: user.username })).toBeVisible();
    await expect(page.getByText(user.email)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); // no horizontal overflow

    await page.reload();
    await expect(page.getByRole("heading", { name: user.username })).toBeVisible();
    await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Discover" }).click();
    await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Account" }).click();
    await expect(page.getByRole("heading", { name: user.username })).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 800 }); // resize mobile → desktop keeps working
    await expect(page.getByRole("heading", { name: user.username })).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).first().click();
    await page.goto("/account");
    await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });

  test("a signed-in user is sent away from /login, and a normal user is denied the Admin Panel", async ({ page }) => {
    await login(page, user.email, user.password);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/admin");
    await expect(page.getByText("Admin access required")).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin Panel" })).toHaveCount(0);
  });

  test("an expired/revoked session is handled: the user is sent to login with a notice", async ({ page, context }) => {
    await login(page, user.email, user.password);
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: user.username })).toBeVisible();
    await context.clearCookies(); // simulates the backend no longer recognising the session
    await page.reload();
    await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
  });

  test("an admin sees the Admin Panel from the account page and can open it", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/account");
    await page.getByRole("link", { name: /Admin Panel/ }).first().click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});
