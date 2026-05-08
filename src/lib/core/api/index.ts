/**
 * Public surface of `core/api`.
 *
 * Consumers import from this barrel, never from deep paths:
 *   import { api, ApiError, Endpoints } from '$core/api'
 *
 * Conformance: rule .claude/rules/architecture.md (export through index).
 */
export { api, type ApiCallOptions } from './core-fetch.js';
export { ApiError, apiErrorI18nKey, type ApiErrorInit, API_ERROR_I18N_KEYS } from './error.js';
export {
	Endpoints,
	defineEndpoint,
	type EndpointDef,
	type EndpointKey,
	type ArgOf,
	type BodyOf,
	type ResponseOf
} from './endpoints.js';
