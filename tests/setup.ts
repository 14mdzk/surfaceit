/**
 * Vitest global setup — MSW server lifecycle.
 *
 * This file is listed in `vitest.config.ts → test.setupFiles`. Vitest runs it
 * once per worker before any test file runs, registering `beforeAll / afterEach
 * / afterAll` at the root suite level.
 *
 * Test files that need to call `server.use()` should import `server` from
 * `tests/msw.ts` (not this file) to avoid double-registration of lifecycle
 * hooks.
 *
 * Conformance: rule .claude/rules/testing.md (mock HTTP with MSW;
 * do not stub fetch by hand).
 *
 * `globals: false` in vitest.config.ts means lifecycle hooks must be imported
 * explicitly from 'vitest'.
 */
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './msw.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
