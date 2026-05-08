/**
 * Public surface of `core/query`.
 *
 * Consumers import from this barrel, never from deep paths:
 *   import { createQueryClient, getQueryClient, defineQuery, defineMutation } from '$core/query'
 *
 * Conformance: rule .claude/rules/architecture.md (export through index).
 */

// Client factory + getter
export {
	buildQueryClient,
	createQueryClient,
	getQueryClient,
	shouldRetry,
	type QueryClientOptions
} from './client.js';

// Query factory
export { buildQueryOptions, defineQuery, type DefineQueryOptions } from './defineQuery.js';

// Mutation factory
export {
	buildMutationOptions,
	defineMutation,
	type DefineMutationOptions,
	type MutationVariables
} from './defineMutation.js';
