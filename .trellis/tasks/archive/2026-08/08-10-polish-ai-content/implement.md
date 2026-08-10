# Implementation Plan

## Execution Shape

Use two parallel implementation workstreams with disjoint product ownership,
then one integration/check stream. All agents share the repository and must not
revert concurrent changes.

### Workstream A: Canonical content, seed, and media

Ownership:

- `directus/seed/content.mjs` (new)
- `directus/seed/index.mjs`
- `directus/seed/fixtures.mjs`
- `src/lib/content.ts`
- `scripts/generate-assets.ts`
- `scripts/prepare-content.ts`
- generated `public/images/ai-reliability-boundaries*`
- content/media-focused unit and Directus tests

Checklist:

- [x] Define the six topics, 12 posts, joins, legacy IDs, metadata, full original
      Markdown bodies, and topic-driven related relationships once.
- [x] Update fixture/seed settings to `海边的小卖部` / `关山`, remove the known
      fake social destination, and keep copy free of invented biography claims.
- [x] Integrate the canonical builder into fixture mode and Directus idempotent
      upserts; archive only known legacy posts and eliminate archived joins.
- [x] Generate and commit the responsive AI reliability diagram; update the
      digest-addressed seed helper and explicit fixture media mapping.
- [x] Update content, media, seed, metadata/discovery/export, and representative
      route expectations affected by the new catalog.
- [x] Run focused formatting, lint/type checks, unit content/media tests, build,
      and Directus seed checks before handoff.

### Workstream B: Frontend precision pass

Ownership:

- `src/components/FeaturePost.astro`
- `src/components/PostListRow.astro`
- `src/components/PostMeta.astro`
- `src/components/PostPage.astro`
- outline progressive-enhancement component/script if needed
- `src/pages/index.astro`
- `src/pages/writing/index.astro`
- `src/pages/search/index.astro`
- `src/pages/about/index.astro`
- `src/styles/global.css`
- frontend-focused browser tests that do not hardcode the final catalog

Checklist:

- [x] Replace fixture/build chrome and make the no-media feature fallback
      content-aware without changing approved geometry.
- [x] Remove homepage intro clamping and verify expanding CMS copy.
- [x] Add kind/context editorial rhythm to shared rows and subordinate related
      writing without adding a variant factory.
- [x] Correct card/row hover, focus, and pressed affordances to match real links.
- [x] Scope Pagefind excerpts to body prose and render safe contextual matches
      without duplicated header metadata.
- [x] Add conditional visible update metadata aligned with machine metadata.
- [x] Add accessible current-section outline behavior and remove duplicate
      mobile directory labeling while preserving no-JS use.
- [x] Reduce content-unearned About whitespace and keep long-content expansion.
- [x] Strengthen visible-element overflow checks and add targeted semantic
      coverage for the objective defects.
- [x] Run focused formatting, lint/type checks, build, and frontend browser tests
      before handoff.

## Integration Sequence

- [x] Merge both workstreams through the shared working tree and inspect every
      overlapping test expectation before editing it.
- [x] Build the final fixture and Pagefind index; confirm all 12 detail routes,
      six topic routes, RSS, sitemap, archive, and search index.
- [x] Update fixture-specific E2E paths/counts/search terms to the final catalog
      and add dense-content containment, search excerpt, outline, update-date,
      no-JS, print, dark-state Axe, and overflow assertions.
- [x] Run `pnpm format` only on application-owned files changed by the task, then
      run `pnpm format:check`, targeted ESLint, `pnpm typecheck`, focused Vitest,
      `pnpm build`, and focused Playwright suites.
- [x] Start PostgreSQL/Directus with the explicit root env file, apply existing
      schema/bootstrap prerequisites as available, seed twice, run schema/access/
      workflow checks where licensed, and perform a Directus-backed build.
- [x] Do not weaken the license guard if custom Directus permissions remain
      unavailable; report an entitlement-limited check separately.

## Final Quality Gate

- [x] Run full `pnpm verify` from a fresh production fixture build.
- [x] Run relevant operations/CSP checks if any inline Astro script changes.
- [x] Run the final screenshot/canvas-free visual matrix from
      `research/visual-validation.md`, including desktop/mobile and light/dark
      home, discovery, reading, note, topic/archive, search, About, menu/header,
      and outline states.
- [x] Inspect screenshots for hierarchy, text fit, repeated-card monotony,
      clipped identifiers, broken media, overlap, theme parity, and first-
      viewport reading priority. Record evidence under task `research/`.
- [x] Verify `git diff --check`, review the complete diff for accidental fixture
      identity/data loss, and confirm unknown Directus records are never targeted.

## Rollback Points

- Content rollback: revert the canonical dataset/fixture integration and rebuild;
  old deterministic posts and media remain recoverable because they are archived
  or unreferenced, not broadly deleted.
- UI rollback: revert shared component/style changes while retaining the new
  catalog; material constants and existing visual contracts provide the baseline.
- Seed rollback: explicitly restore known legacy statuses/joins by ID only. Never
  reset PostgreSQL, remove `.data`, delete volumes, or prune Docker state.

## Review Gates

1. Content module parses and builds before UI integration.
2. UI semantics and material contracts pass against the dense fixture.
3. Fixture and Directus catalogs match before final browser capture.
4. Full verification and human screenshot review pass before commit/archive.
