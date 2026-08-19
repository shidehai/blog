# Implementation Plan

## Execution Shape

This remains one implementation task because preview environment wiring and the
editorial launch boundary converge on the same build/runtime/Directus validation
matrix. Real infrastructure deployment is a separate future task and is not a
child blocked inside this task.

## 1. Establish Regression Baselines

- [x] Reproduce direct `pnpm dev` fixture preview and retain a focused failing
      assertion for the generic Astro error response caused by incomplete
      runtime configuration.
- [x] Record current fixture catalog, timestamps, settings, media, routes,
      search/feed/metadata projections, and isolated Directus state without
      printing secrets or Markdown bodies.
- [x] Confirm the current dirty worktree changes are Trellis-owned/unrelated and
      keep application edits scoped away from them.

## 2. Make Development Runtime Explicit

- [x] Add a small development launcher that loads optional untracked `.env`,
      supplies complete local fixture values only at the entrypoint, validates
      `readRuntimeEnv()`, starts Astro dev, and propagates signals/exit status.
- [x] Update `package.json` lifecycle commands so content preparation and Astro
      dev receive the same selected fixture/Directus environment exactly once.
- [x] Update `deploy/compose.dev.yaml` and `.env.example` with complete explicit
      fixture defaults and an opt-in Directus-backed development path; keep
      production Compose fixed to Directus.
- [x] Extend environment, Compose, preview, and operations tests for fixture,
      Directus, missing-field, untrusted, and trusted cases.
- [x] Verify direct fixture preview and Directus-backed preview use the existing
      `PostPage` path and never expose preview credentials.

## 3. Extract Editorial Planning And Classification

- [x] Extract pure canonical payload comparison, field ownership, state
      classification, launch timestamp scheduling, stable serialization/digest,
      and confirmation parsing from transport code.
- [x] Keep the canonical bodies/IDs/topics/joins defined only in
      `directus/seed/content.mjs`; parameterize the production projection without
      changing deterministic fixture output.
- [x] Add unit tests for unique ordered launch timestamps, manifest stability,
      absent/fixture/launched/owner-modified states, avatar/social preservation,
      unknown-record preservation, and redacted errors.

## 4. Guard Development Fixture Installation

- [x] Add an explicit fixture confirmation and validate the target Directus
      origin/required administrator credentials before any request that mutates.
- [x] Move the complete known-record preflight before media upload or item
      writes. Permit only a fresh or exact deterministic fixture target.
- [x] Make exact unchanged state a no-op and reject launched, owner-modified, or
      ambiguous partial known state before mutation.
- [x] Keep exact-ID legacy fixture behavior and immutable digest-addressed media;
      remove any mutation that could clear a real avatar or owner social link.
- [x] Update `directus:seed` documentation/scripts and isolated Directus tests to
      prove rerun stability and sentinel preservation.

## 5. Add One-Time Launch Plan And Apply

- [x] Add a read-only launch-plan command accepting an explicit UTC base time and
      producing a mode-0600 ignored manifest with target, ordered IDs/timestamps,
      owned payload digests, allowed transitions, and overall digest.
- [x] Add an apply command requiring the exact manifest and target-specific
      confirmation. Repeat preflight immediately before the first mutation.
- [x] Apply immutable media, settings/topics, posts, joins, and exact legacy
      transitions in dependency order; preserve avatar, owner socials, and every
      unknown record.
- [x] Re-read the complete projection after apply. Same-manifest retry must be a
      no-op; changed/owner-edited state must fail with bounded recovery guidance.
- [x] Ensure output contains counts, record IDs, phases, and manifest digest only;
      never tokens, headers, passwords, bodies, or full environment data.

## 6. Prove The Release Package

- [x] On an isolated local Directus database, run fixture install twice, launch
      dry-run, launch apply, same-manifest retry, sentinel checks, and rejection
      scenarios. Do not alter any unrelated existing local database.
- [x] Build from the launched Directus snapshot and compare the 12-piece catalog,
      topics, slugs, bodies, media, related items, search, RSS, sitemap, export,
      Open Graph, JSON-LD, and preview against the accepted projection.
- [x] Verify the public dates are the launch manifest dates, fixture dates remain
      deterministic in fixture builds, and no false visible `更新于` is created.
- [x] Verify no avatar/social remains a deliberate rendered state and later
      owner-added values survive verification/import reruns.

## 7. Documentation And Durable Contracts

- [x] Update README/Directus documentation to distinguish schema/bootstrap,
      development fixture installation, launch plan/apply, and routine Directus
      authoring.
- [x] Add a production launch runbook covering prerequisites, safe commands,
      expected evidence, abort conditions, and the external VPS/domain/DNS/TLS/
      registry/backup/alert gates deferred to the future deployment task.
- [x] Update `.trellis/spec/backend/database-guidelines.md` and relevant
      environment/quality specs with the post-launch non-overwrite contract and
      exact verification scenarios.

## 8. Quality And Review Gates

- [x] Run focused formatting only on application-owned changed files.
- [x] Run focused env/editorial/Directus/preview/operations tests after each
      boundary change.
- [x] Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`,
      `pnpm build`, `pnpm test:operations`, and `pnpm test:e2e`.
- [x] Render production and development Compose with an explicit test env; run
      Caddy/CSP validation and runtime-image checks when affected.
- [x] Run Directus schema/access/workflow checks if the stable local licensed
      environment is available; otherwise record the exact entitlement gate and
      retain the isolated non-license evidence.
- [x] Run `git diff --check`, scan generated output/task artifacts for secret
  markers without printing values, and review the full scoped diff.
- [x] Dispatch the Trellis check role for independent spec, data-safety, and
      verification review; resolve every critical/warning finding against code.

## Risk And Rollback Points

- **Environment regression:** never add runtime schema defaults. Roll back the
  launcher/Compose wiring together if either fixture or Directus mode diverges.
- **Known-ID overwrite:** no mutation begins until the full preflight passes.
  Roll back source only; do not attempt broad data cleanup.
- **Partial Directus apply:** retry only with the exact same manifest. If state
  no longer classifies safely, stop for operator review.
- **Timestamp drift:** launch schedules come only from the persisted manifest;
  apply never regenerates time.
- **Media mutation:** originals remain immutable and unreferenced old files are
  not automatically deleted.
- **External state:** no real DNS, VPS, registry, backup repository, alert, or
  production database action is authorized by this task.

## Activation Gate

- [x] PRD has no blocking open question and has completed convergence review.
- [x] `design.md`, `implement.md`, `implement.jsonl`, and `check.jsonl` are
      complete and internally consistent.
- [x] The user explicitly approves the final planning summary in a subsequent
      message before `task.py start` or any product-code edit.
