/**
 * Realtime channel constants.
 *
 * Every channel name used by the SSE client MUST be declared here. Consumers
 * must import channel names from this module; no raw string literals outside
 * this file.
 *
 * When the upstream adds a new event channel, add it here first, then wire
 * the per-domain invalidator. That path ensures:
 *   - channel names are unique and non-empty (enforced by the const map shape)
 *   - TypeScript propagates the correct literal union everywhere
 *   - the URL builder in SSEClient uses the constant, never an inline string
 *
 * Conformance:
 *   - rule .claude/rules/realtime.md (channel names as constants, never string literals)
 */

/**
 * Master channel registry.
 *
 * Add every SSE channel the product streams here. The value is the wire name
 * sent to the upstream in the `channels` query parameter.
 *
 * Example:
 * ```ts
 * import { CHANNELS } from '$core/realtime/channels'
 * createRealtime({ channels: [CHANNELS.CAMERA_EVENTS, CHANNELS.CAMERA_HEALTH] })
 * ```
 */
export const CHANNELS = {
	/**
	 * Camera lifecycle events: added, removed, updated.
	 * Used by the camera-list invalidator.
	 */
	CAMERA_EVENTS: 'camera.events',

	/**
	 * Camera health-check heartbeats.
	 * Used by the camera-detail invalidator for surgical cache updates.
	 */
	CAMERA_HEALTH: 'camera.health'
} as const;

/** Union of all valid channel wire names. */
export type Channel = (typeof CHANNELS)[keyof typeof CHANNELS];
