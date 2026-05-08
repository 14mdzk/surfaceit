/**
 * Unit tests for SSEClient and the context-DI wrappers (`createRealtime`, `getRealtime`).
 *
 * ## Testing strategy
 *
 * SSEClient is tested directly (no context required for most cases). We instantiate
 * it with `new SSEClient(deps)` and inject a `FakeEventSource` that lets us fire
 * events, errors, and open events deterministically.
 *
 * The `createRealtime` / `getRealtime` context wrappers are tested separately via a
 * mocked `svelte` module (same pattern as `core/query/context.test.ts`). The
 * `onDestroy` callback is captured so it can be invoked deterministically in the
 * cleanup test.
 *
 * ## Why direct instantiation instead of only context tests
 *
 * Context tests pay the `vi.mock('svelte', ...)` tax. For the 10 SSEClient behavioural
 * scenarios, testing the class directly is cheaper and clearer. The context mock is
 * reserved for the `getRealtime() outside context throws` scenario.
 *
 * Conformance:
 *   - rule .claude/rules/testing.md (FakeEventSource driver, co-located Vitest)
 *   - rule .claude/rules/state-management.md (factory + getter tested separately)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// FakeEventSource driver
// (mirrors the pattern in testing.md)
// ---------------------------------------------------------------------------

class FakeEventSource extends EventTarget {
	static instances: FakeEventSource[] = [];
	readonly url: string;
	private _closed = false;

	constructor(url: string) {
		super();
		this.url = url;
		FakeEventSource.instances.push(this);
	}

	/** Fire a named SSE event with a JSON-serialised data payload. */
	emit(eventType: string, data: object): void {
		this.dispatchEvent(new MessageEvent(eventType, { data: JSON.stringify(data) }));
	}

	/** Fire an open event (simulates connection established). */
	emitOpen(): void {
		this.dispatchEvent(new Event('open'));
	}

	/** Fire an error event (simulates connection drop). */
	emitError(): void {
		this.dispatchEvent(new Event('error'));
	}

	close(): void {
		this._closed = true;
	}

	get closed(): boolean {
		return this._closed;
	}
}

// Install FakeEventSource globally BEFORE importing the client so the client
// picks up the fake.
globalThis.EventSource = FakeEventSource as unknown as typeof EventSource;

// ---------------------------------------------------------------------------
// Stable fake logger — returned by every getLogger() call in the module.
// Using a stable reference allows throttle tests to assert call counts.
// ---------------------------------------------------------------------------

const fakeLogger = {
	debug: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn()
};

vi.mock('$core/logger/index.js', () => ({
	getLogger: () => fakeLogger
}));

// ---------------------------------------------------------------------------
// Mock svelte (for context tests only)
// ---------------------------------------------------------------------------

const fakeContext = new Map<symbol | string, unknown>();
const capturedOnDestroys: (() => void)[] = [];

vi.mock('svelte', async (importOriginal) => {
	const original = await importOriginal<typeof import('svelte')>();
	return {
		...original,
		setContext: (key: symbol | string, value: unknown) => {
			fakeContext.set(key, value);
		},
		getContext: <T>(key: symbol | string): T => {
			return fakeContext.get(key) as T;
		},
		onDestroy: (fn: () => void) => {
			capturedOnDestroys.push(fn);
		}
	};
});

// Import after mocks are installed.
const { SSEClient } = await import('./client.svelte.js');
const { createRealtime, getRealtime } = await import('./client.svelte.js');
const { CHANNELS } = await import('./channels.js');

const TEST_CHANNELS = [CHANNELS.CAMERA_EVENTS];
const FAKE_CAMERA_EVENT = { id: '1', action: 'added' as const, timestamp: '2026-01-01T00:00:00Z' };

beforeEach(() => {
	FakeEventSource.instances.length = 0;
	fakeContext.clear();
	capturedOnDestroys.length = 0;
	vi.useFakeTimers();
	// Reset stable logger mock so call counts are per-test.
	fakeLogger.debug.mockClear();
	fakeLogger.info.mockClear();
	fakeLogger.warn.mockClear();
	fakeLogger.error.mockClear();
});

