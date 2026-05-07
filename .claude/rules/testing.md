---
alwaysApply: true
description: >
  Testing baseline for ${PROJECT_NAME}: Vitest for units, Playwright for e2e,
  MSW for HTTP, fake EventSource for SSE. Tests are mandatory, not optional.
---

# Testing Rule

## DO

- **DO** write tests with the code, in the same PR. A feature without tests is incomplete.
- **DO** target ≥ 80 % line coverage on `src/lib/core/**` and `src/lib/domains/**`. Coverage is a floor, not a goal.
- **DO** unit-test pure logic with Vitest (`*.test.ts` co-located).
- **DO** test domain stores by calling the factory directly with stub deps (see `state-management.md`).
- **DO** mock HTTP with MSW for component tests. Do not stub `fetch` by hand.
- **DO** test the realtime path with a fake `EventSource` driver so events can be injected deterministically.
- **DO** write Playwright e2e specs under `e2e/` for critical flows: login, list+paginate, mutate, logout, locale switch. Filename pattern is `*.e2e.ts` (not `*.spec.ts`) so Bun's built-in test runner does not pick them up — see `## Runner separation` below.
- **DO** run `bun run test` (Vitest) and `bun run test:e2e` (Playwright) in CI; both must be green to merge.

## DON'T

- **DON'T** test implementation details. Test behavior visible to a real consumer.
- **DON'T** snapshot complex DOM trees as the primary assertion. Snapshots are a backup, not a contract.
- **DON'T** mock the unit you are testing.
- **DON'T** silence flaky tests with retries. Find the race; fix the test or the code.
- **DON'T** skip Playwright in CI because "it is slow." A boilerplate without an e2e signal is not a boilerplate.

## Pattern

### Vitest (unit / store)

```ts
import { describe, it, expect } from 'vitest'
import { createCameraStore } from '$domains/camera/store.svelte'

describe('cameraStore.filter', () => {
  it('debounces search input', async () => {
    const store = createCameraStore({ clock: fakeClock })
    store.handleSearch('cam', 300)
    expect(store.search).toBe('cam')
    expect(fakeClock.pendingTimers).toBe(1)
  })
})
```

### MSW for HTTP

```ts
// tests/setup.ts
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
export const server = setupServer(
  http.get('/api/upstream/cameras', () => HttpResponse.json({ data: [], page_info: {} }))
)
```

### Fake EventSource for SSE

```ts
class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = []
  constructor(public url: string) { super(); FakeEventSource.instances.push(this) }
  emit(event: string, data: object) {
    this.dispatchEvent(new MessageEvent(event, { data: JSON.stringify(data) }))
  }
  close() {}
}
globalThis.EventSource = FakeEventSource as any
```

### Playwright (e2e)

```ts
test('login + list + logout', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('alice@example.com')
  await page.getByLabel('Password').fill('correct horse battery staple')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Cameras' })).toBeVisible()
})
```

## CI gates

| Gate | Tool | Failure means |
|---|---|---|
| Typecheck | `svelte-check` | Compile error |
| Lint | `eslint .` | Style or rule violation |
| Unit | `bun run test` | Logic regression |
| e2e | `bun run test:e2e` | User flow broken |
| Build | `vite build` | Bundle/SSR regression |
| Codegen | `bun run codegen:check` | Spec drift |

All gates must be green to merge.

## Runner separation

Two different runners live in this repo. They look alike but are not the same.

| Command | Runner | Scope |
|---|---|---|
| `bun run test` | Vitest (via `package.json` script) | Unit tests in `src/**/*.test.ts` |
| `bun run test:e2e` | Playwright | End-to-end specs in `e2e/**/*.e2e.ts` |
| `bun test` | Bun's built-in test runner | **Not used.** Globs `*.{test,spec}.{ts,tsx,js,jsx}` repo-wide and has no path-exclude config. |

Rules:

- **DO** name Playwright specs `*.e2e.ts`. The `.e2e.ts` suffix is what keeps `bun test` from collecting them, since Bun's built-in runner would otherwise execute Playwright's `test()` outside its driver and fail with `Playwright Test did not expect test() to be called here`.
- **DO** name Vitest unit tests `*.test.ts` and co-locate them next to the unit under test.
- **DON'T** use `*.spec.ts` anywhere — that filename is reserved for the now-unused Bun built-in runner pattern, and adding one would re-introduce the runner collision.
- **DON'T** invoke `bun test` directly. Use the script form (`bun run test` or `bun run test:e2e`).
