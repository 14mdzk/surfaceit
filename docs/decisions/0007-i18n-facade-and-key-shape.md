# 0007 — i18n Facade and Key Shape

- **Status:** Proposed
- **Date:** 2026-05-08
- **Deciders:** Kaito, Yuki, Mei
- **Tags:** i18n, frontend, naming

## Context

ADR 0005 picked Paraglide JS for i18n and ADR 0006 wired the in-package
`paraglideVitePlugin` into `vite.config.ts`. The generated output lands in
`src/lib/generated/paraglide/`.

After the Phase 1 wiring shipped, Mei's day-one docs pass surfaced a
contradiction between two surfaces that should agree:

- `.claude/rules/i18n.md` (the rule prose) says imports come from a
  `$messages` alias and keys are dotted, e.g. `m['auth.login.title']()`.
- The shipped code (`src/lib/core/i18n/index.ts`,
  `src/routes/+layout.svelte`, `messages/en.json`) imports a named `m`
  from `$core/i18n` and uses flat snake_case keys, e.g. `m.app_title()`.

The rule was written speculatively against the original Paraglide brief
before the actual wiring landed; the rule was never reconciled with the
shipped code. The two are now out of sync, and a future agent reading
the rule will write code that does not match the build output.

We need to decide which surface is authoritative and bring the other in
line. Three forces apply:

1. **Paraglide's compilation model is a hard constraint.** The compiler
   emits one TS file per message key, file-named after the key. The
   generated tree under `src/lib/generated/paraglide/messages/` already
   shows `app_title.js`, `error_request_id.js`, etc. — one file per key,
   identifier-safe.
2. **A library facade protects every future fork.** Paraglide is the
   current implementation, not the long-term contract. The boilerplate's
   contract is `$core/i18n`. If we point components at `$messages`, the
   day we change library (Lingui, FormatJS, hand-rolled), every component
   changes.
3. **Reversibility is the dominant axis for a boilerplate.** Fork-time
   churn is paid by every downstream product. Whichever surface we pick
   becomes the citation pattern that propagates.

## Options considered

### Option A — Amend the rule; keep the shipped facade and key shape

The rule prose is updated to match the code:
- imports come from `$core/i18n` (named `{ m, locales, localeCookieName, getLocale, setLocale }`)
- keys are flat, identifier-safe, snake_case (`app_title`, `auth_login_title`)

Pros:
- Matches Paraglide's per-key file emission directly (no compiler munging,
  no bracket-access at call sites, full TS auto-completion on `m.<key>`).
- `$core/i18n` is a chokepoint we own; future library swaps touch one file.
- Co-locates the locale list and cookie name with the message function —
  three named imports replace two imports plus a magic-string cookie name.
- Phase 1 already shipped this. No code churn.
- Snake_case maps cleanly to a future error-code → i18n-key table in
  `core/api/error.ts`: `INVALID_CREDENTIALS` → `auth_login_invalid_credentials`
  is mechanical.

Cons:
- Loses the visual hierarchy that `auth.login.title` conveys at a glance.
  Mitigation: the snake_case prefix (`auth_login_*`, `camera_list_*`)
  preserves grouping with no compiler cost.
- `rules/i18n.md` needs editing in a follow-up.

### Option B — Refactor the code to match the rule (dotted keys, `$messages` import)

Pros:
- Keys read more like a namespace tree.
- Matches the rule prose verbatim.

Cons:
- Forces bracket-access at every call site (`m['auth.login.title']()`),
  losing identifier-style ergonomics and editor auto-completion. Or
  forces reliance on Paraglide's identifier-munging behavior, which makes
  the JSON key and the function name diverge — the worst of both worlds.
- Removes the `$core/i18n` facade and re-couples every component to a
  Paraglide-specific alias. Library swap becomes a repo-wide rename.
- Loses the co-located `locales` + `localeCookieName` exports; consumers
  re-import them from generated code.
- Requires renaming six existing keys, regenerating Paraglide, updating
  the layout, and re-running tests — pure churn for no architectural win.

