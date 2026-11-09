import { Global, Injectable, Module, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

/** Redis when REDIS_URL is set, otherwise a small in-process map. Cache failures never break a request. */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 }) : null;
  private mem = new Map<string, { v: string; exp: number }>();
  constructor() { this.redis?.on("error", () => undefined); }

  async wrap<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    try {
      const hit = this.redis ? await this.redis.get(key) : this.fromMem(key);
      if (hit) return JSON.parse(hit) as T;
    } catch { /* fall through to the database */ }
    const value = await load();
    try {
      const s = JSON.stringify(value);
      if (this.redis) await this.redis.set(key, s, "EX", ttlSeconds);
      else { if (this.mem.size > 500) this.mem.clear(); this.mem.set(key, { v: s, exp: Date.now() + ttlSeconds * 1000 }); }
    } catch { /* ignore */ }
    return value;
  }
  async delete(key: string) {
    try { if (this.redis) await this.redis.del(key); } catch { /* the key expires normally */ }
    this.mem.delete(key);
  }
  private fromMem(key: string) { const e = this.mem.get(key); return e && e.exp > Date.now() ? e.v : null; }
  async onModuleDestroy() { await this.redis?.quit().catch(() => undefined); }
}
@Global() @Module({ providers: [CacheService], exports: [CacheService] })
export class CacheModule {}
