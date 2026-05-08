/**
 * ApiError — the single error type thrown by core-fetch.
 *
 * Every upstream call either resolves with `data` or throws an `ApiError`.
 * Consumers (domain services, route loaders) catch `ApiError` and map it to
 * a localized message via the `API_ERROR_I18N_KEYS` table below.
 *
 * Conformance:
 *   - rule .claude/rules/api-contract.md   (envelope unwrapped exactly once)
 *   - rule .claude/rules/observability.md  (requestId carried on the error)
 *   - rule .claude/rules/i18n.md           (error codes map to i18n keys)
 */

export interface ApiErrorInit {
	code: string;
	message: string;
	status: number;
	requestId?: string;
}

/**
 * Typed error thrown whenever a call through `api()` fails, regardless of
 * whether the failure was a network error, a non-2xx HTTP status, an
 * unexpected payload shape, or a `success: false` envelope from the upstream.
 */
export class ApiError extends Error {
	/** Machine-readable code, e.g. `'NETWORK_ERROR'` or an upstream code. */
	readonly code: string;
	/** HTTP status at point of failure. 0 for network-level errors. */
	readonly status: number;
	/**
	 * The request id forwarded from the upstream response header. Undefined
	 * when the request never reached the upstream (e.g. network failure).
	 */
	readonly requestId?: string;

	constructor({ code, message, status, requestId }: ApiErrorInit) {
		super(message);
		this.name = 'ApiError';
		this.code = code;
		this.status = status;
		this.requestId = requestId;
	}
}

/**
 * Maps well-known API error codes to Paraglide message keys.
 *
 * Domain services should look up this table when converting an `ApiError`
 * into user-visible copy. Keep keys consistent with `messages/en.json`.
 *
 * Add upstream-specific codes here as they are encountered. Unknown codes
 * fall through to `'common.error.generic'`.
 */
export const API_ERROR_I18N_KEYS: Record<string, string> = {
	NETWORK_ERROR: 'common.error.network',
	HTTP_ERROR: 'common.error.server',
	UNEXPECTED_SHAPE: 'common.error.generic',
	MISSING_FETCH: 'common.error.generic',
	UNAUTHORIZED: 'common.error.unauthorized',
	FORBIDDEN: 'common.error.forbidden',
	NOT_FOUND: 'common.error.notFound'
};

/**
 * Resolve an `ApiError` to its i18n message key.
 * Falls back to `'common.error.generic'` for unknown codes.
 */
export function apiErrorI18nKey(error: ApiError): string {
	return API_ERROR_I18N_KEYS[error.code] ?? 'common.error.generic';
}
