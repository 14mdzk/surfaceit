/**
 * Server-only config entry point.
 *
 * Reads from SvelteKit's $env/static/private (never bundled to the client) and
 * parses against serverEnvSchema. Throws at server startup if required values
 * are missing or malformed — fail-fast per security.md.
 *
 * SvelteKit enforces server-only isolation: importing $env/static/private from
 * a client module is a hard build error. Collocating as *.server.ts adds a
 * second layer — the vite plugin refuses to bundle it into client code.
 *
 * Consumers: hooks.server.ts (NODE_ENV), core/auth (SESSION_SECRET,
 * UPSTREAM_API_URL), BFF proxy endpoints.
 *
 * Conformance:
 *   - .claude/rules/security.md      (secrets server-side only, fail-fast)
 *   - .claude/rules/auth-and-session.md (SESSION_SECRET, UPSTREAM_API_URL)
 *   - .claude/rules/architecture.md  (server-only module, core/ layer)
 */
import { UPSTREAM_API_URL, SESSION_SECRET } from '$env/static/private';
import { parseServerEnv } from './schema.js';
import type { DerivedServerEnv } from './schema.js';

export type { DerivedServerEnv };

/**
 * Validated server configuration. Never import this from client modules.
 * Import from `$core/config/index.server.ts` or the alias
 * `$core/config/index.server`.
 *
 * Note: NODE_ENV is read from process.env directly. SvelteKit strips NODE_ENV
 * from $env/static/private by design — it is treated as a special variable and
 * managed by the framework. process.env.NODE_ENV is always available server-side.
 */
export const serverConfig: DerivedServerEnv = parseServerEnv({
	UPSTREAM_API_URL,
	SESSION_SECRET,
	NODE_ENV: process.env.NODE_ENV
});
