/** Only allow same-site relative paths as a post-login destination (blocks open redirects such as //evil.com). */
export function safeNext(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (raw === "/login" || raw.startsWith("/login?") || raw.startsWith("/register")) return fallback;
  return raw;
}

export const loginUrl = (next: string, expired = false) =>
  `/login?next=${encodeURIComponent(next)}${expired ? "&expired=1" : ""}`;
