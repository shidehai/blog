# Frontend Quality Guidelines

## Required Commands

`package.json` defines one aggregate gate:

```bash
pnpm verify
```

It runs Prettier check, ESLint, Astro type checking, Vitest, the production
Astro/Pagefind build, and Playwright in that order. Keep each focused script
independently runnable for diagnosis.

## Test Shape

- Unit tests cover non-trivial boundary logic with the smallest useful case;
  `tests/unit/env.test.ts` proves permissive fixture mode and fail-closed secret
  modes.
- Browser tests prove observable output; `tests/e2e/smoke.spec.ts` checks both
  the page heading and `/healthz` response.
- A passing build includes Pagefind indexing from `dist/client`, not merely
  Astro compilation.
- Material-system changes extend `tests/e2e/visual-contract.spec.ts` with
  computed geometry/style, responsive-boundary, overflow, and interaction
  assertions. Retained screenshots support human comparison but never replace
  semantic browser assertions.
- Responsive overflow tests assert both document `scrollWidth <= clientWidth`
  and that no visible element bounding box crosses the viewport beyond the
  test tolerance. Page-level `overflow-x: clip` can hide the latter from the
  width check. Exempt only descendants of named intentional scrollers, such as
  `.code-frame pre` and `.table-wrapper`, and only when the ancestor's computed
  `overflow-x` is `auto` or `scroll`.

## Formatting Scope

`.prettierignore` excludes Trellis/platform files and product/planning
documents. `pnpm format` must format application-owned code only; never create
large documentation-only diffs as a side effect of a code change.

## Forbidden Patterns

- No theme, UI kit, page builder, local Markdown store, or global client runtime.
- No test that only restates its implementation.
- No public route that silently becomes runtime-rendered.
- No dependency when an Astro, browser, CSS, or standard-library feature covers
  the behavior.
