# Guide — Run the Tests

**Audience:** any contributor running tests locally, debugging a CI failure,
or adding a new test to the suite.

**Related rules:**

- [`.claude/rules/testing.md`](../../.claude/rules/testing.md)

## Two runners, one repo

This repo uses **two distinct test runners**. They look alike but are not the
same. Knowing which is which prevents an entire class of "why is Playwright
running here?" failures.

| Command | Runner | Tests it picks up | Where they live |
|---|---|---|---|
| `bun run test` | **Vitest** | `*.test.ts` | co-located next to the unit under test (`src/**/*.test.ts`) |
| `bun run test:e2e` | **Playwright** | `*.e2e.ts` | `e2e/**/*.e2e.ts` |
| `bun test` | Bun's built-in runner | `*.{test,spec}.{ts,tsx,js,jsx}` | **not used in this repo — see below** |

`bun run test` invokes the Vitest binary via the `package.json` script. `bun
test` (no `run`) is Bun's own built-in test runner. The two are unrelated.

### Why we do not use `bun test`

Bun's built-in runner globs `*.{test,spec}.{ts,tsx,js,jsx}` repo-wide and has
no path-exclude configuration. If we let it run, it would collect every
Playwright spec under `e2e/` and call `test()` outside Playwright's driver,
producing the misleading error:

```
Playwright Test did not expect test() to be called here.
```

The fix is structural, not a flag: every Playwright spec is named
`*.e2e.ts`, which Bun's built-in runner ignores. See
[`testing.md`](../../.claude/rules/testing.md) — "Runner separation."

**Rule of thumb:** always type `bun run test` (Vitest) or `bun run test:e2e`
(Playwright). Never `bun test`.

## Unit tests — Vitest

Vitest covers pure logic, runes stores (called as factories), and any code
that does not need a browser.

```sh
bun run test            # one-shot run (CI mode)
bun run test:watch      # watch mode for local dev
```

The config lives in `vitest.config.ts`. It uses the SvelteKit Vite plugin so
tests resolve aliases (`$core`, `$lib`, `$domains`, …) the same way
production code does.

**File naming:** co-locate with `*.test.ts`. Example:

```
src/lib/core/config/
├── index.ts
└── config.test.ts
```

**Pattern:**

```ts
import { describe, it, expect } from 'vitest';
import { createExampleStore } from './store.svelte';

describe('exampleStore', () => {
	it('toggles selection idempotently', () => {
		const store = createExampleStore();
		store.toggle('a');
		store.toggle('a');
		expect(store.selected.has('a')).toBe(false);
	});
});
```

For HTTP-touching code, use MSW. See `testing.md` for the setup snippet —
do not stub `fetch` by hand.

## End-to-end tests — Playwright

Playwright covers user flows: login, list + paginate, mutate, logout, locale
switch.

```sh
bun run test:e2e                    # headless run (CI mode)
bun run test:e2e --ui               # interactive Playwright UI
bun run test:e2e --headed           # see the browser
bun run test:e2e example.e2e.ts     # filter by file name
```

The config lives in `playwright.config.ts`. It builds the app and runs
`bun run preview` on port 4173 as the test target. First run takes longer
because it has to build.

**File naming:** specs live under `e2e/` and end in `.e2e.ts`. The extension
is load-bearing — see "Why we do not use `bun test`" above.

**Pattern:**

```ts
// e2e/smoke.e2e.ts
import { test, expect } from '@playwright/test';

test('home page renders the locale switch', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('locale-switch')).toBeVisible();
});
```

Phase 1 ships exactly one smoke spec (`e2e/smoke.e2e.ts`). Add specs as new
critical flows land. Critical flows are listed in `testing.md`.

### Playwright browser binaries

Playwright needs browser binaries the first time. If `bun run test:e2e`
errors with a missing-browser message:

```sh
bunx playwright install
```

CI installs them automatically.

## CI behavior

| Workflow | What it runs | Blocking? |
|---|---|---|
| `.github/workflows/ci.yml` | install → codegen → check → lint → test → build | **yes** |
| `.github/workflows/e2e.yml` | Playwright on PR | currently `continue-on-error: true`; becomes blocking in Phase 5 (see `roadmap.md`) |

A green local `bun run check && bun run lint && bun run test && bun run build`
mirrors the CI gate. e2e is recommended but not required to merge until
Phase 5.

## Adding a test

1. **Unit test** for any pure logic, store, or service. Co-locate as
   `*.test.ts`. Run `bun run test`.
2. **e2e test** if the change touches a critical flow. Add under `e2e/` as
   `*.e2e.ts`. Run `bun run test:e2e`.
3. Tests ship in the **same PR** as the feature or fix
   ([`testing.md`](../../.claude/rules/testing.md) and
   [`code-review.md`](../../.claude/rules/code-review.md)).

## Common failures

| Symptom | Likely cause | Fix |
|---|---|---|
| `Playwright Test did not expect test() to be called here` | A spec was named `*.spec.ts` or `*.test.ts` and was collected by the wrong runner | Rename to `*.e2e.ts` |
| Vitest cannot resolve `$core/...` | Missing SvelteKit Vite plugin in `vitest.config.ts` | Restore `plugins: [sveltekit()]` |
| `bun run test` runs Playwright specs | Someone invoked `bun test` instead | Use `bun run test` (Vitest) |
| e2e times out on `webServer` | Build failed | Run `bun run build` standalone, fix, retry |
| `core/i18n` imports fail in tests | Paraglide bundle stale | The `test` script runs `i18n:compile` first; if it still fails, run `bun run i18n:compile` manually and re-try |
