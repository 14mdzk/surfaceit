// See https://svelte.dev/docs/kit/types#app.d.ts for these interfaces.

/**
 * App-level type declarations.
 *
 * Conformance:
 *   - rule .claude/rules/auth-and-session.md (locals.session shape)
 *   - rule .claude/rules/observability.md (requestId on locals)
 *   - rule .claude/rules/i18n.md (locale resolved server-side)
 */

/**
 * Server-held session record. The browser only ever sees the opaque `sid`
 * cookie; tokens stay on the server (see ADR 0003).
 */
export interface Session {
	user: { id: string; email: string };
	role: string;
	accessToken: string;
	expiresAt: number;
}

declare global {
	namespace App {
		/** Sanitized error returned from `handleError` and rendered by `+error.svelte`. */
		interface Error {
			message: string;
			code: string;
			requestId?: string;
		}

		interface Locals {
			/** Per-request id, generated in hooks.server.ts. Echoed as `x-request-id`. */
			requestId: string;
			/**
			 * Session populated from the `sid` cookie. Always `null` in Phase 1 —
			 * the real session resolver lands in Phase 3 (see ADR 0003).
			 */
			session: Session | null;
			/** Locale resolved by Paraglide for this request. */
			locale: string;
		}

		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
