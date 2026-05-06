---
alwaysApply: true
description: >
  Styling discipline for ${PROJECT_NAME}: Tailwind v4 + forked shadcn-svelte
  primitives + tokens-first design. Composites are ours; primitives are
  curated.
---

# Styling Rule

## Source of truth

- ADR: `docs/decisions/0002-component-strategy.md`
- Obsidian wiki: [[Hybrid shadcn Fork Strategy]] (frontend domain)

## DO

- **DO** use the design tokens (CSS variables) defined in `app.css` and the Tailwind theme. Tokens are the single lever for visual identity.
- **DO** keep primitives (Button, Input, Dialog, Popover, Dropdown, Select, Tooltip, Sonner, Card, Badge, Separator, Skeleton, Label, Textarea) under `src/lib/shared/primitives/`. They are forked from shadcn-svelte and **owned by us**.
- **DO** build composites (DataTable, Form, Sidebar, Paginator, FilterBar, EmptyState, ErrorState) under `src/lib/shared/composites/`. We build these from primitives ourselves.
- **DO** use `cn(...)` (`src/lib/shared/utils/cn.ts`) for conditional class merging. Combines `clsx` + `tailwind-merge`.
- **DO** keep components prop-light. A component with more than ~6 props is probably two components.
- **DO** use `children` snippets and named slots for composition rather than prop-bag configuration.
- **DO** ensure every interactive primitive has a focus ring, an accessible label, and keyboard support before merging.

## DON'T

- **DON'T** add a new primitive without sign-off (Yuki + Mei in the team protocol). Primitives are a curated surface, not a buffet.
- **DON'T** `bunx shadcn-svelte add <composite>`. We do not import composites; we build them.
- **DON'T** track shadcn-svelte versions or run `shadcn-svelte diff`. Once forked, the code is ours.
- **DON'T** write inline custom CSS in components when a Tailwind utility exists. Inline custom CSS is a smell that a token is missing.
- **DON'T** introduce a second styling system (CSS modules, styled-components-equivalent). One way to style.
- **DON'T** use arbitrary values (`text-[#ff00aa]`, `mt-[13px]`) for design tokens. If you need a value that is not in the scale, the scale is wrong — propose a token addition.

## Composite discipline

- A composite may compose primitives. It may not depend on another composite — flatten via primitives.
- Each composite has one named responsibility. Name it after that responsibility.
- A composite that fetches data violates the rule. Fetching is the consumer's job.
- Slots and snippets over prop bags.

## Tokens to spend a day on, on day one

- Color (chromatic identity, dark/light pairs)
- Motion (duration, easing)
- Density (base font size, line height, control heights)
- Radius scale
- Elevation scale (shadows)

## Accessibility floor

- Lighthouse a11y score ≥ 95 on the reference shell.
- All interactive elements reachable by keyboard.
- Visible focus indicator on every focusable element.
- Color contrast meets WCAG 2.2 AA.
- `prefers-reduced-motion` honored on motion-heavy components.

## Quick reference

| Want to… | Do this |
|---|---|
| Add a primitive | Get sign-off → fork from shadcn-svelte → place in `shared/primitives/` |
| Add a composite | Build from primitives in `shared/composites/` |
| Tweak the look | Edit tokens in `app.css` first; only then components |
| Use an arbitrary value | Step back; either propose a token or pick the nearest scale value |
