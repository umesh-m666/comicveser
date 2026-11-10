export interface SourcesConfig { enabled: boolean; timeoutMs: number; userAgent: string }

const BROWSER_LIKE = /mozilla|chrome|safari|firefox|edge|opera/i;

/**
 * Reads and validates the external-source settings. Off by default.
 * When on, bad settings stop the API at start-up with a clear message instead of failing on a user request.
 */
export function loadSourcesConfig(env: Record<string, string | undefined> = process.env): SourcesConfig {
  const enabled = (env.SOURCES_ENABLED ?? "false").trim().toLowerCase() === "true";
  const web = env.WEB_ORIGIN?.trim() || "http://localhost:3000";
  const cfg: SourcesConfig = {
    enabled,
    timeoutMs: env.SOURCES_TIMEOUT_MS?.trim() ? Number(env.SOURCES_TIMEOUT_MS) : 10_000,
    userAgent: env.SOURCES_USER_AGENT?.trim() || `ComicVerse/1.0 (+${web})`,
  };
  if (!enabled) return cfg;

  const problems: string[] = [];
  if (!Number.isInteger(cfg.timeoutMs) || cfg.timeoutMs < 1000 || cfg.timeoutMs > 60_000) problems.push("SOURCES_TIMEOUT_MS must be a whole number between 1000 and 60000");
  if (cfg.userAgent.length > 200) problems.push("SOURCES_USER_AGENT is too long");
  if (BROWSER_LIKE.test(cfg.userAgent)) problems.push("SOURCES_USER_AGENT must identify your app (for example ComicVerse/1.0), not imitate a browser");
  if (problems.length) throw new Error(`Invalid external source configuration: ${problems.join("; ")}`);
  return cfg;
}

export interface SourceSyncConfig {
  enabled: boolean;
  intervalMinutes: number;
  intervalMs: number;
  batchSize: number;
}

export function loadSourceSyncConfig(env: Record<string, string | undefined> = process.env): SourceSyncConfig {
  const rawEnabled = (env.SOURCE_SYNC_ENABLED ?? "true").trim().toLowerCase();
  const enabled = rawEnabled !== "false" && rawEnabled !== "0" && env.DISABLE_JOBS !== "true";
  const parsedInterval = Number.parseInt((env.SOURCE_SYNC_INTERVAL_MINUTES ?? "30").trim(), 10);
  const intervalMinutes = Number.isFinite(parsedInterval) && parsedInterval >= 1 ? Math.min(parsedInterval, 1440) : 30;
  const parsedBatch = Number.parseInt((env.SOURCE_SYNC_BATCH_SIZE ?? "20").trim(), 10);
  const batchSize = Number.isFinite(parsedBatch) && parsedBatch >= 1 ? Math.min(parsedBatch, 200) : 20;
  return {
    enabled,
    intervalMinutes,
    intervalMs: intervalMinutes * 60_000,
    batchSize,
  };
}
