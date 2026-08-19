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
- Search race regressions hold the Pagefind module request, clear the query,
  then release the request and assert that stale results cannot replace the
  restored default state.
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

## Reading Experience Regression Contract

Reading-surface changes are cross-layer when Markdown becomes generated HTML
and then receives native browser enhancement. Keep the following executable
checks with any change to `src/lib/markdown.ts`, `src/lib/mermaid.ts`, or
`CodeCopyBehavior.astro`:

- Assert generated Mermaid output is an inline SVG and contains no `<script>`
  or remote paint/font resource. Browser coverage must measure the rendered SVG
  bounding box; checking only that an SVG tag exists can miss a blank diagram.
- Assert malformed Mermaid rejects with the source label and line number. Do
  not replace official Mermaid parsing with a partial regex parser that accepts
  invalid connectors.
- Assert long code is complete in the initial HTML, in a no-JavaScript browser,
  and in print. JS-only tests must additionally check `aria-controls`,
  `aria-expanded`, and the transition back to the collapsed state.
- Assert heading-link and share/citation URLs use the article's public
  `post.route`, including preview routes, rather than reconstructing a route
  from the current browser pathname.
- Run `pnpm audit --prod` when changing the Mermaid renderer or its JSDOM
  dependencies; do not introduce a transitive package with known production
  vulnerabilities merely to obtain server-side SVG measurement.
