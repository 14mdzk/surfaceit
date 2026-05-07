/**
 * Zod schemas for the application environment.
 *
 * This module is framework-agnostic: no SvelteKit imports, no $env imports.
 * Both index.ts (public) and index.server.ts (private) parse from their
 * respective $env sources against these schemas.
 *
 * Conformance:
 *   - .claude/rules/security.md   (secrets never in PUBLIC_*, fail-fast on missing)
 *   - .claude/rules/observability.md (PUBLIC_LOG_LEVEL consumed by client logger)
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Accepts an absolute URL (https://…) or an absolute path (/api/upstream).
 * `z.string().url()` rejects bare paths, so we use a union refinement.
 */
const urlOrAbsolutePath = z.string().refine(
	(v) => {
		if (v.startsWith('/')) return true;
		try {
			new URL(v);
			return true;
		} catch {
			return false;
		}
	},
	{ message: 'Must be an absolute URL (https://…) or an absolute path (/…)' }
);

// ---------------------------------------------------------------------------
// Public schema — browser-safe, all keys must carry the PUBLIC_ prefix
// ---------------------------------------------------------------------------

export const publicEnvSchema = z.object({
	/** Base URL or path for the same-origin BFF proxy. */
	PUBLIC_API_URL: urlOrAbsolutePath.default('/api/upstream'),

	/** Minimum log level for the client-side logger. */
	PUBLIC_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

	/** Human-readable app name (used in page titles, meta). */
	PUBLIC_APP_NAME: z.string().min(1).default('surfaceit')
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

// ---------------------------------------------------------------------------
// Server schema — private keys, never prefixed PUBLIC_
// ---------------------------------------------------------------------------

export const serverEnvSchema = z.object({
	/**
	 * URL for the goscratch upstream backend. Required — the BFF cannot proxy
	 * without it.
	 */
	UPSTREAM_API_URL: z
		.string({ error: 'UPSTREAM_API_URL is required' })
		.url('UPSTREAM_API_URL must be a valid absolute URL'),

	/**
	 * Secret used to sign session cookies. Must be at least 32 characters.
	 * Generate with: openssl rand -hex 32
	 */
	SESSION_SECRET: z
		.string({ error: 'SESSION_SECRET is required' })
		.min(32, 'SESSION_SECRET must be at least 32 characters'),

	/** Node runtime environment. Controls HSTS, debug logging, etc. */
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development')
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

export interface DerivedServerEnv extends ServerEnv {
	/** true when NODE_ENV === 'production' */
	isProd: boolean;
}

export function parsePublicEnv(raw: Record<string, string | undefined>): PublicEnv {
	const result = publicEnvSchema.safeParse(raw);
	if (!result.success) {
		const message = z.prettifyError(result.error);
		throw new Error(`[config] Invalid public environment:\n${message}`);
	}
	return result.data;
}

export function parseServerEnv(raw: Record<string, string | undefined>): DerivedServerEnv {
	const result = serverEnvSchema.safeParse(raw);
	if (!result.success) {
		const message = z.prettifyError(result.error);
		throw new Error(`[config] Invalid server environment:\n${message}`);
	}
	return { ...result.data, isProd: result.data.NODE_ENV === 'production' };
}
