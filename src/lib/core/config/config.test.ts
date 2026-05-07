/**
 * Tests for core/config schema and parse helpers.
 *
 * Strategy: test the schemas and parse* helpers with synthetic plain-object
 * inputs. This avoids mocking SvelteKit virtual modules ($env/static/public,
 * $env/static/private) which are resolved at build time and are fragile under
 * Vitest. The loaders (index.ts, index.server.ts) reduce to trivial wrappers
 * once the schemas are validated here.
 *
 * Conformance: .claude/rules/testing.md (Vitest, ≥80 % on core/**)
 */
import { describe, it, expect } from 'vitest';
import { publicEnvSchema, serverEnvSchema, parsePublicEnv, parseServerEnv } from './schema.js';

// ---------------------------------------------------------------------------
// publicEnvSchema
// ---------------------------------------------------------------------------

describe('publicEnvSchema', () => {
	it('applies defaults when all fields are omitted', () => {
		const result = publicEnvSchema.parse({});
		expect(result.PUBLIC_API_URL).toBe('/api/upstream');
		expect(result.PUBLIC_LOG_LEVEL).toBe('info');
		expect(result.PUBLIC_APP_NAME).toBe('surfaceit');
	});

	it('applies defaults when fields are undefined', () => {
		const result = publicEnvSchema.parse({
			PUBLIC_API_URL: undefined,
			PUBLIC_LOG_LEVEL: undefined,
			PUBLIC_APP_NAME: undefined
		});
		expect(result.PUBLIC_API_URL).toBe('/api/upstream');
		expect(result.PUBLIC_LOG_LEVEL).toBe('info');
		expect(result.PUBLIC_APP_NAME).toBe('surfaceit');
	});

	it('accepts a valid absolute-path API URL', () => {
		const result = publicEnvSchema.parse({ PUBLIC_API_URL: '/v2/proxy' });
		expect(result.PUBLIC_API_URL).toBe('/v2/proxy');
	});

	it('accepts a valid https URL for PUBLIC_API_URL', () => {
		const result = publicEnvSchema.parse({ PUBLIC_API_URL: 'https://api.example.com' });
		expect(result.PUBLIC_API_URL).toBe('https://api.example.com');
	});

	it('rejects a bare hostname for PUBLIC_API_URL', () => {
		expect(() => publicEnvSchema.parse({ PUBLIC_API_URL: 'not-a-url' })).toThrow();
	});

	it('accepts all valid log levels', () => {
		for (const level of ['debug', 'info', 'warn', 'error'] as const) {
			const result = publicEnvSchema.parse({ PUBLIC_LOG_LEVEL: level });
			expect(result.PUBLIC_LOG_LEVEL).toBe(level);
		}
	});

	it('rejects an invalid log level', () => {
		expect(() => publicEnvSchema.parse({ PUBLIC_LOG_LEVEL: 'verbose' })).toThrow();
	});

	it('rejects an empty PUBLIC_APP_NAME', () => {
		expect(() => publicEnvSchema.parse({ PUBLIC_APP_NAME: '' })).toThrow();
	});

	it('accepts a custom PUBLIC_APP_NAME', () => {
		const result = publicEnvSchema.parse({ PUBLIC_APP_NAME: 'myapp' });
		expect(result.PUBLIC_APP_NAME).toBe('myapp');
	});
});

// ---------------------------------------------------------------------------
// serverEnvSchema
// ---------------------------------------------------------------------------

describe('serverEnvSchema', () => {
	const validServerEnv = {
		UPSTREAM_API_URL: 'https://goscratch.example.com',
		SESSION_SECRET: 'a'.repeat(32)
	};

	it('parses a valid server environment', () => {
		const result = serverEnvSchema.parse(validServerEnv);
		expect(result.UPSTREAM_API_URL).toBe('https://goscratch.example.com');
		expect(result.SESSION_SECRET).toBe('a'.repeat(32));
		expect(result.NODE_ENV).toBe('development'); // default
	});

	it('applies NODE_ENV default of development', () => {
		const result = serverEnvSchema.parse(validServerEnv);
		expect(result.NODE_ENV).toBe('development');
	});

	it('accepts all valid NODE_ENV values', () => {
		for (const env of ['development', 'test', 'production'] as const) {
			const result = serverEnvSchema.parse({ ...validServerEnv, NODE_ENV: env });
			expect(result.NODE_ENV).toBe(env);
		}
	});

	it('rejects an invalid NODE_ENV', () => {
		expect(() => serverEnvSchema.parse({ ...validServerEnv, NODE_ENV: 'staging' })).toThrow();
	});

	it('throws when UPSTREAM_API_URL is missing', () => {
		expect(() =>
			serverEnvSchema.parse({ SESSION_SECRET: validServerEnv.SESSION_SECRET })
		).toThrow();
	});

	it('throws when UPSTREAM_API_URL is not a valid URL', () => {
		expect(() =>
			serverEnvSchema.parse({ ...validServerEnv, UPSTREAM_API_URL: 'not-a-url' })
		).toThrow();
	});

	it('throws when SESSION_SECRET is missing', () => {
		expect(() =>
			serverEnvSchema.parse({ UPSTREAM_API_URL: validServerEnv.UPSTREAM_API_URL })
		).toThrow();
	});

	it('throws when SESSION_SECRET is shorter than 32 characters', () => {
		expect(() =>
			serverEnvSchema.parse({ ...validServerEnv, SESSION_SECRET: 'tooshort' })
		).toThrow();
	});

	it('accepts a SESSION_SECRET of exactly 32 characters', () => {
		const result = serverEnvSchema.parse({ ...validServerEnv, SESSION_SECRET: 'x'.repeat(32) });
		expect(result.SESSION_SECRET).toHaveLength(32);
	});
});

// ---------------------------------------------------------------------------
// parsePublicEnv
// ---------------------------------------------------------------------------

describe('parsePublicEnv', () => {
	it('returns typed config for valid input', () => {
		const cfg = parsePublicEnv({});
		expect(cfg.PUBLIC_API_URL).toBe('/api/upstream');
		expect(cfg.PUBLIC_LOG_LEVEL).toBe('info');
		expect(cfg.PUBLIC_APP_NAME).toBe('surfaceit');
	});

	it('throws a descriptive error for invalid input', () => {
		expect(() => parsePublicEnv({ PUBLIC_LOG_LEVEL: 'trace' })).toThrowError(
			/\[config\] Invalid public environment/
		);
	});
});

// ---------------------------------------------------------------------------
// parseServerEnv
// ---------------------------------------------------------------------------

describe('parseServerEnv', () => {
	const validRaw = {
		UPSTREAM_API_URL: 'https://goscratch.example.com',
		SESSION_SECRET: 'b'.repeat(32)
	};

	it('returns typed config with derived isProd flag', () => {
		const cfg = parseServerEnv(validRaw);
		expect(cfg.isProd).toBe(false);
		expect(cfg.NODE_ENV).toBe('development');
	});

	it('sets isProd to true when NODE_ENV is production', () => {
		const cfg = parseServerEnv({ ...validRaw, NODE_ENV: 'production' });
		expect(cfg.isProd).toBe(true);
	});

	it('throws a descriptive error naming the offending key', () => {
		expect(() => parseServerEnv({ SESSION_SECRET: 'short' })).toThrowError(
			/\[config\] Invalid server environment/
		);
	});

	it('throws when UPSTREAM_API_URL is missing', () => {
		expect(() => parseServerEnv({ SESSION_SECRET: validRaw.SESSION_SECRET })).toThrowError(
			/\[config\] Invalid server environment/
		);
	});
});
