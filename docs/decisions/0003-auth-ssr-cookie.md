# 0003 — SSR-First Auth with HttpOnly Cookie Session

- **Status:** Accepted
- **Date:** 2026-05-06
- **Deciders:** Kaito, Ren, Sora
- **Tags:** auth, security, ssr

## Context

The reference backend (hexagonal Go) issues short-lived access tokens and longer-lived refresh tokens. The previous project stored both tokens in `localStorage`. That makes the refresh token an XSS smash-and-grab target and prevents server-side rendering of authenticated pages without a flash of unauthenticated UI.

We want:

- protected pages rendered on the server with the user already known
- refresh tokens never visible to JavaScript
- a single source of truth for "is this request authenticated"

## Options considered

### Option A — `localStorage` tokens, client-only auth (`ssr=false`)
Pros: simple; what the previous project did.
Cons: XSS exposure; SSR impossible; flash of unauthenticated UI; extra client redirect on every load.

### Option B — HttpOnly cookie session, refresh held server-side, BFF proxy
Pros: tokens never touch the browser; SSR works; CSRF mitigated with SameSite=Lax + double-submit on state-changing requests; one cookie domain to revoke.
Cons: every cross-origin upstream call needs a BFF route; refresh logic moves to the server.

### Option C — Cookie for access, header for refresh
Pros: half measure.
Cons: still exposes refresh in JS or in URL fragments depending on flow. Worst of both.

## Decision

**Option B**. The browser sees only `sid` (opaque session id, HttpOnly, SameSite=Lax, Secure in non-dev) and `csrf` (readable, double-submit). The server holds the access + refresh tokens, refreshes them transparently, and proxies upstream calls through `routes/api/upstream/[...]/+server.ts`.

## Consequences

Easier:
- protected SSR pages
- token rotation (server-side, no client coordination)
- revocation (delete the session row)

Harder:
- every cross-origin upstream call must go through a BFF endpoint or be allow-listed
- CSRF discipline becomes mandatory (we will codify this in `rules/security.md`)

Revisit if:
- The product needs to share an access token with a non-browser client from the same session (e.g. a worker on the same origin). Likely we add a tightly-scoped token endpoint then.

## Compliance

- Rule: `.claude/rules/auth-and-session.md`
- Rule: `.claude/rules/security.md`
- Obsidian wiki: [[SvelteKit SSR Cookie Session BFF]] (frontend domain)
