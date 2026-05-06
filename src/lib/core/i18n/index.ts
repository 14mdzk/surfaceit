/**
 * i18n core entry point.
 *
 * Re-exports Paraglide's runtime helpers and message bundles so the rest of
 * the app imports from `$core/i18n` instead of reaching into `$lib/generated`.
 *
 * Conformance:
 *   - ADR 0005: Paraglide JS for i18n, English-only catalog day one.
 *   - rule .claude/rules/i18n.md: every user-facing string flows through this layer.
 */
export * as m from '$lib/generated/paraglide/messages.js';
export {
	baseLocale,
	locales,
	cookieName as localeCookieName,
	getLocale,
	setLocale,
	overwriteGetLocale,
	overwriteSetLocale,
	type Locale
} from '$lib/generated/paraglide/runtime.js';
