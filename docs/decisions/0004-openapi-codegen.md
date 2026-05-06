# 0004 — Codegen-First API Contracts (OpenAPI → TypeScript)

- **Status:** Accepted
- **Date:** 2026-05-06
- **Deciders:** Sora, Kaito, Ren
- **Tags:** api, types, codegen

## Context

Hand-written Zod schemas for response shapes drift the moment the backend renames a field. The previous project paid this tax frequently. The reference backend exposes an OpenAPI spec.

## Options considered

### Option A — Hand-written Zod schemas
Pros: no extra tooling.
Cons: drift; duplicated work; impossible to enforce consistency at scale.

### Option B — `openapi-typescript` for static types + Zod for runtime parsers where needed
Pros: types track the spec automatically; Zod still available for boundaries that need runtime validation (forms, untrusted JSON).
Cons: must commit and version the OpenAPI snapshot; need a `bun run codegen` step in CI.

### Option C — Full SDK generators (`orval`, `openapi-codegen`)
Pros: typed clients out of the box.
Cons: heavier output; more opinions baked in; harder to integrate with our endpoint registry pattern.

## Decision

**Option B**. We snapshot the upstream OpenAPI under `openapi/<service>.yaml`, run `openapi-typescript` into `src/lib/generated/<service>.ts`, and reference those types from our endpoint registry. Runtime Zod parsers are written **only** for inputs we do not trust (form submissions, query params, BFF inbound, any payload that may have been shaped by clients). For `200 OK` responses from a trusted upstream, the static types are enough.

## Consequences

Easier:
- field renames on the backend produce compile errors on the frontend within one codegen cycle
- refactors are safe across repos

Harder:
- CI must run codegen and fail on drift
- contributors must remember to regenerate after pulling spec updates (lefthook hook)

Revisit if:
- The backend stops publishing OpenAPI.
- We adopt a tRPC or Connect-style typed RPC instead of HTTP+OpenAPI.

## Compliance

- Rule: `.claude/rules/api-contract.md`
- Obsidian wiki: [[OpenAPI Codegen for SvelteKit]], [[Endpoint Registry Pattern]] (frontend domain)
