---
alwaysApply: true
description: >
  Logging and observability for ${PROJECT_NAME}: pino on the server, leveled
  client wrapper, request id propagated end-to-end, no committed console.log.
---

# Observability Rule

## DO

- **DO** use `core/logger` everywhere. The logger picks pino on the server and a leveled console wrapper on the client.
- **DO** log structured fields, not concatenated strings:
  - `logger.info({ reqId, userId, route }, 'request handled')`
- **DO** generate a request id in `hooks.server.ts` (UUID v7 or crypto random) and put it on `event.locals.reqId`. Include it in every log line and forward it to upstream as `x-request-id`.
- **DO** ship client errors through `hooks.client.ts`'s `handleError` and the logger.
- **DO** include the request id in error toasts as a small affordance ("Code: abc123") so users can quote it in support.
- **DO** redact tokens, session ids, full email addresses, and PII at the sink.

## DON'T

- **DON'T** commit `console.log`. Use the logger. CI should fail on raw `console.*` outside test files (lint rule).
- **DON'T** log entire request or session objects. Pick fields.
- **DON'T** log secrets, even at debug level. Once a secret hits a log sink, treat it as compromised.
- **DON'T** log inside hot loops. Aggregate or sample.

## Pattern

```ts
// $core/logger/index.ts
import type { Logger } from 'pino'

export interface AppLogger {
  debug(obj: object, msg: string): void
  info(obj: object, msg: string): void
  warn(obj: object, msg: string): void
  error(obj: object, msg: string): void
  child(bindings: Record<string, unknown>): AppLogger
}
```

Server implementation uses pino (with redaction). Client implementation wraps `console.*` with level gating from `PUBLIC_LOG_LEVEL`.

## Request id flow

```
client request ─► hooks.server.ts (mint reqId) ─► +page.server.ts load ─► BFF ─► upstream
                                                                                  │
                            client logs (reqId) ◄── response (x-request-id) ◄────┘
```

Every log line on the path carries the same id. Searches across server + upstream logs join on it.

## Error reporting hook

```ts
// hooks.server.ts
export const handleError = ({ error, event }) => {
  logger.error({ reqId: event.locals.reqId, err: serializeError(error) }, 'unhandled')
  return { message: 'Internal error', code: 'INTERNAL', reqId: event.locals.reqId }
}
```

The returned object becomes `App.Error` which `+error.svelte` renders.

## Levels

| Level | Use for |
|---|---|
| `debug` | Verbose dev tracing; off in prod |
| `info` | One-per-request happy path; key state transitions |
| `warn` | Recoverable anomalies; missing optional config; deprecation use |
| `error` | Unhandled errors; failed external calls after retries |

Anything above `error` (fatal) should crash the process and let the supervisor restart.

## Quick reference

| Symptom | Likely cause | Fix |
|---|---|---|
| `console.log(token)` in client bundle | Wrong tool | Use logger, redact |
| Logs cannot be correlated across services | No reqId propagation | Add `x-request-id` in BFF + upstream |
| Hot path floods logs | Logging in a loop | Sample or aggregate |
| PII in logs | Missing redaction | Configure pino redaction at the sink |
