/**
 * SSE realtime client with context-DI, reconnect state machine, and Zod
 * parse-at-boundary.
 *
 * ## Architecture
 *
 * The client is a class with `$state` rune fields for reactive UI consumption.
 * `createRealtime` is the context-DI factory; `getRealtime` is the getter.
 * The layout that calls `createRealtime` owns the client's lifetime — Svelte's
 * `onDestroy` hook fires `disconnect()` automatically.
 *
 * ## Channel URL
 *
 * The BFF endpoint is `/api/upstream/realtime?channels=a,b`. Channels are joined
 * as a comma-separated query parameter inside the `_buildUrl` method. This is the
 * **single place** that encodes the upstream contract assumption: the upstream
 * reads `?channels=<comma-separated-list>`. If the upstream changes to a different
 * shape (one endpoint per channel, subscribe-message protocol, etc.), only
 * `_buildUrl` needs to change — callers are insulated. See api-contract.md
 * "hide the quirk inside the path/URL builder".
 *
 * ## Channel set lifetime
 *
 * The channel set is fixed for the lifetime of the layout that owns this client.
 * Dynamic subscribe/unsubscribe is deferred to a future `setChannels(...)` method
 * that would close and reopen the connection. If a product needs runtime-mutable
 * channels before that ships, file a follow-up task against Wave-3.
 * TODO(sora): add setChannels() when Wave-3 first domain requires dynamic channels.
 *
 * ## Reconnect state machine
 *
 * States: idle → connecting → connected → (error → reconnecting)* → error
 *
 * `maxRetriesReached = true` is set in addition to `state = 'error'` when the
 * retry budget is exhausted. The two fields exist for Wave-2 ergonomics; a Wave-3
 * hardening pass may collapse them into a single `'failed'` terminal state for
 * cleaner banner consumption.
 * TODO(sora): consider collapsing state + maxRetriesReached into a discriminated
 * union terminal state in Wave-3.
 *
 * ## Security
 *
 * The BFF URL is same-origin. No token reaches the browser; the BFF injects the
 * Authorization: Bearer header server-side before forwarding to upstream.
 * Rule: .claude/rules/realtime.md, .claude/rules/auth-and-session.md.
 *
 * ## Conformance
 *   - rule .claude/rules/realtime.md
 *   - rule .claude/rules/state-management.md (factory + Symbol key, no singleton)
 *   - rule .claude/rules/auth-and-session.md (no token in browser)
 *   - ADR docs/decisions/0001-svelte5-context-di.md
 */
import { getContext, onDestroy, setContext } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { getLogger } from '$core/logger/index.js';
import { parseRealtimeEvent, type ParsedRealtimeEvent } from './parsers.js';
import type { Channel } from './channels.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** BFF path that forwards SSE connections to upstream with Bearer injected. */
const BFF_REALTIME_PATH = '/api/upstream/realtime';

/** Reconnect backoff: base delay in ms. */
const BACKOFF_BASE_MS = 1_000;
/** Reconnect backoff: maximum delay cap in ms. */
const BACKOFF_CAP_MS = 30_000;
/** Random jitter ceiling in ms added to each backoff interval. */
const BACKOFF_JITTER_MS = 200;
/** Maximum number of reconnect attempts before entering terminal error. */
const MAX_RETRIES = 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RealtimeState = 'idle' | 'connecting' | 'connected' | 'error' | 'reconnecting';

/** Callback invoked for each parsed realtime event. */
export type RealtimeEventHandler = (event: ParsedRealtimeEvent) => void;

export interface RealtimeDeps {
	/** The channels to subscribe to. Fixed for the lifetime of this client. */
	channels: Channel[];
}

// ---------------------------------------------------------------------------
// SSEClient class
// ---------------------------------------------------------------------------

export class SSEClient {
	/** Current connection state. Reactive — consumed by components as `client.state`. */
	state = $state<RealtimeState>('idle');

