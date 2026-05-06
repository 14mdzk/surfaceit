---
alwaysApply: true
description: >
  Security baseline for ${PROJECT_NAME}: tokens stay server-side, headers are
  strict, input is validated at the boundary, secrets never enter the client
  bundle.
---

# Security Rule

## DO

- **DO** store access and refresh tokens server-side. The browser holds only an opaque session id (see `auth-and-session.md`).
- **DO** apply security headers in `hooks.server.ts`:
  - `Content-Security-Policy` (strict; `script-src 'self'`; no `unsafe-inline` outside dev)
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (in production)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Content-Type-Options: nosniff`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()` (open up only what features need)
- **DO** validate untrusted input at trust boundaries with Zod: form actions, query params, BFF inbound bodies, third-party webhooks.
- **DO** require `x-csrf` header matching the `csrf` cookie for unsafe HTTP methods (POST/PUT/PATCH/DELETE).
- **DO** strip `cookie`, `host`, and `origin` from outbound proxy requests in BFF endpoints.
- **DO** rate-limit auth endpoints in the BFF (`/api/upstream/auth/*`) with a small in-memory or Redis token bucket.
- **DO** keep secrets in `.env` (gitignored). Validate them with a Zod schema at startup; fail fast on missing.
- **DO** mark cookies `Secure` in non-dev. `HttpOnly` for session cookies. `SameSite=Lax` by default; `Strict` for high-risk cookies.

## DON'T

- **DON'T** put secrets in `PUBLIC_*` env vars. `PUBLIC_*` is shipped to the browser. Only ship what is meant to be public.
- **DON'T** log tokens, session ids, or PII. Redact at the logger.
- **DON'T** echo unvalidated user input into error messages, redirects, or HTML.
- **DON'T** disable CSP "to make a third-party widget work." Whitelist explicitly or remove the widget.
- **DON'T** trust `X-Forwarded-For` without a known reverse-proxy chain. Validate before using for rate-limit / audit.
- **DON'T** open an `EventSource`/`WebSocket` with a token in the query string from the browser. Use the BFF.
- **DON'T** introduce a third-party script via `<script src="...">` without a Subresource Integrity (`integrity`) attribute and a CSP allowance.

## Bundle hygiene

- No `console.log` of session, user, or environment objects in production builds. Strip via build flag.
- Tree-shake aggressively; check `bun run build --analyze` (or rollup-plugin-visualizer) for unintended deps in the client bundle.
- Server-only modules (`*.server.ts`, `src/lib/server/**`) must not be imported from `*.svelte` outside server contexts. SvelteKit enforces this; reviewers should still notice.

## Dependencies

- See `dependency-policy.md`. Run `bun audit` (or equivalent) in CI; fail on `high` and `critical`.
- Pin direct deps; let lockfile pin transitive.

## Quick reference

| Surface | Threat | Control |
|---|---|---|
| Login form | Credential stuffing | Rate-limit + lockout in BFF |
| BFF proxy | CSRF | Double-submit cookie |
| BFF proxy | Header injection | Whitelist headers, strip cookie/host/origin |
| Realtime SSE | Token leak in URL | Connect through BFF, server adds Authorization |
| Form action | Untrusted body | Zod parse, reject on failure |
| Logger | PII / token in logs | Redact at sink, never log session objects |
| Static asset | Tampered CDN script | SRI + CSP allowlist |
