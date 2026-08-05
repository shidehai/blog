# Implementation Plan: Blog Production Readiness

## Phase 1. Fixture Repair

- [x] Add a side-effect-free Directus seed fixture loader for the committed
      960x540 WebP and digest-addressed title.
- [x] Replace the inline invalid PNG in `directus/seed/index.mjs` without
      changing the immutable-file behavior of `ensureFile`.
- [x] Add a unit regression that transforms the exact seed fixture and checks
      640px/960px deterministic output.
- [x] Update the live Directus schema check for one current digest fixture and
      an optional preserved legacy original.

Validation:

```bash
pnpm test:content
pnpm exec vitest run tests/unit/media.test.ts
pnpm lint
pnpm typecheck
```

Rollback: revert the helper/seed/test changes. No schema or real-content data is
modified.

## Phase 2. Real Local Data Path

- [x] Run `pnpm directus:seed` twice.
- [x] Query the corrected fixture identity and prove settings/post references.
- [x] Run a Directus-backed production build with a short-lived administrator
      session kept only in child-process memory.
- [x] Prove published routes/media/search output exist and the archived fixture
      route does not.
- [x] Scan generated output for the temporary token without printing it.

Validation:

```bash
pnpm directus:schema:diff
pnpm directus:schema:check
pnpm test:directus-workflow
pnpm build
```

Rollback: re-run the prior fake seed only if necessary. Never overwrite or
delete Directus file bytes as part of automated rollback.

## Phase 3. Release Evidence

- [x] Retry the exact runtime Dockerfile.
- [x] If necessary, run a clearly labeled official-mirror diagnostic build
      without editing the committed Dockerfile.
- [x] Exercise the current image's health, non-root/read-only contract, and
      secret scan.
- [x] Run action/workflow checks, dependency audit, operations validation, and
      the strongest available pinned vulnerability scan.
- [x] Run full `pnpm verify` after fixture-mode content is restored.

Validation:

```bash
docker build --target runtime --tag blog-site:final .
scripts/test-runtime-image.sh blog-site:final
pnpm audit --prod --audit-level high
OPS_BUILD_IMAGES=1 sh scripts/validate-operations.sh
pnpm verify
```

Rollback: remove only the explicitly named local diagnostic image if it is no
longer useful. Do not prune unrelated Docker state.

## Phase 4. Evidence And Finish

- [x] Write `verification.md` with AC1-AC8 evidence and unchanged external
      gates.
- [x] Update the archived blog verification only when new evidence changes an
      existing claim; preserve its historical date and distinguish follow-up
      evidence.
- [x] Run Trellis quality check and update specs if a reusable fixture rule was
      learned.
- [x] Commit the work, archive the task, and record the session.

High-risk files:

- `directus/seed/index.mjs`: must preserve immutable original behavior.
- `tests/directus.mjs`: must pass on a clean seed and validate, without
  requiring, the legacy invalid original in migrated local data.
- `src/lib/media.ts`: do not weaken decoding or transform failures to accept a
  malformed fixture.
- `.env`: must remain unmodified and uncommitted.
- Docker verification: alternate registries are diagnostics, not production
  source changes.