### Option C — Hybrid: keep `$core/i18n` facade, switch keys to dotted

Pros:
- Preserves the facade benefit.
- Aligns key shape with the rule prose.

Cons:
- The dotted-key downsides (bracket-access or compiler munging) still
  apply. The facade alone is not the load-bearing reason to pick the
  shipped pattern; the key shape is.

## Decision

**Option A.** The shipped pattern is the right one because it aligns
with how Paraglide actually compiles, preserves a library-swap
chokepoint at `$core/i18n`, and eliminates fork-time churn. The rule
prose is the surface that drifted, not the code. We amend the rule to
match.

The deciding factor: Paraglide's compiler emits one identifier-named TS
function per key. Dotted keys force either bracket-access or compiler
munging at every call site — both cost ergonomics and discoverability
for no architectural gain.

This ADR supersedes the relevant prose in `.claude/rules/i18n.md`. It
does **not** supersede ADR 0005 (Paraglide is still the engine) or
ADR 0006 (the Vite plugin wiring stands). It refines both by pinning
the consumer-facing contract.

## Consequences

Easier:

- No code churn. Phase 1 stays as shipped.
- Future error-code → i18n-key tables in `core/api` map mechanically:
  `auth_login_*`, `camera_list_*` prefixes carry the grouping that dotted
  keys would have given visually.
- Library swap (if it ever happens) touches `src/lib/core/i18n/index.ts`
  and nothing else.
- Auto-completion on `m.<key>` works at every call site.

Harder:

- Reviewers must remember the snake_case + facade pattern; the rule
  update lands the discipline. Until the rule is updated, the rule
  itself is the trap — fix the rule promptly.
- Group-prefix discipline (`auth_login_*`, `camera_list_*`) is a
  convention, not enforced by the compiler. We accept that; the
  alternative is enforcement that costs more than it saves.

Revisit if:

- Paraglide changes its compilation model and starts supporting dotted
  identifier-style keys natively without bracket-access or munging.
- We adopt a TMS pipeline (Crowdin, Lokalise) that prefers dotted keys
  for its tree-view UX. At that point we re-evaluate.

## Compliance

- Linked rule: `.claude/rules/i18n.md` — **becomes inconsistent with this
  ADR until updated**. A follow-up task is queued for Mei to bring the
  rule in line with this decision; see *Follow-ups* below.
- Linked ADR: `docs/decisions/0005-i18n-paraglide.md` (engine choice;
  unaffected).
- Linked ADR: `docs/decisions/0006-paraglide-vite-plugin.md` (build
  wiring; unaffected).
- Linked Obsidian wiki concept: `[[OpenAPI Codegen for SvelteKit]]` for
  the future error-code → i18n-key table pattern.

## Follow-ups

- **Mei** to update `.claude/rules/i18n.md` once this ADR is accepted:
  - Replace `$messages` with `$core/i18n` in DO list and Pattern block.
  - Replace dotted keys (`auth.login.title`) with snake_case keys
    (`auth_login_title`) in the Pattern block.
  - Replace `m['auth.login.title']()` with `m.auth_login_title()` in
    the Pattern block.
  - Update the *Quick reference* table to cite `$core/i18n` instead of
    `$messages`.
  - Add a one-line note: "Prefix-group keys by feature
    (`auth_login_*`, `camera_list_*`); the prefix carries the grouping
    that dotted keys would have given visually."
- **Sora** (when `core/api` lands in Phase 2): build the error-code →
  i18n-key map (`API_ERROR_I18N_KEYS`) using snake_case keys consistent
  with this ADR. Naming convention: `<domain>_<surface>_<reason>`,
  e.g. `auth_login_invalid_credentials`.

## Notes

The drift was caught by the day-one docs audit, before any product code
forked from this boilerplate. Catching it now costs one ADR and one rule
edit. Catching it after the first fork would have cost a coordinated
rename across both repos. This is exactly the kind of pre-fork hygiene
the boilerplate exists to enable.
