# Guide — Add a Route

**Audience:** an engineer adding a page under `src/routes/(app)/`. After this
guide you will have a server-loaded, locale-aware, session-guarded page that
hydrates a domain's data on the client.

**Prerequisites:**

- A domain exists for the data the page renders. If not, follow
  [`add-a-domain.md`](add-a-domain.md) first.
- Phase 1 is merged. Phase 2 wiring (`core/api`, `core/auth`, `core/query`)
  is in flight; the patterns below describe the target shape and flag the
  gaps.

**Related rules:**

- [`.claude/rules/auth-and-session.md`](../../.claude/rules/auth-and-session.md)
- [`.claude/rules/architecture.md`](../../.claude/rules/architecture.md)
- [`.claude/rules/i18n.md`](../../.claude/rules/i18n.md)
- [`.claude/rules/observability.md`](../../.claude/rules/observability.md)

## Where the route goes

| Route group | Use for |
|---|---|
| `src/routes/(auth)/` | public auth pages (`/login`, `/reset-password`) |
| `src/routes/(app)/` | session-guarded product surfaces |
| `src/routes/api/` | BFF endpoints called by the browser, never user-visible HTML |

This guide covers an `(app)` route — the common case. The `(auth)` group has
no session guard; the `(app)` group does, via its `+layout.server.ts`.

## 1. Create the files

```
src/routes/(app)/example/
├── +page.server.ts        load function, server-side
├── +page.svelte           rendered output
└── +layout.svelte         (optional) feature shell, e.g. tabs or filters
```

If the feature needs context-scoped state (a domain store), put a
`+layout.svelte` here so the store lifetime matches the feature.

## 2. `+page.server.ts` — the load function

The load function runs on the server first (and on the client during
navigation). It is the only place the route may call a domain service
directly. It receives `event.locals.session` populated by the auth hook.

```ts
// src/routes/(app)/example/+page.server.ts
import type { PageServerLoad } from './$types';
import { exampleService } from '$domains/example';
import { exampleListQuerySchema } from '$domains/example';

export const load: PageServerLoad = async ({ url, parent }) => {
	await parent(); // ensures the (app) layout's session guard runs first

	const query = exampleListQuerySchema.parse({
		search: url.searchParams.get('q') ?? undefined,
		cursor: url.searchParams.get('cursor') ?? undefined,
		limit: Number(url.searchParams.get('limit')) || 20
	});

	const data = await exampleService.list(query);
	return { query, data };
};
```

Three things to notice:

- **Zod parse on the URL search params.** `url.searchParams` is untrusted
  input; parse it before handing it to the service
  ([`security.md`](../../.claude/rules/security.md)).
- **`await parent()`.** Forces the parent layout's session guard to run
  before this load. Skipping it lets a load run for a logged-out user.
- **No `fetch(...)` here.** The domain service is the only caller of
  `core/api` ([`api-contract.md`](../../.claude/rules/api-contract.md)).

> **Phase 2 in progress.** `core/api` lands in Sora's Phase 2 slice; until
> then `exampleService.list(...)` will not compile against a real upstream.

## 3. `(app)/+layout.server.ts` — session guard

The `(app)` group's layout decides whether the user gets through.

```ts
// src/routes/(app)/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.session) {
		const next = encodeURIComponent(url.pathname + url.search);
		redirect(303, `/login?next=${next}`);
	}
	return { user: locals.session.user };
};
```

Do **not** redirect with a client `$effect`. SSR-aware redirects keep the
URL bar honest and avoid the "blank flash then bounce" failure mode
documented in [`auth-and-session.md`](../../.claude/rules/auth-and-session.md).

> **Phase 2 in progress.** `locals.session` is currently always `null` (see
> `src/hooks.server.ts` — `authHandle` is a stub). This layout will redirect
> every visit to `/login` until Phase 2's session resolver lands. Either
> defer adding the `(app)` layout guard until then, or wire a feature flag
> so local development can bypass it.

## 4. `+page.svelte` — render

Server data arrives as the `data` prop. Hydrate it into svelte-query so the
client does not refetch immediately.

```svelte
<!-- src/routes/(app)/example/+page.svelte -->
<script lang="ts">
	import { useExampleList, createExampleStore, ExampleList } from '$domains/example';
	import { m } from '$core/i18n';

	let { data } = $props();

	createExampleStore(); // context for child components

	// Hydrate svelte-query with the server-rendered data
	const list = useExampleList(data.query);
</script>

<svelte:head>
	<title>{m.example_page_title()}</title>
</svelte:head>

<h1>{m.example_page_title()}</h1>
<ExampleList />
```

All user-facing strings flow through Paraglide. Add the keys
(`example_page_title`, …) to `messages/en.json` per
[`i18n.md`](../../.claude/rules/i18n.md).

## 5. Locale handling

You do not call a locale resolver from the route — `paraglideHandle` in
`hooks.server.ts` already populates `event.locals.locale` and the
`+layout.server.ts` at the root surfaces it to the client. Inside components,
import message functions from `$core/i18n`; they read the request-scoped
locale automatically.

If a route needs the locale value itself (e.g. to pass to an `Intl`
formatter), read it from the layout data — the snippet above already
destructures `data` from `$props()`, and `data.locale` is populated by the
root `+layout.server.ts`. Inside a child component, use the runes-era
`$app/state` import (this repo runs in runes-only mode per
`svelte.config.js`):

```ts
import { page } from '$app/state';
const locale = page.data.locale; // 'en' for now; charter is English-only on day one
```

Do **not** use `$page` from `$app/stores` — that is the legacy
auto-subscription API and is not the runes-era pattern.

## 6. Errors

Two layers handle errors:

- **Per-route.** Throw a SvelteKit `error(status, message)` from the load
  when a precondition fails (404 for not-found, 403 for forbidden). The
  surrounding `+error.svelte` renders it.
- **Shell-level.** The root `src/routes/+error.svelte` catches anything
  unhandled and surfaces the request id (`m.error_request_id({ id })`) so
  users can quote it in support.

`hooks.server.ts`'s `handleError` logs the full error with the request id
through pino ([`observability.md`](../../.claude/rules/observability.md)).
Do not log from the route directly; use `$core/logger` and structured
fields.

## 7. Tests

- **Vitest unit** for any pure helpers extracted from the load function.
- **Playwright e2e** under `e2e/<feature>.e2e.ts` for the critical path
  (visit, see data, mutate, see invalidation). Filename must end `.e2e.ts`
  ([`testing.md`](../../.claude/rules/testing.md)).

```ts
// e2e/example.e2e.ts
import { test, expect } from '@playwright/test';

test('example list renders', async ({ page }) => {
	await page.goto('/example');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
```

## Checklist before opening the PR

- [ ] Route lives under the right group: `(auth)` for public, `(app)` for
  guarded, `api/` for BFF.
- [ ] `+page.server.ts` parses untrusted input with Zod.
- [ ] No `fetch(...)` outside `core/api`.
- [ ] No client `$effect` that redirects unauthenticated users — redirects
  happen in `+layout.server.ts`.
- [ ] All user-facing strings live in `messages/en.json`.
- [ ] Lint passes (`bun run lint`); typecheck passes (`bun run check`).
- [ ] If the route is in the critical-flow list (login, list, mutate, logout,
  locale switch), an `e2e/*.e2e.ts` spec covers it.
