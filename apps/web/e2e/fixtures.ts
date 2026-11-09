import type { Page } from "@playwright/test";

// 1x1 PNG. The API is started with CDN_BASE_URL=http://e2e.invalid, so every page image is served from here instead of real storage.
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
export const API = process.env.E2E_API_URL ?? "http://localhost:4000/api";
export const ADMIN = { email: "admin-e2e@example.com", password: "e2e-admin-password-1" };

export const stubImages = (page: Page) => page.route("http://e2e.invalid/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}
