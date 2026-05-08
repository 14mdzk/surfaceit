/**
 * Public barrel for core/auth.
 *
 * Server-route consumption only. Import from `$core/auth` (or
 * `$core/auth/index`) in server-only files: hooks.server.ts, +server.ts,
 * +page.server.ts, +layout.server.ts.
 *
 * Conformance:
 *   - rule .claude/rules/architecture.md (core layer, server-only modules)
 *   - rule .claude/rules/auth-and-session.md (session lifecycle centralized here)
 */

// Session store and types
export {
	sessionStore,
	createSession,
	destroySession,
	toLocals,
	generateSid,
	type SessionUser,
	type SessionRecord,
	type SessionLocals,
	type SessionStore
} from './session.server.js';

// Cookie helpers
export { setSidCookie, setCsrfCookie, clearAuthCookies } from './cookies.server.js';

// CSRF validation
export { validateCsrf } from './csrf.server.js';

// Rate limiting
export { enforceAuthRateLimit, authLimiter, RateLimiter } from './rateLimit.server.js';

// Refresh coalescer
export { transparentRefresh, isNearExpiry } from './refresh.server.js';
