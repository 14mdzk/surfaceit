/**
 * Public config entry point — browser-safe.
 *
 * Reads from SvelteKit's $env/static/public (tree-shaken, no runtime overhead)
 * and parses against publicEnvSchema. Throws at startup if values are invalid.
 *
 * Consumers: core/logger (PUBLIC_LOG_LEVEL), core/api (PUBLIC_API_URL),
 * any component that needs PUBLIC_APP_NAME.
 *
 * Conformance:
 *   - .claude/rules/security.md   (no private keys here)
 *   - .claude/rules/observability.md (PUBLIC_LOG_LEVEL)
 *   - .claude/rules/architecture.md (core/ layer, browser-safe)
 */
import { PUBLIC_API_URL, PUBLIC_LOG_LEVEL, PUBLIC_APP_NAME } from '$env/static/public';
import { parsePublicEnv } from './schema.js';
import type { PublicEnv } from './schema.js';

export type { PublicEnv };

/**
 * Validated public configuration. Safe to import from any module, including
 * client-side Svelte components.
 */
export const publicConfig: PublicEnv = parsePublicEnv({
	PUBLIC_API_URL,
	PUBLIC_LOG_LEVEL,
	PUBLIC_APP_NAME
});
