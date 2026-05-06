---
alwaysApply: true
description: >
  ${PROJECT_NAME} authenticates server-side with an HttpOnly session cookie.
  Tokens never reach the browser. Upstream calls go through a BFF proxy.
---

# Auth and Session Rule

## Source of truth

- ADR: `docs/decisions/0003-auth-ssr-cookie.md`
- Obsidian wiki: [[SvelteKit SSR Cookie Session BFF]] (frontend domain)

## DO

- **DO** issue an opaque `sid` cookie on login: `HttpOnly`, `SameSite=Lax`, `Secure` in non-dev, path `/`, with a sensible `maxAge`.
- **DO** store access + refresh tokens **server-side** keyed by `sid` (in-memory map for dev, Redis or similar for production).
- **DO** resolve the session in `hooks.server.ts` and populate `event.locals.session = { user, role, accessToken, expiresAt }` (or `null`).
- **DO** route every cross-origin upstream call through a BFF endpoint at `src/routes/api/upstream/[...]/+server.ts` that injects `Authorization: Bearer ...` server-side.
- **DO** refresh the access token transparently when it is near expiry (`expiresAt - now < 60s`). Use a per-session in-flight promise to coalesce parallel refreshes.
- **DO** add a `csrf` cookie on login (readable by JS) and require an `x-csrf` header that matches it on unsafe methods (POST/PUT/PATCH/DELETE).
- **DO** strip browser cookies from outbound upstream requests in the BFF proxy (`headers.delete('cookie')`).
- **DO** revoke the session on logout (`destroySession(sid)`, best-effort upstream revoke, delete cookies).

## DON'T

- **DON'T** put access or refresh tokens in `localStorage`, `sessionStorage`, or any client-readable cookie.
- **DON'T** return tokens in any response body that the browser can read.
- **DON'T** call upstream directly from the browser when it requires auth. Go through the BFF.
- **DON'T** disable SSR (`export const ssr = false`) to "make auth work." That is the symptom of the wrong pattern.
- **DON'T** redirect authenticated users with a client-side `$effect`. Resolve the session in `+layout.server.ts` and `redirect()` from the loader.
- **DON'T** trust `event.request.headers.get('cookie')` directly — use `event.cookies` so SvelteKit applies signing/parsing.

## Login flow (canonical)

```ts
// src/routes/(auth)/login/+page.server.ts
export const actions = {
  default: async ({ request, cookies, fetch }) => {
    const data = Object.fromEntries(await request.formData())
    const upstream = await fetch(env.UPSTREAM + '/auth/login', { /* … */ })
    const tokens = await upstream.json()
    const sid = await createSession(tokens)
    cookies.set('sid', sid, { path: '/', httpOnly: true, sameSite: 'lax', secure: !dev, maxAge: 60 * 60 * 24 * 30 })
    cookies.set('csrf', crypto.randomUUID(), { path: '/', sameSite: 'lax', secure: !dev })
    redirect(303, '/')
  }
}
```

## Protected layout guard

```ts
// src/routes/(app)/+layout.server.ts
export const load: ServerLoad = ({ locals }) => {
  if (!locals.session) redirect(303, '/login')
  return { user: locals.session.user }
}
```

## Quick reference

| Symptom | Likely cause | Fix |
|---|---|---|
| `localStorage.getItem('access_token')` anywhere | Wrong auth model | Move to cookie session + BFF |
| Blank flash on protected route, then redirect | `ssr=false` + client `$effect` redirect | Resolve session in `hooks.server.ts`; redirect from `+layout.server.ts` |
| Refresh races causing 401 storms | No coalescing | One in-flight refresh promise per session |
| CSRF on a state-changing route | Missing `x-csrf` validation | Validate `x-csrf === cookies.get('csrf')` for unsafe methods |
