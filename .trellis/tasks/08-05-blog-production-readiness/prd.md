# Blog Production Readiness

## Goal

Close every production-readiness gap that can be proved in the current local
environment after the archived blog task's fixture-only acceptance pass. Keep
license-, VPS-, registry-, and owner-controlled evidence explicit rather than
weakening the original acceptance criteria.

## Background

- The archived task is `.trellis/tasks/archive/2026-08/07-31-blog-system`.
- Its local fixture gate passed, but a real Directus-backed build on 2026-08-05
  failed while transforming seeded file
  `0735bdc0-1d07-4607-a568-e57a00c1f994`.
- Directus reports that file as a 70-byte, 1x1 PNG. Sharp can read its metadata,
  but libpng fails while generating the 1px WebP variant.
- The seed embeds those bytes directly. Existing seed behavior intentionally
  does not replace file bytes, so a corrected fixture must receive a new file
  identity and update references.
- Directus/PostgreSQL are healthy locally. Administrator login succeeds, but
  Build, Preview, and Author static tokens return 401 because the required
  custom policies are unavailable under Directus Core.
- Docker Hub metadata requests still time out before a fresh runtime build
  begins. No production VPS target or Directus license key is configured.

## Requirements

### R1. Immutable Valid Media Fixture

- Seed a decodable, transformable raster fixture from a committed repository
  asset rather than an opaque inline byte string.
- Derive the fixture title from a stable digest of its bytes. Re-running the
  seed with identical bytes reuses the same Directus file; changing bytes
  creates a new identity.
- Never overwrite the old invalid original. Re-seeding must redirect settings
  and post references to the corrected file and leave orphan cleanup as an
  explicit administrator maintenance action.

### R2. Shared Regression Coverage

- The regression test must load the exact asset used by the Directus seed and
  run it through `emitPublicMediaAsset`.
- Assert deterministic WebP variants, intrinsic dimensions, hashed local paths,
  and output files. A metadata-only decode is not sufficient.
- Preserve existing malformed-image rejection and media folder rules.

### R3. Directus-Backed Publication Proof

- Run the seed twice and prove idempotency for the digest-addressed fixture.
- Build the current published snapshot from the local Directus API, including
  media emission, Astro prerendering, and Chinese Pagefind indexing.
- A temporary administrator session may be used only as a diagnostic proof of
  the data path. It must not be recorded as Build Reader or AC12 permission
  evidence, persisted to disk, emitted to logs, or embedded in output.
- Prove archived records remain absent from generated routes and discovery
  output in the Directus-backed build.

### R4. Release Tooling Evidence

- Retry the exact checked-in runtime Dockerfile. If Docker Hub remains
  unavailable, an alternate registry may be used only for a clearly labeled
  local build diagnostic; production Dockerfile sources and pinning must not be
  silently changed.
- Exercise the resulting current runtime image as non-root with a read-only
  root, health checks, explicit fixture runtime source, and secret-layer scan.
- Run workflow syntax/static checks and the strongest available vulnerability
  scan without treating an unavailable external registry as a code failure.

### R5. Truthful Completion Record

- Update the verification evidence with the real Directus-backed result and
  current image evidence.
- Keep Directus OIG/commercial permissions, real GHCR/SSH/VPS deployment and
  rollback, public-domain checks, off-VPS Restic restore, and owner content as
  external launch gates until they are actually exercised.

## Acceptance Criteria

- [ ] AC1: The seed no longer contains the invalid inline PNG and derives a
      stable identity from a committed raster fixture's bytes.
- [ ] AC2: Running the seed twice creates one corrected fixture identity, and
      `site_settings.default_og_image` plus the featured post reference it.
- [ ] AC3: A regression test transforms the exact seed fixture into expected
      deterministic responsive WebP variants.
- [ ] AC4: A local Directus-backed production build succeeds through media
      preparation, Astro, and `zh-cn` Pagefind indexing without generating the
      archived fixture route.
- [ ] AC5: No temporary administrator access token appears in generated files,
      process output, Git changes, or image inspection evidence.
- [ ] AC6: `pnpm verify`, Directus schema/workflow checks, Compose/Caddy checks,
      dependency audit, and `git diff --check` pass after the change.
- [ ] AC7: A fresh current runtime image is built and exercised, or the exact
      external registry failure is recorded after retries while all locally
      cached/current-image contracts are still checked.
- [ ] AC8: The final verification record distinguishes locally proven work from
      Directus licensing, VPS/GHCR, offsite recovery, and owner-data gates.

## Out Of Scope

- Accepting or activating a Directus license on the owner's behalf.
- Broadening Core permissions or using administrator credentials in production.
- Inventing production VPS, GHCR, DNS, alert, or owner-content values.
- Claiming a local or fixture Restic repository is off-VPS recovery evidence.
- Replacing published user media bytes in place.

## Blocking Open Questions

None for the locally actionable scope. External launch inputs remain explicit
acceptance gates rather than planning questions.
