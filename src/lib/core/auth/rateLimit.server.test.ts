/**
 * Unit tests for the token-bucket rate limiter.
 *
 * Tests the RateLimiter class directly (not the process singleton) so they
 * can use tight bucket parameters without worrying about shared state.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RateLimiter } from './rateLimit.server.js';

afterEach(() => {
	vi.useRealTimers();
});

describe('RateLimiter.consume', () => {
	it('allows up to capacity requests from a fresh IP', () => {
		const limiter = new RateLimiter({ capacity: 3, refillRate: 0 });
		expect(limiter.consume('1.2.3.4')).toBe(true);
		expect(limiter.consume('1.2.3.4')).toBe(true);
		expect(limiter.consume('1.2.3.4')).toBe(true);
	});

	it('rejects after capacity is exhausted', () => {
		const limiter = new RateLimiter({ capacity: 2, refillRate: 0 });
		limiter.consume('10.0.0.1');
		limiter.consume('10.0.0.1');
		expect(limiter.consume('10.0.0.1')).toBe(false);
	});

	it('does not share buckets between IPs', () => {
		const limiter = new RateLimiter({ capacity: 1, refillRate: 0 });
		limiter.consume('ip-a');
		// ip-a is exhausted
		expect(limiter.consume('ip-a')).toBe(false);
		// ip-b has its own full bucket
		expect(limiter.consume('ip-b')).toBe(true);
	});

	it('refills tokens over time', () => {
		vi.useFakeTimers();
		const limiter = new RateLimiter({ capacity: 2, refillRate: 1 }); // 1 token/s
		limiter.consume('5.5.5.5');
		limiter.consume('5.5.5.5');
		// bucket empty
		expect(limiter.consume('5.5.5.5')).toBe(false);

		// advance 2 seconds — should have 2 tokens refilled
		vi.advanceTimersByTime(2000);
		expect(limiter.consume('5.5.5.5')).toBe(true);
		expect(limiter.consume('5.5.5.5')).toBe(true);
		expect(limiter.consume('5.5.5.5')).toBe(false);
	});

	it('caps tokens at capacity even after a long gap', () => {
		vi.useFakeTimers();
		const limiter = new RateLimiter({ capacity: 3, refillRate: 10 }); // fast refill
		limiter.consume('6.6.6.6');
		// exhaust
		limiter.consume('6.6.6.6');
		limiter.consume('6.6.6.6');

		// advance far — should not exceed capacity=3
		vi.advanceTimersByTime(10_000);
		expect(limiter.consume('6.6.6.6')).toBe(true);
		expect(limiter.consume('6.6.6.6')).toBe(true);
		expect(limiter.consume('6.6.6.6')).toBe(true);
		expect(limiter.consume('6.6.6.6')).toBe(false); // still capped at 3
	});
});

describe('RateLimiter.gc', () => {
	it('removes stale buckets', () => {
		vi.useFakeTimers();
		const limiter = new RateLimiter({ capacity: 5, gcWindowMs: 1000 });
		limiter.consume('7.7.7.7');
		// advance past gc window
		vi.advanceTimersByTime(2000);
		limiter.gc();
		// After GC the bucket is gone; consuming allocates a fresh one at capacity-1
		expect(limiter.consume('7.7.7.7')).toBe(true);
	});

	it('does not remove active buckets', () => {
		vi.useFakeTimers();
		const limiter = new RateLimiter({ capacity: 2, refillRate: 0, gcWindowMs: 5000 });
		limiter.consume('8.8.8.8');
		limiter.consume('8.8.8.8');
		// bucket empty, but recently used — should NOT be GC'd
		limiter.gc();
		expect(limiter.consume('8.8.8.8')).toBe(false);
	});
});
