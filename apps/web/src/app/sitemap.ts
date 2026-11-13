import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://comicverse.app").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    "",
    "/browse",
    "/manga",
    "/sources",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    "/copyright-policy",
    "/login",
    "/register",
  ];
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "" || route === "/browse" || route === "/manga" ? "hourly" : "weekly",
    priority: route === "" ? 1.0 : route === "/browse" || route === "/manga" ? 0.9 : 0.6,
  }));
}
