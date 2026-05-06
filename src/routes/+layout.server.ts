/**
 * Root server load: surface the resolved locale + request id to the client.
 *
 * Conformance:
 *   - rule .claude/rules/i18n.md (server resolves locale, client renders it)
 *   - rule .claude/rules/observability.md (request id available to UI for support)
 */
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	locale: locals.locale,
	requestId: locals.requestId
});
