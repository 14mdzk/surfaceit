/**
 * Realtime event Zod schemas and the boundary parser.
 *
 * Every message received from the SSE stream is untrusted JSON. `parseRealtimeEvent`
 * is the single entry point: JSON.parse → schema lookup → Zod parse → typed data.
 *
 * Parse errors are logged at most once per event type per connection to prevent
 * log spam when an upstream contract violation affects every message of a given
 * type. The throttle set is reset when the SSEClient disconnects.
 *
 * If the event type is unknown (no schema registered), the raw string data is
 * returned as-is. Consumers that care about a specific type should register a
 * schema and type-check the result.
 *
 * Conformance:
 *   - rule .claude/rules/realtime.md (deserialize and validate inbound payloads)
 *   - rule .claude/rules/api-contract.md (Zod parsers at trust boundaries)
 *   - rule .claude/rules/observability.md (log parse errors, never swallow)
 */
import { z } from 'zod';
import type { AppLogger } from '$core/logger/index.js';

// ---------------------------------------------------------------------------
// Per-channel event schemas
// ---------------------------------------------------------------------------

/** `camera.events` — lifecycle events: camera added, removed, or updated. */
const cameraEventSchema = z.object({
	id: z.string(),
	action: z.enum(['added', 'removed', 'updated']),
	timestamp: z.string()
});

/** `camera.health` — periodic heartbeat with camera health status. */
const cameraHealthSchema = z.object({
	id: z.string(),
	status: z.enum(['online', 'offline', 'degraded']),
	timestamp: z.string()
});

// ---------------------------------------------------------------------------
// Schema registry
// ---------------------------------------------------------------------------

/**
 * Maps event-type strings to their Zod schemas.
 * Add a new entry here when wiring a new channel event.
 */
const EVENT_SCHEMAS: Record<string, z.ZodTypeAny> = {
	'camera.added': cameraEventSchema,
	'camera.removed': cameraEventSchema,
	'camera.updated': cameraEventSchema,
	'camera.health': cameraHealthSchema
};

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type CameraEvent = z.infer<typeof cameraEventSchema>;
export type CameraHealth = z.infer<typeof cameraHealthSchema>;

/** The typed payload returned by `parseRealtimeEvent`. */
export type ParsedRealtimeEvent =
	| { type: 'camera.added'; data: CameraEvent }
	| { type: 'camera.removed'; data: CameraEvent }
	| { type: 'camera.updated'; data: CameraEvent }
	| { type: 'camera.health'; data: CameraHealth }
	| { type: string; data: unknown };

// ---------------------------------------------------------------------------
// Boundary parser
// ---------------------------------------------------------------------------

/**
 * Parse an SSE message at the trust boundary.
 *
 * @param eventType - The SSE `event:` field value (or `'message'` for anonymous).
 * @param rawData   - The SSE `data:` field value (raw string).
 * @param logger    - Logger used to report parse failures (once per type per connection).
 * @param loggedTypes - Mutable set tracking which event types have already logged a
 *   parse failure this connection. The SSEClient resets this set on disconnect.
 * @returns The typed parsed event, or `null` when parsing fails.
 */
export function parseRealtimeEvent(
	eventType: string,
	rawData: string,
	logger: AppLogger,
	loggedTypes: Set<string>
): ParsedRealtimeEvent | null {
	// Step 1: JSON.parse
	let json: unknown;
	try {
		json = JSON.parse(rawData);
	} catch {
		if (!loggedTypes.has(eventType)) {
			loggedTypes.add(eventType);
			logger.error(
				{ eventType, rawData: rawData.slice(0, 200) },
				'realtime: SSE message is not valid JSON'
			);
		}
		return null;
	}

	// Step 2: schema lookup
	const schema = EVENT_SCHEMAS[eventType];
	if (!schema) {
		// Unknown event type — return raw with `data: unknown` so consumers can
		// decide how to handle it. Do not log: new upstream events land before the
		// schema is registered during iterative development.
		return { type: eventType, data: json };
	}

	// Step 3: Zod parse
	const result = schema.safeParse(json);
	if (!result.success) {
		if (!loggedTypes.has(eventType)) {
			loggedTypes.add(eventType);
			logger.error(
				{ eventType, issues: result.error.issues },
				'realtime: SSE payload failed schema validation'
			);
		}
		return null;
	}

	return { type: eventType, data: result.data } as ParsedRealtimeEvent;
}
