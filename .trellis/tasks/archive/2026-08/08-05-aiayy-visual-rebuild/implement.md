# Implementation Plan

## Ordered Checklist

1. **Freeze reference and baseline evidence**
   - Verify the completed public HTML/CSS/JS/font-declaration URL-and-hash
     manifest before using any measured value.
   - Use the retained reference and local screenshots at 390x844, 768x1024, and
     1440x900/1000 for light, dark, compact-header, and mobile-menu states.
   - Record the final calibrated token table and allowed accessibility
     substitutions in task research.

2. **Install the calibrated foundation**
   - Self-host only the Inter subsets/weights used by the UI and include the
     applicable font license.
   - Replace global colors, type scale, radii, widths, gutters, shadows,
     transitions, and responsive breakpoints with the measured token system.
   - Consolidate light/dark declarations and retain system/explicit themes,
     reduced motion, forced colors, print, and 320px support.

3. **Rebuild the shared shell**
   - Update `AppLayout`, `SiteHeader`, `ThemeControl`, and `SiteFooter` props and
     markup for the author-aware fixed capsule, compact state, icon controls,
     two-column native mobile menu, and centered identity footer.
   - Preserve metadata/Pagefind/noindex contracts, prepaint theme selection,
     skip navigation, current-route semantics, and focus restoration.
   - Update hardcoded theme/manifest/favicon/fixture-art palette values without
     changing brand identity or content contracts.

4. **Recompose the homepage**
   - Map real feature, author, notes, topics, writing, Search/Archive/RSS data
     into the reference-measured Hero, information, article, and bottom rows.
   - Refine `FeaturePost` for the measured hero typography/material, real cover
     treatment, and robust media-less fallback.
   - Preserve all empty states, content caps/selection rules, intrinsic media
     dimensions, mixed-script wrapping, and mobile featured-first DOM order.

5. **Migrate discovery routes**
   - Apply shared page-heading, toolbar, row, topic, archive, about, 404, and
     empty-state treatments through existing components and route classes.
   - Keep content-kind grouping, anchors, routes, dates, topic counts, and
     semantic list structure unchanged.

6. **Migrate search and dynamic states**
   - Refactor search's route-local CSS and runtime result markup classes to use
     the calibrated tokens and geometry.
   - Verify default, loading, result, no-result, error fallback, reset,
     URL-restored filters, keyboard behavior, and 320px layout.

7. **Calibrate long-form reading**
   - Update `PostPage`, outline, progress, cover, code, table, callout, figure,
     footnote, related-content, and copy-control styling against the downloaded
     article bundle and browser measurements.
   - Avoid Markdown renderer changes unless existing classes cannot express a
     required structure; preserve Pagefind attributes and JS-off/print behavior.

8. **Add regression coverage**
   - Extend shell tests for exact breakpoint visibility, measured header
     geometry, the `>100px` compact threshold, theme tokens, author/profile
     ordering, 44px hit targets, and no overflow.
   - Add focused visual/computed-style coverage for home, one discovery page,
     search, and one long article in light/dark desktop/mobile states.
   - Keep screenshot artifacts bounded and deterministic; semantic assertions
     remain the primary release contract.

9. **Iterate in the browser**
   - Build the deterministic fixture production output and run it on an unused
     local port when the existing 4321 process is stale.
   - Capture the full comparison matrix and inspect screenshots plus computed
     geometry. Fix typography, spacing, shadows, clipping, overflow, and state
     mismatches until the documented tolerances converge.
   - Test 200% text, keyboard focus, reduced motion, forced colors, print, long
     strings, absent media, and narrow 320px behavior.

10. **Run release gates and hand off the running site**
    - Run formatting, lint, type checking, focused unit/e2e suites, production
      Astro/Pagefind build, operations/CSP checks, axe, and full `pnpm verify`.
    - Rebuild the Directus-backed production output after fixture verification,
      restart the site on the final local port, confirm `/healthz` and core
      routes return 200, and provide the URL plus visual evidence summary.

## Validation Commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm test:components
pnpm test:a11y
pnpm test:search
pnpm test:operations
pnpm test:e2e
pnpm verify
git diff --check
```

Task-local Playwright probes will additionally capture the fixed viewport/theme
matrix and emit computed-style/geometry JSON for comparison with the reference.

## Risky Files And Rollback Points

- `src/styles/global.css`: broadest blast radius. Land token/foundation changes
  before route-specific overrides and rerun shell/reading/search tests after
  each stage.
- `src/layouts/AppLayout.astro`: preserve prepaint script text unless a CSP hash
  update is intentionally included and validated.
- `src/components/SiteHeader.astro`: native Popover focus behavior, compact
  header layout, and 200% text are release-blocking.
- `src/pages/index.astro` and `FeaturePost.astro`: preserve content selection,
  empty states, cover semantics, intrinsic dimensions, and Pagefind exclusion.
- `src/pages/search/index.astro`: its client-created markup and route-local CSS
  can drift from shared components; run all search states after any class change.
- `PostPage.astro` and `src/lib/markdown.ts`: preserve public/preview parity,
  heading IDs, renderer safety, Pagefind fields, and JS-off content.
- Browser/manifest/icon/generated-art color files: change together or retain the
  old values together; partial palette migration is not acceptable.
- Font assets: verify license, local CSP loading, weight availability, preload
  behavior, and no layout shift before relying on them.

No data migration exists. If a stage regresses behavior, revert that isolated
presentation stage and rebuild generated output; do not patch `dist`,
`.generated`, or `public/_media` manually.

## Final Review Gates

- Every PRD acceptance criterion is mapped to screenshot/computed evidence or an
  automated behavioral check.
- Reference-derived constants are traceable to the saved bundle or browser
  measurement, and deliberate deviations are enumerated.
- No reference identity, copy, media, or whole bundled implementation appears in
  product source.
- Full verification passes against a fresh build, then the Directus-backed site
  is rebuilt, started, and smoke-checked for handoff.
