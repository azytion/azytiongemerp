/**
 * In-memory rate limiter for Next.js server-side use.
 * Uses a sliding window per key (IP or username).
 * Stored on globalThis so it survives HMR in dev mode.
 */

interface RateLimitEntry {
    count: number;
    windowStart: number;
    blocked: boolean;
    blockedUntil: number;
}

type RateLimitStore = Map<string, RateLimitEntry>;

const g = globalThis as typeof globalThis & { __zationRateLimit?: RateLimitStore };
function getStore(): RateLimitStore {
    if (!g.__zationRateLimit) g.__zationRateLimit = new Map();
    return g.__zationRateLimit;
}

export interface RateLimitConfig {
    /** Max requests allowed within `windowMs` */
    limit: number;
    /** Sliding window in milliseconds */
    windowMs: number;
    /** How long to block once limit is exceeded (ms) */
    blockDurationMs: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterMs: number;
}

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
    const store = getStore();
    const now = Date.now();

    let entry = store.get(key);

    // Clear expired block
    if (entry?.blocked && now >= entry.blockedUntil) {
        entry = undefined;
        store.delete(key);
    }

    // Currently blocked
    if (entry?.blocked) {
        return { allowed: false, remaining: 0, retryAfterMs: entry.blockedUntil - now };
    }

    // New window or expired window
    if (!entry || now - entry.windowStart > config.windowMs) {
        entry = { count: 1, windowStart: now, blocked: false, blockedUntil: 0 };
        store.set(key, entry);
        return { allowed: true, remaining: config.limit - 1, retryAfterMs: 0 };
    }

    entry.count++;

    if (entry.count > config.limit) {
        entry.blocked = true;
        entry.blockedUntil = now + config.blockDurationMs;
        store.set(key, entry);
        return { allowed: false, remaining: 0, retryAfterMs: config.blockDurationMs };
    }

    store.set(key, entry);
    return { allowed: true, remaining: config.limit - entry.count, retryAfterMs: 0 };
}

export function resetRateLimit(key: string): void {
    getStore().delete(key);
}

// ── Preset configs ────────────────────────────────────────────────────────────

/** Regular login: 10 attempts per 5 min, then blocked for 15 min */
export const LOGIN_RATE_LIMIT: RateLimitConfig = {
    limit: 10,
    windowMs: 5 * 60 * 1000,
    blockDurationMs: 15 * 60 * 1000,
};

/** Super-admin login: 5 attempts per 10 min, then blocked for 30 min */
export const SUPER_ADMIN_RATE_LIMIT: RateLimitConfig = {
    limit: 5,
    windowMs: 10 * 60 * 1000,
    blockDurationMs: 30 * 60 * 1000,
};

/** API endpoints: 60 requests per min */
export const API_RATE_LIMIT: RateLimitConfig = {
    limit: 60,
    windowMs: 60 * 1000,
    blockDurationMs: 5 * 60 * 1000,
};
