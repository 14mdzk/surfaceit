# 0002 — Component Strategy: Hybrid shadcn-svelte Fork

- **Status:** Accepted
- **Date:** 2026-05-06
- **Deciders:** Yuki, Mei, Kaito
- **Tags:** ui, design-system

## Context

We need a component foundation that:

- ships with sensible accessibility defaults (focus rings, ARIA, keyboard handling)
- gives us full styling control to build a recognizable visual identity
- does not lock us to upstream package upgrade churn

`shadcn-svelte` is "copy-paste components, you own them." It bundles bits-ui logic with Tailwind styling. `bits-ui` is the headless layer alone. `melt-ui` is even lower (builder pattern).

## Options considered

### Option A — shadcn-svelte (locked)
Pros: lowest build cost; mature; well-documented.
Cons: low differentiation (every shadcn app looks alike); tied to shadcn idioms; `add` keeps pulling in their styling decisions.

### Option B — Hybrid: shadcn-svelte init + leaf primitives + own composites
Pros: scaffold tokens and `cn()` from shadcn; only adopt **leaf primitives** (Button, Input, Dialog, Popover, Select, Tooltip, Sonner, Card, Badge, Separator, Skeleton, Label); build composites (DataTable, Form, Sidebar) ourselves; rename `components/ui` → `components/primitives` to signal "we own this code now."
Cons: medium build cost; risk of letting composites bloat into a private framework.

### Option C — bits-ui or melt-ui from scratch
Pros: full control.
Cons: 2–3 weeks before parity with shadcn essentials; design-system discipline must already be mature.

## Decision

**Option B**. shadcn-svelte initializes the design tokens, `cn()`, and a curated set of leaf primitives. We immediately fork the output into our own folder and stop tracking shadcn versions. Composites (DataTable, Form, Sidebar) live in `shared/composites/` and are written here.

## Consequences

Easier:
- visual identity ownership
- token edits without fighting upstream
- predictable upgrade story (we upgrade bits-ui, not shadcn)

Harder:
- composites are our maintenance burden
- adding a new primitive requires Mei + Yuki sign-off (rule in `styling.md`) to prevent surface sprawl

Revisit if:
- shadcn-svelte ships a version with mechanisms to fork-yet-track that change the calculus.
- We discover a composite category (e.g. Combobox) that bits-ui does not cover well.

## Compliance

- Rule: `.claude/rules/styling.md`
- Obsidian wiki: [[Hybrid shadcn Fork Strategy]] (frontend domain)
