# 0008 — Auth Lifecycle Direct-Upstream-Fetch Exception

- **Status:** Proposed
- **Date:** 2026-05-08
- **Deciders:** Kaito, Ren
- **Tags:** auth, api, exception

## Context

`.claude/rules/api-contract.md` is unambiguous:

> **DON'T** hand-roll `fetch(...)` outside `src/lib/core/api/**`.

The intent is sound: every upstream call should flow through the typed
endpoint registry in `core/api`, which gives us one place to unwrap the
upstream envelope, one ApiError surface, one chokepoint for tracing
headers, and one place to evolve when the contract changes. For the
ninety-plus percent of calls that happen on behalf of an authenticated
user, that rule holds without exception.

PR #8 (Phase 2 `core/auth`) introduced three call sites that cannot
satisfy it:

```sh
git grep -nE 'fetch\(.*UPSTREAM_API_URL' -- 'src/'
# src/lib/core/auth/refresh.server.ts:77
# src/routes/(auth)/login/+page.server.ts:68
# src/routes/(auth)/logout/+page.server.ts:59
```

Two forces make these sites genuinely different from the rest:

1. **Pre-login there is no Bearer to inject.** The `api()` helper
   resolves paths against the same-origin BFF
   (`/api/upstream/[...]/+server.ts`). The BFF's job is to read
   `event.locals.session` and inject
   `Authorization: Bearer ${session.accessToken}` on the way out.
   Login by definition runs without a session — the BFF would inject
   nothing, and routing through it adds a same-origin hop that buys us
   no isolation, no auth, and no envelope behavior the upstream
   `/auth/login` endpoint actually returns (login responses are token
   payloads, not the standard `{ success, data }` envelope).
2. **Refresh and logout are server-side state operations, not
   browser-bound proxy calls.** `transparentRefresh()` lives in
   `core/auth/refresh.server.ts` and is invoked from `hooks.server.ts`
   *before* a request reaches any route handler. It rotates tokens in
   the server-side session store. There is no browser request to proxy.
   Logout symmetrically destroys the local session record and makes a
   best-effort upstream revocation; the local destruction is the
   load-bearing step, the upstream call is fire-and-forget.

In short: the BFF exists to stand between the browser and the upstream.
These three calls do not originate in the browser. Forcing them through
a browser-shaped chokepoint adds a layer of indirection that obscures
what the code is actually doing — managing tokens server-side — and
weakens the security-critical mental model that *only* `core/auth/**`
ever sees raw tokens.

## Options considered

### Option A — `serverApi(endpointKey, opts)` wrapper inside `core/api`

Generalize a server-only fetcher in `core/api` that bypasses the BFF
when the registry entry is flagged as such, and route the three auth
calls through it.

Pros:
- The rule prose stays verbatim ("no `fetch` outside `core/api/**`").
- A future non-auth server-side fetcher (e.g. a scheduled job, a
  webhook handler that needs a service token) reuses the same wrapper.

Cons:
- Scaffolding for two-or-three call sites today. The wrapper has to
  carry a "skip the BFF" flag, a "no Bearer expected" flag, and a way
  to opt out of envelope unwrapping (login returns tokens, not
  `{ success, data }`). Each flag is a small lie about what `api()`
  means.
- Obscures the security-relevant property that token-handling code is
  confined to `core/auth/**` plus `routes/(auth)/**`. With the wrapper,
  any future endpoint registry entry could quietly opt into raw-token
  handling.
- Solves a generality problem we do not yet have. The three call sites
  are stable; we are not adding more on the auth-lifecycle surface.

### Option B — Bounded exception in `core/auth/**` and `routes/(auth)/**`

Direct `fetch(serverConfig.UPSTREAM_API_URL + '/auth/...')` in
server-only files, every site carrying an inline rationale comment, the
exception bound to two paths and verifiable by a one-line `git grep`.

Pros:
- Honest. The code says "this is an auth-lifecycle direct call,"
  because that is what it is.
- The boundary is mechanically checkable in CI or in code review:

  ```sh
  git grep -nE 'fetch\(.*UPSTREAM_API_URL' -- 'src/'
  ```

  Every result must be in `core/auth/**` or `routes/(auth)/**`. A
  result anywhere else is a blocking review comment.
- Token-handling code stays confined to one directory and one route
  group. Reviewers know exactly where to look.
- Minimal change. No new abstraction, no new flags, no new tests for
  scaffolding.

Cons:
- The api-contract rule prose now has a documented carve-out (this
  ADR), and reviewers must hold two things in their head: the rule and
  its single exception.

### Option C — A separate `routes/api/auth/[...]/+server.ts` BFF endpoint that wraps the upstream call

Wrap each auth-lifecycle upstream call in a dedicated BFF route, then
have the form action / hook call that route via `api()`.

Pros:
- Keeps the call inside a routed handler.

Cons:
- The handler is itself a hand-rolled fetch wrapper — the exception
  just moves one layer deeper.
- Adds a same-origin hop (form-action → BFF route → upstream) for no
  isolation gain on the server. The form action and the BFF route both
  run in the same Node process with the same secrets.
