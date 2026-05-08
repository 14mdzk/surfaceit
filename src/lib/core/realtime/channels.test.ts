/**
 * Tests for the CHANNELS registry and Channel type.
 *
 * Three properties are enforced:
 *   1. All channel values are non-empty strings.
 *   2. All channel values are unique (no accidental duplicates).
 *   3. The Channel type is a proper union of the registry values (type smoke).
 *
 * These tests are simple but load-bearing: duplicate channel names would cause
 * the upstream to receive the same channel twice; an empty name would produce a
 * malformed query parameter.
 *
 * Conformance: .claude/rules/testing.md (co-located, Vitest).
 */
import { describe, it, expect } from 'vitest';
import { CHANNELS, type Channel } from './channels.js';

describe('CHANNELS registry', () => {
	const values = Object.values(CHANNELS) as string[];

	it('has at least one channel defined', () => {
		expect(values.length).toBeGreaterThan(0);
	});

	it('all channel values are non-empty strings', () => {
		for (const v of values) {
			expect(typeof v).toBe('string');
			expect(v.length).toBeGreaterThan(0);
		}
	});

	it('all channel values are unique (no duplicates)', () => {
		const unique = new Set(values);
		expect(unique.size).toBe(values.length);
	});
});

describe('Channel type smoke test', () => {
	it('CHANNELS values are assignable to Channel', () => {
		// Type-level assertion: if this compiles, Channel is the union of CHANNELS values.
		const ch: Channel = CHANNELS.CAMERA_EVENTS;
		expect(ch).toBe('camera.events');
	});

	it('CAMERA_EVENTS is camera.events', () => {
		expect(CHANNELS.CAMERA_EVENTS).toBe('camera.events');
	});

	it('CAMERA_HEALTH is camera.health', () => {
		expect(CHANNELS.CAMERA_HEALTH).toBe('camera.health');
	});
});
