/**
 * Config entry point (Phase 1 placeholder).
 *
 * Phase 2 will introduce a Zod-validated env loader (public/private split).
 * For now this module only exposes a build-time hint so the smoke test has
 * something concrete to import.
 *
 * Conformance: rule .claude/rules/security.md (no secrets in PUBLIC_*).
 */
export const PROJECT_NAME = 'surfaceit' as const;
