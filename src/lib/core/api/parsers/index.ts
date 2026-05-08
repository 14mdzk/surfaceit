/**
 * Trust-boundary parsers.
 *
 * This barrel exports Zod parsers for use at inbound trust boundaries:
 *   - BFF route bodies
 *   - URL search params
 *   - Third-party webhook payloads
 *   - Per-endpoint parsers for fields with a history of contract violations
 *
 * Conformance:
 *   - rule .claude/rules/api-contract.md  (Zod at trust boundaries only, not on
 *     every trusted upstream response — CPU is not free)
 *   - rule .claude/rules/security.md      (validate untrusted input at trust boundaries)
 *
 * Usage example:
 *   import { isoDateParser } from '$core/api/parsers'
 *   const date = isoDateParser.parse(rawValue)  // throws ZodError on bad input
 */
import { z } from 'zod';

/**
 * Validates and narrows a value to a well-formed ISO 8601 date-time string.
 *
 * Use this when an upstream field is typed as `string` in the spec but must
 * actually be a date-time for the UI to render correctly (e.g. `createdAt`,
 * `updatedAt`).  The generated types correctly narrow to `string`; this
 * parser provides the runtime guarantee.
 */
export const isoDateParser = z.string().datetime({ offset: true });

export type IsoDate = z.infer<typeof isoDateParser>;