	/**
	 * True when all retry attempts have been exhausted.
	 * Consumers can render a "reconnection failed" banner when this is true.
	 */
	maxRetriesReached = $state(false);

	private readonly channels: Channel[];
	private es: EventSource | null = null;
	private retryCount = 0;
	private retryTimer: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Per-connection set tracking event types that have already logged a parse
	 * failure. Prevents log spam when a contract violation affects every message
	 * of a given type. Reset on disconnect.
	 *
	 * SvelteSet used to satisfy svelte/prefer-svelte-reactivity in .svelte.ts
	 * files. This field is not reactive state, but SvelteSet extends Set so
	 * the semantics are identical.
	 */
	private loggedParseErrorTypes = new SvelteSet<string>();

	/**
	 * Registered event listeners. Keyed by event type.
	 *
	 * SvelteMap used to satisfy svelte/prefer-svelte-reactivity. Not reactive
	 * state — internal bookkeeping only. SvelteMap extends Map; semantics are
	 * identical.
	 */
	private listeners = new SvelteMap<string, SvelteSet<RealtimeEventHandler>>();

	private readonly logger = getLogger();

	constructor(deps: RealtimeDeps) {
		this.channels = deps.channels;
	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/**
	 * Open the SSE connection.
	 *
	 * Idempotent: calling `connect()` on an already-connected client is a no-op.
	 * The layout's `createRealtime` factory calls this automatically.
	 */
	connect(): void {
		if (this.state === 'connected' || this.state === 'connecting') return;
		this._open();
	}

	/**
	 * Close the SSE connection and reset state to `'idle'`.
	 * Called automatically by the `onDestroy` hook registered in `createRealtime`.
	 */
	disconnect(): void {
		this._cancelRetry();
		this._closeEventSource();
		this.loggedParseErrorTypes.clear();
		this.retryCount = 0;
		this.state = 'idle';
		this.maxRetriesReached = false;
	}

	/**
	 * Register a listener for a named SSE event.
	 *
	 * The `handler` receives typed `ParsedRealtimeEvent` objects after Zod
	 * parsing. Handlers are invoked synchronously within the SSE `message`
	 * callback.
	 *
	 * @param eventType - The SSE `event:` field name (e.g. `'camera.added'`).
	 * @param handler   - Callback invoked with each parsed event of this type.
	 * @returns A cleanup function that removes the listener.
	 *
	 * @example
	 * ```ts
	 * const rt = getRealtime()
	 * const off = rt.on('camera.added', (e) => queryClient.invalidateQueries(...))
	 * onDestroy(off)
	 * ```
	 */
	on(eventType: string, handler: RealtimeEventHandler): () => void {
		if (!this.listeners.has(eventType)) {
			this.listeners.set(eventType, new SvelteSet());
			// Register native EventSource listener if already connected.
			if (this.es) {
				this._addNativeListener(eventType);
			}
		}
		this.listeners.get(eventType)!.add(handler); // non-null: we just ensured the key
		return () => {
			this.listeners.get(eventType)?.delete(handler);
		};
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	private _buildUrl(): string {
		// Channel names are joined as a comma-separated query parameter.
		// This encodes the upstream contract assumption: upstream reads ?channels=a,b.
		// Changing the upstream contract means changing this single method only.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- created locally and immediately serialized; never assigned to reactive state
		const params = new URLSearchParams({ channels: this.channels.join(',') });
		return `${BFF_REALTIME_PATH}?${params}`;
	}

	private _open(): void {
		this.state = 'connecting';
		const url = this._buildUrl();

		// Native EventSource auto-reconnect disabled: we manage reconnect manually
		// with exponential backoff + jitter + max-retries budget.
		this.es = new EventSource(url);

		this.es.addEventListener('open', () => {
			this.retryCount = 0;
			this.state = 'connected';
			this.logger.info({ channels: this.channels }, 'realtime: SSE connected');
		});

		this.es.addEventListener('error', () => {
			// Close immediately — native EventSource auto-reconnect is disabled by
			// closing here. We schedule our own backoff reconnect below.
			this._closeEventSource();

			if (this.state === 'error' && this.maxRetriesReached) {
				// Already in terminal error — do not attempt further reconnects.
				return;
			}

			this.retryCount += 1;

			if (this.retryCount > MAX_RETRIES) {
				this.state = 'error';
				this.maxRetriesReached = true;
				this.logger.error(
					{ channels: this.channels, retryCount: this.retryCount },
					'realtime: SSE max retries reached; connection abandoned'
				);
				return;
			}

			const delay = this._backoffDelay(this.retryCount);
			this.state = 'reconnecting';
			this.logger.warn(
				{ channels: this.channels, retryCount: this.retryCount, delayMs: delay },
				'realtime: SSE error; scheduling reconnect'
			);

			this.retryTimer = setTimeout(() => {
				this.retryTimer = null;
				this._open();
			}, delay);
		});

		// Register named listeners on the new EventSource.
		for (const eventType of this.listeners.keys()) {
			this._addNativeListener(eventType);
		}
	}

	private _addNativeListener(eventType: string): void {
		if (!this.es) return;
		this.es.addEventListener(eventType, (e: MessageEvent) => {
			const parsed = parseRealtimeEvent(
				eventType,
				e.data as string,
				this.logger,
				this.loggedParseErrorTypes
			);
			if (!parsed) return;

			const handlers = this.listeners.get(eventType);
			if (!handlers) return;
			for (const h of handlers) {
				h(parsed);
			}
		});
	}

	private _closeEventSource(): void {
		if (this.es) {
			this.es.close();
			this.es = null;
		}
	}

	private _cancelRetry(): void {
		if (this.retryTimer !== null) {
			clearTimeout(this.retryTimer);
			this.retryTimer = null;
		}
	}

	/**
	 * Exponential backoff with jitter.
	 *
	 * delay(n) = min(base * 2^(n-1), cap) + random(0, jitter)
	 */
	private _backoffDelay(attempt: number): number {
		const exponential = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
		const capped = Math.min(exponential, BACKOFF_CAP_MS);
		const jitter = Math.random() * BACKOFF_JITTER_MS;
		return Math.floor(capped + jitter);
	}
}

// ---------------------------------------------------------------------------
// Context-DI wiring
// ---------------------------------------------------------------------------

const KEY = Symbol('realtime');

/**
 * Create a realtime SSE client, store it in Svelte context, and return it.
 *
 * Call **once** from the layout that owns the connection lifetime. The client
 * will be disconnected automatically via `onDestroy` when the layout is
 * destroyed.
 *
 * The channel set is fixed for the lifetime of this layout. If a future product
 * feature requires runtime-mutable channels, a `setChannels()` method will be
 * added to the client that closes and reopens the connection. Until then,
 * instantiate a separate client (in a deeper layout) for a different channel set.
 *
 * @example
 * ```svelte
 * <!-- src/routes/(app)/+layout.svelte -->
 * <script lang="ts">
 *   import { createRealtime } from '$core/realtime'
 *   import { CHANNELS } from '$core/realtime/channels'
 *
 *   const rt = createRealtime({ channels: [CHANNELS.CAMERA_EVENTS, CHANNELS.CAMERA_HEALTH] })
 *   rt.connect()
 * </script>
 * ```
 */
export function createRealtime(deps: RealtimeDeps): SSEClient {
	const client = new SSEClient(deps);
	setContext(KEY, client);
	onDestroy(() => client.disconnect());
	return client;
}

/**
 * Retrieve the realtime client from Svelte context.
 *
 * Must be called inside a component or store that has `createRealtime` in an
 * ancestor layout.
 *
 * @throws {Error} when called outside an initialized context.
 */
export function getRealtime(): SSEClient {
	const client = getContext<SSEClient | undefined>(KEY);
	if (!client) {
		throw new Error(
			'RealtimeClient not initialized. Call createRealtime() in a parent +layout.svelte before calling getRealtime().'
		);
	}
	return client;
}
