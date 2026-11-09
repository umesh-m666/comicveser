export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export const UNAUTHORIZED_EVENT = "cv:unauthorized";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: string[]) { super(message); }
}

// In the browser we call API (a full URL, or a relative "/api" when the web host proxies to the backend).
// During server-side rendering a relative URL cannot be fetched, so API_INTERNAL_URL (the real backend URL) is used instead.
const serverBase = () => (typeof window === "undefined" && process.env.API_INTERNAL_URL ? process.env.API_INTERNAL_URL : API);

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(serverBase() + path, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // Tell the AuthProvider a request was rejected as unauthenticated so it can re-verify the session with the backend
    // (a wrong password also returns 401, so the provider confirms via /auth/me before it signs anyone out).
    if (res.status === 401 && path !== "/auth/me" && typeof window !== "undefined") window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(res.status, body?.error?.message ?? "Request failed.", body?.error?.details);
  }
  return body as T;
}
