/** WEB_ORIGIN may hold several origins, comma-separated (e.g. the live site plus http://localhost:3001 for local front-end work). */
export function webOrigins(): string[] {
  return (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean);
}
/** The first origin is the primary one, used when building links in emails. */
export const primaryWebOrigin = () => webOrigins()[0];

/** Fails fast in production when required settings are missing, instead of failing later on a user request. */
export function assertProductionConfig() {
  if (process.env.NODE_ENV !== "production") return;
  const missing = ["DATABASE_URL", "WEB_ORIGIN", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].filter((k) => !process.env[k]);
  if (!process.env.MAIL_PROVIDER) missing.push("MAIL_PROVIDER");
  if (process.env.WEB_ORIGIN && !webOrigins().every((o) => o.startsWith("https://") || o.startsWith("http://localhost"))) missing.push("WEB_ORIGIN (must be https, or http://localhost for local testing)");
  if (missing.length) throw new Error(`Missing or invalid production settings: ${missing.join(", ")}`);
}
