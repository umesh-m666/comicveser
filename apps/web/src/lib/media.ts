import { API } from "./api";

/** Cover URLs from the API are absolute (CDN / external source) or relative to the API host (local uploads). */
export const coverSrc = (u: string | null | undefined) => (u ? (/^https?:\/\//i.test(u) ? u : `${API}${u}`) : null);
/** Stable placeholder hue for a comic, used when it has no cover image. */
export const hueOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
