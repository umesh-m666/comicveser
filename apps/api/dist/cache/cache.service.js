"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheModule = exports.CacheService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
/** Redis when REDIS_URL is set, otherwise a small in-process map. Cache failures never break a request. */
let CacheService = class CacheService {
    redis = process.env.REDIS_URL ? new ioredis_1.default(process.env.REDIS_URL, { maxRetriesPerRequest: 1 }) : null;
    mem = new Map();
    constructor() { this.redis?.on("error", () => undefined); }
    async wrap(key, ttlSeconds, load) {
        try {
            const hit = this.redis ? await this.redis.get(key) : this.fromMem(key);
            if (hit)
                return JSON.parse(hit);
        }
        catch { /* fall through to the database */ }
        const value = await load();
        try {
            const s = JSON.stringify(value);
            if (this.redis)
                await this.redis.set(key, s, "EX", ttlSeconds);
            else {
                if (this.mem.size > 500)
                    this.mem.clear();
                this.mem.set(key, { v: s, exp: Date.now() + ttlSeconds * 1000 });
            }
        }
        catch { /* ignore */ }
        return value;
    }
    async delete(key) {
        try {
            if (this.redis)
                await this.redis.del(key);
        }
        catch { /* the key expires normally */ }
        this.mem.delete(key);
    }
    fromMem(key) { const e = this.mem.get(key); return e && e.exp > Date.now() ? e.v : null; }
    async onModuleDestroy() { await this.redis?.quit().catch(() => undefined); }
};
exports.CacheService = CacheService;
exports.CacheService = CacheService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], CacheService);
let CacheModule = class CacheModule {
};
exports.CacheModule = CacheModule;
exports.CacheModule = CacheModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({ providers: [CacheService], exports: [CacheService] })
], CacheModule);