afterEach(() => {
	vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Scenario 1: idle → connecting → connected
// ---------------------------------------------------------------------------

describe('SSEClient: idle → connecting → connected', () => {
	it('transitions state correctly when connected', () => {
		const client = new SSEClient({ channels: TEST_CHANNELS });
		expect(client.state).toBe('idle');

		client.connect();
		expect(client.state).toBe('connecting');

		const es = FakeEventSource.instances[0];
		es.emitOpen();
		expect(client.state).toBe('connected');
	});

	it('creates an EventSource with the correct URL including channels query param', () => {
		const client = new SSEClient({ channels: TEST_CHANNELS });
		client.connect();
		const es = FakeEventSource.instances[0];
		expect(es.url).toContain('/api/upstream/realtime');
		expect(es.url).toContain('channels=');
		expect(es.url).toContain('camera.events');
	});

	it('connect() is idempotent when already connected', () => {
		const client = new SSEClient({ channels: TEST_CHANNELS });
		client.connect();
		FakeEventSource.instances[0].emitOpen();
		expect(client.state).toBe('connected');

		client.connect(); // second call
		// Should not open a second EventSource
		expect(FakeEventSource.instances.length).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// Scenario 2: disconnect resets state
// ---------------------------------------------------------------------------

describe('SSEClient: disconnect', () => {
	it('returns to idle after disconnect()', () => {
		const client = new SSEClient({ channels: TEST_CHANNELS });
		client.connect();
		FakeEventSource.instances[0].emitOpen();
		expect(client.state).toBe('connected');

		client.disconnect();
		expect(client.state).toBe('idle');
		expect(client.maxRetriesReached).toBe(false);
	});

	it('closes the underlying EventSource on disconnect', () => {
		const client = new SSEClient({ channels: TEST_CHANNELS });
		client.connect();
		const es = FakeEventSource.instances[0];
		es.emitOpen();

		client.disconnect();
		expect(es.closed).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Scenario 3: named event listener receives parsed payload
// ---------------------------------------------------------------------------

describe('SSEClient: named event listener', () => {
	it('invokes handler with parsed payload on named event', () => {
		const client = new SSEClient({ channels: TEST_CHANNELS });
		client.connect();
		const es = FakeEventSource.instances[0];
		es.emitOpen();

		const received: unknown[] = [];
		client.on('camera.added', (e) => received.push(e));

		es.emit('camera.added', FAKE_CAMERA_EVENT);
		expect(received).toHaveLength(1);
		expect((received[0] as { type: string }).type).toBe('camera.added');
		expect((received[0] as { data: typeof FAKE_CAMERA_EVENT }).data).toEqual(FAKE_CAMERA_EVENT);
	});

	it('on() returns a cleanup function that removes the listener', () => {
		const client = new SSEClient({ channels: TEST_CHANNELS });
		client.connect();
		const es = FakeEventSource.instances[0];
		es.emitOpen();

		const received: unknown[] = [];
		const off = client.on('camera.added', (e) => received.push(e));

		es.emit('camera.added', FAKE_CAMERA_EVENT);
		expect(received).toHaveLength(1);

		off(); // remove the listener
		es.emit('camera.added', FAKE_CAMERA_EVENT);
		expect(received).toHaveLength(1); // still 1 — listener was removed
	});
});

// ---------------------------------------------------------------------------
// Scenario 4: parse failure returns null — handler not called
// ---------------------------------------------------------------------------

describe('SSEClient: parse failure', () => {
	it('does not invoke handler when data is not valid JSON', () => {
		const client = new SSEClient({ channels: TEST_CHANNELS });
		client.connect();
		const es = FakeEventSource.instances[0];
		es.emitOpen();

		const received: unknown[] = [];
		client.on('camera.added', (e) => received.push(e));

		// Dispatch a raw MessageEvent with invalid JSON
		es.dispatchEvent(new MessageEvent('camera.added', { data: 'NOT_JSON' }));

		expect(received).toHaveLength(0);
	});

	it('does not invoke handler when payload fails schema validation', () => {
		const client = new SSEClient({ channels: TEST_CHANNELS });
		client.connect();
		const es = FakeEventSource.instances[0];
		es.emitOpen();

		const received: unknown[] = [];
		client.on('camera.added', (e) => received.push(e));

		// Valid JSON but wrong shape (missing required fields)
		es.dispatchEvent(
			new MessageEvent('camera.added', { data: JSON.stringify({ wrong: 'shape' }) })
		);

		expect(received).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Scenario 5: parse error logging is throttled (once per type per connection)
// ---------------------------------------------------------------------------

describe('SSEClient: parse error throttling', () => {
	it('logs a parse failure exactly once per event type per connection', () => {
		const client = new SSEClient({ channels: TEST_CHANNELS });
		client.connect();
		const es = FakeEventSource.instances[0];
		es.emitOpen();

		const received: unknown[] = [];
		client.on('camera.added', (e) => received.push(e));

		// Fire three bad events of the same type — all dropped, only one log entry.
		es.dispatchEvent(new MessageEvent('camera.added', { data: 'BAD1' }));
		es.dispatchEvent(new MessageEvent('camera.added', { data: 'BAD2' }));
		es.dispatchEvent(new MessageEvent('camera.added', { data: 'BAD3' }));

		expect(received).toHaveLength(0);
		// Logger called exactly once — the throttle gate prevents subsequent log entries.
		expect(fakeLogger.error).toHaveBeenCalledTimes(1);

		// Verify the count does not grow further on a 4th bad event.
		es.dispatchEvent(new MessageEvent('camera.added', { data: 'BAD4' }));
		expect(fakeLogger.error).toHaveBeenCalledTimes(1);
	});

	it('resets throttle on disconnect — new connection can log again', () => {
		const client = new SSEClient({ channels: TEST_CHANNELS });
		client.connect();
		const es = FakeEventSource.instances[0];
		es.emitOpen();

		// Register listener so native EventSource listener is wired and parse runs.
		client.on('camera.added', () => {});

		// First bad event: logged.
		es.dispatchEvent(new MessageEvent('camera.added', { data: 'BAD1' }));
		expect(fakeLogger.error).toHaveBeenCalledTimes(1);

		// Second bad event on same connection: throttled (still 1).
		es.dispatchEvent(new MessageEvent('camera.added', { data: 'BAD2' }));
		expect(fakeLogger.error).toHaveBeenCalledTimes(1);

		// Disconnect resets throttle set.
		client.disconnect();
		fakeLogger.error.mockClear();

		client.connect();
		const es2 = FakeEventSource.instances[1];
		es2.emitOpen();

		// Register listener on new connection so parse runs.
		client.on('camera.added', () => {});

		// New connection — throttle reset. First bad event is logged again.
		es2.dispatchEvent(new MessageEvent('camera.added', { data: 'BAD3' }));
		expect(fakeLogger.error).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// Scenario 6: error → reconnecting (single error)
// ---------------------------------------------------------------------------

describe('SSEClient: error → reconnecting', () => {
	it('transitions to reconnecting on first error', () => {
		const client = new SSEClient({ channels: TEST_CHANNELS });
		client.connect();
		const es = FakeEventSource.instances[0];
		es.emitOpen();
		expect(client.state).toBe('connected');

		es.emitError();
		expect(client.state).toBe('reconnecting');
		expect(client.maxRetriesReached).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Scenario 7: exponential backoff
// ---------------------------------------------------------------------------

describe('SSEClient: exponential backoff', () => {
	it('opens a new EventSource after the backoff timer fires', () => {
		const client = new SSEClient({ channels: TEST_CHANNELS });
		client.connect();
		FakeEventSource.instances[0].emitOpen();
		FakeEventSource.instances[0].emitError();

		expect(client.state).toBe('reconnecting');
		expect(FakeEventSource.instances.length).toBe(1); // not reconnected yet

		// Advance past max possible delay for attempt 1 (1000ms base + 200ms jitter = 1200ms)
		vi.advanceTimersByTime(1_300);

		// A new EventSource should have been opened
		expect(FakeEventSource.instances.length).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// Scenario 8: max retries → terminal error
// ---------------------------------------------------------------------------

describe('SSEClient: max retries terminal error', () => {
	it('enters terminal error state after MAX_RETRIES failures', () => {
		const client = new SSEClient({ channels: TEST_CHANNELS });
		client.connect();

		// Simulate MAX_RETRIES (10) errors by repeatedly: open → error → advance timer → repeat
		for (let i = 0; i < 10; i++) {
			const es = FakeEventSource.instances[FakeEventSource.instances.length - 1];
			es.emitError();
			// Advance past max delay cap + jitter (30_000 + 200 = 30_200ms)
			vi.advanceTimersByTime(31_000);
		}

		// Trigger the 11th error to exhaust the budget
		const lastEs = FakeEventSource.instances[FakeEventSource.instances.length - 1];
		lastEs.emitError();

		expect(client.state).toBe('error');
		expect(client.maxRetriesReached).toBe(true);
	});

	it('does not open any more EventSources after terminal error', () => {
		const client = new SSEClient({ channels: TEST_CHANNELS });
		client.connect();

		for (let i = 0; i < 10; i++) {
			const es = FakeEventSource.instances[FakeEventSource.instances.length - 1];
			es.emitError();
			vi.advanceTimersByTime(31_000);
		}

		const countBeforeTerminal = FakeEventSource.instances.length;
		const lastEs = FakeEventSource.instances[FakeEventSource.instances.length - 1];
		lastEs.emitError(); // exhaust budget

		// Advance time — no new EventSource should be opened
		vi.advanceTimersByTime(60_000);
		expect(FakeEventSource.instances.length).toBe(countBeforeTerminal);
	});
});

// ---------------------------------------------------------------------------
// Scenario 9: onDestroy cleanup (via createRealtime factory)
// ---------------------------------------------------------------------------

describe('createRealtime + onDestroy cleanup', () => {
	it('registers an onDestroy callback that calls disconnect()', () => {
		const client = createRealtime({ channels: TEST_CHANNELS });
		client.connect();
		FakeEventSource.instances[0].emitOpen();
		expect(client.state).toBe('connected');

		// Simulate Svelte calling the onDestroy hook
		expect(capturedOnDestroys.length).toBeGreaterThan(0);
		capturedOnDestroys[capturedOnDestroys.length - 1]();

		expect(client.state).toBe('idle');
	});
});

// ---------------------------------------------------------------------------
// Scenario 10: getRealtime() outside context throws
// ---------------------------------------------------------------------------

describe('getRealtime outside context', () => {
	it('throws a helpful error when no client is in context', () => {
		// fakeContext was cleared in beforeEach
		expect(() => getRealtime()).toThrow(/RealtimeClient not initialized/);
	});

	it('error message mentions createRealtime', () => {
		expect(() => getRealtime()).toThrow(/createRealtime/);
	});

	it('error message mentions +layout.svelte', () => {
		expect(() => getRealtime()).toThrow(/\+layout\.svelte/);
	});
});
