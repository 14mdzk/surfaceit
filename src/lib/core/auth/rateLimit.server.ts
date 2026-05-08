/**
 * Token-bucket rate limiter keyed by IP address.
 *
 * Used to guard auth endpoints against credential stuffing. Each IP is given
 * a bucket of `capacity` tokens refilled at `refillRate` tokens per second.
 * A request that would drain below zero is rejected with a 429 error.
 *
 * This is an in-memory implementation suitable for single-process deployments
 * (dev, staging, small prod). For multi-process deployments, swap the backing
 * map for a Redis INCR + TTL approach without changing the call sites.
 *
 * Conformance:
 *   - rule .claude/rules/security.md (rate-limit auth endpoints in BFF)
 */
import { error, type RequestEvent } from '@sveltejs/kit';

interface Bucket {
	tokens: number;
	lastRefill: number; // unix ms
}

interface RateLimiterOptions {
	/** Maximum tokens per bucket (burst capacity). Default: 20 */
	capacity?: number;
	/** Tokens added per second. Default: 0.5 (one request every 2s steady-state) */
	refillRate?: number;
	/** Window in ms after which an empty bucket is removed (GC). Default: 5 min */
	gcWindowMs?: number;
}

export class RateLimiter {
	private readonly buckets = new Map<string, Bucket>();
	private readonly capacity: number;
	private readonly refillRate: number; // tokens/ms
	private readonly gcWindowMs: number;

	constructor(opts: RateLimiterOptions = {}) {
		this.capacity = opts.capacity ?? 20;
		this.refillRate = (opts.refillRate ?? 0.5) / 1000; // convert to tokens/ms
		this.gcWindowMs = opts.gcWindowMs ?? 5 * 60 * 1000;
	}

	/**
	 * Attempt to consume one token from the IP's bucket.
	 * Returns true if allowed, false if rate-limited.
	 */
	consume(ip: string): boolean {
		const now = Date.now();
		let bucket = this.buckets.get(ip);

		if (!bucket) {
			bucket = { tokens: this.capacity - 1, lastRefill: now };
			this.buckets.set(ip, bucket);
			return true;
		}

		// Refill tokens since last access
		const elapsed = now - bucket.lastRefill;
		bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillRate);
		bucket.lastRefill = now;

		if (bucket.tokens < 1) {
			return false;
		}

		bucket.tokens -= 1;
		return true;
	}

	/**
	 * Remove stale buckets to prevent unbounded memory growth.
	 * Call periodically (e.g. every 5 min) if the limiter is long-lived.
	 */
	gc(): void {
		const cutoff = Date.now() - this.gcWindowMs;
		for (const [ip, bucket] of this.buckets) {
			if (bucket.lastRefill < cutoff) {
				this.buckets.delete(ip);
			}
		}
	}
}

/**
 * Process-level limiter for auth endpoints. 20 burst / 0.5 req·s⁻¹ steady.
 * Generous enough that the e2e suite (all from 127.0.0.1) does not trip it.
 */
const authLimiter = new RateLimiter({ capacity: 20, refillRate: 0.5 });

// Periodic GC — runs every 5 min in the server process.
setInterval(() => authLimiter.gc(), 5 * 60 * 1000).unref?.();

/**
 * Enforce the auth rate limit for the incoming request.
 * Throws a 429 error via SvelteKit's `error()` if the IP is over limit.
 */
export function enforceAuthRateLimit(event: RequestEvent): void {
	const ip = event.getClientAddress();
	if (!authLimiter.consume(ip)) {
		throw error(429, {
			message: 'Too many requests. Please try again later.',
			code: 'RATE_LIMITED'
		});
	}
}

export { authLimiter };
