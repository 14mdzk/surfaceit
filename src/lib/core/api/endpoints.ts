/**
 * Typed endpoint registry.
 *
 * Every upstream call is declared here. `api()` in `core-fetch.ts` consumes
 * the registry; call sites receive exact return types without casts.
 *
 * Conformance:
 *   - rule .claude/rules/api-contract.md   (registry is the single source of truth)
 *   - rule .claude/rules/security.md       (no inline URL strings outside this file)
 *   - rule .claude/rules/auth-and-session.md (all upstream calls go through BFF)
 *
 * Conventions:
 *   - Key format: `<domain>.<action>` (e.g. `'auth.session'`, `'camera.list'`).
 *   - `path` builders return the BFF-relative path (`/api/upstream/…`).
 *     The BFF proxy (Wave-3) injects the Authorization header server-side.
 *   - Add Zod parsers in `parsers/<name>.ts` for endpoints with a history of
 *     contract violations or stricter typing needs (see api-contract rule).
 */
import type { paths } from '$generated/upstream';

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/**
 * Extract the 200 response body type for a given path + method from the
 * generated OpenAPI types.
 */
type Get200<
	P extends keyof paths,
	M extends 'get' | 'post' | 'put' | 'patch' | 'delete'
> = paths[P][M] extends {
	responses: { 200: { content: { 'application/json': infer R } } };
}
	? R
	: never;

/**
 * Unwrap `{ data: D }` envelope shapes.  Callers receive `D` directly after
 * `core-fetch` strips the envelope.
 */
type DataOf<E> = E extends { data: infer D } ? D : E;

// ---------------------------------------------------------------------------
// EndpointDef
// ---------------------------------------------------------------------------

/**
 * A single registered endpoint.
 *
 * Generic parameters:
 *   - `Args`     — query/path params passed to the `path` builder.
 *   - `Body`     — request body type (`void` for bodyless methods).
 *   - `Response` — the unwrapped data type consumers receive.
 *
 * `_phantom` is never used at runtime; it exists solely to preserve the
 * type parameters so the helper types `ArgOf`, `BodyOf`, `ResponseOf` can
 * extract them via conditional type inference.
 */
export interface EndpointDef<Args, Body, Response> {
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	path: (args: Args) => string;
	/** @internal — phantom field for type inference only; never accessed. */
	_phantom?: { args: Args; body: Body; response: Response };
}

/**
 * Identity helper that attaches phantom type params and returns the def
 * unchanged at runtime. Use this rather than a raw object literal so the
 * type parameters are explicitly stated.
 */
export function defineEndpoint<Args = void, Body = void, Response = unknown>(
	def: Omit<EndpointDef<Args, Body, Response>, '_phantom'>
): EndpointDef<Args, Body, Response> {
	return def as EndpointDef<Args, Body, Response>;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const Endpoints = {
	/**
	 * Retrieve the current authenticated session from the upstream.
	 *
	 * Routed through the BFF at `/api/upstream/auth/session` so the server
	 * can inject the Authorization header without exposing the token to the
	 * browser (see rule auth-and-session.md, ADR 0003).
	 */
	'auth.session': defineEndpoint<void, void, DataOf<Get200<'/auth/session', 'get'>>>({
		method: 'GET',
		path: () => '/api/upstream/auth/session'
	})
} as const;

// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

export type EndpointKey = keyof typeof Endpoints;

/** Extract the `Args` type parameter for a registry key. */
export type ArgOf<K extends EndpointKey> =
	(typeof Endpoints)[K] extends EndpointDef<infer A, unknown, unknown> ? A : never;

/** Extract the `Body` type parameter for a registry key. */
export type BodyOf<K extends EndpointKey> =
	(typeof Endpoints)[K] extends EndpointDef<unknown, infer B, unknown> ? B : never;

/** Extract the `Response` type parameter for a registry key. */
export type ResponseOf<K extends EndpointKey> =
	(typeof Endpoints)[K] extends EndpointDef<unknown, unknown, infer R> ? R : never;