- For `transparentRefresh()`, the call originates inside
  `hooks.server.ts` before any route resolves; routing it through a
  same-process HTTP endpoint to call another same-process HTTP endpoint
  is round-trip ceremony.

## Decision

**Option B.** A bounded, grep-verifiable exception confined to:

- `src/lib/core/auth/**`
- `src/routes/(auth)/**`

Verifiable via:

```sh
git grep -nE 'fetch\(.*UPSTREAM_API_URL' -- 'src/'
```

Every result of that command must fall in one of those two paths.
`.claude/rules/code-review.md` will be updated (Mei follow-up; see
*Follow-ups* below) to add this grep to the auth-lifecycle PR
verification checklist.

Each call site carries the canonical rationale comment so the
exception is self-documenting at the point of use:

```ts
// Direct upstream call: auth lifecycle only (no Bearer to inject pre-login,
// or server-side revocation). All other upstream calls go through api()
// per .claude/rules/api-contract.md. See ADR 0003 + ADR 0008.
```

The deciding factor: the security-relevant mental model the team relies
on — *raw tokens live only in `core/auth/**`* — is preserved by
keeping these three calls visibly explicit, not by hiding them behind
a wrapper that looks like a normal `api()` call.

## Consequences

Easier:

- The auth lifecycle reads as what it is: server-side token management
  with three direct upstream calls. No mental indirection.
- The "no Bearer pre-login" reality is reflected in code, not papered
  over with a wrapper that has to carry a "skip auth injection" flag.
- Reviewing token-handling code is mechanical: open
  `src/lib/core/auth/`, open `src/routes/(auth)/`, you have seen the
  whole surface.

Harder:

- The api-contract rule prose has a documented carve-out. Reviewers on
  auth-lifecycle PRs must run the grep above and confirm scope.
- The carve-out is two paths today. Drift would mean a fourth call
  site appearing outside those paths; the grep makes that drift
  immediately visible, but the discipline of running it falls on the
  reviewer.

Revisit if:

- A non-auth surface needs server-side direct upstream fetch (a
  scheduled job, a service-token webhook handler). At that point the
  exception generalizes — promote `serverApi()` into `core/api` and
  convert the auth call sites along with the new one. The exception
  surface is no longer "auth-only" once it has two consumers.
- The BFF acquires a way to inject a Bearer pre-session (a pre-shared
  service token, a deployment-scoped credential). At that point
  `refresh` and possibly `login` could route through the BFF and the
  carve-out narrows to whichever calls genuinely cannot — likely just
  `logout`'s revocation step.
- Paraglide-style prose drift: if the rule prose ever absorbs the
  carve-out into its body, this ADR is the source of truth that the
  rule edit cites.

## Compliance

- Linked rule: `.claude/rules/api-contract.md` — this ADR documents the
  one carve-out. A follow-up Mei task adds a one-line cross-reference
  in the rule prose; see *Follow-ups* below.
- Linked rule: `.claude/rules/auth-and-session.md` — the lifecycle
  these calls implement.
- Linked rule: `.claude/rules/code-review.md` — gains a grep step on
  auth-lifecycle PRs (Mei follow-up).
- Linked ADR: `docs/decisions/0003-auth-ssr-cookie.md` — the parent
  decision that established the BFF + cookie-session model. ADR 0008
  refines it by recording the unavoidable exception inside that model.
- Linked Obsidian wiki concept: `[[SvelteKit SSR Cookie Session BFF]]`
  (frontend domain).

## Follow-ups

- **Mei** to update `.claude/rules/api-contract.md` once this ADR is
  accepted, mirroring the ADR-then-rule-edit cadence used for ADR 0007:
  - Add a one-line carve-out under the **DON'T** for hand-rolled
    `fetch`: "*Exception: auth lifecycle (login, logout, refresh) in
    `core/auth/**` and `routes/(auth)/**`. See ADR 0008.*"
  - Add a row to the *Quick reference* table or a short note pointing
    reviewers at the grep:
    `git grep -nE 'fetch\(.*UPSTREAM_API_URL' -- 'src/'` must return
    results only under those two paths.
- **Mei** to add a checklist item to `.claude/rules/code-review.md`'s
  "What every reviewer checks" section: on auth-lifecycle PRs, run the
  grep above and confirm every result is inside the carve-out.

## Notes

The lead's plan-approval of Ren's `core/auth` design recorded this
exception as one of three constraints. Ren hit the Anthropic API rate
limit before authoring this ADR; the lead salvaged the implementation
in PR #8 with the inline rationale comments at all three call sites and
tracked the missing ADR as task #11. This PR closes that loop and is
intentionally doc-only — no source change, no rule edit. The rule edit
is the next step in the cadence and is sized for a separate Mei PR.

The carve-out is small by design. It would be a smell if it grew. If a
fourth direct-upstream call site appears, the right move is to revisit
this ADR and probably promote the pattern into a `core/api` server-only
helper — at which point the auth call sites convert too, and the
boilerplate ends up with one rule and zero exceptions.
