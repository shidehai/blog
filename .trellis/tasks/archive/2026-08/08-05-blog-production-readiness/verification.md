# Verification: Blog Production Readiness

Date: 2026-08-05 (Asia/Shanghai)

## Verdict

Every locally actionable requirement in this follow-up task is proven. The
invalid seeded PNG was replaced by a digest-addressed committed WebP, a real
Directus-backed production build now completes through media transforms and
Chinese Pagefind indexing, and a current-source runtime image was built and
exercised through the documented official-mirror diagnostic path.

This is not production launch acceptance. Directus fine-grained policies, a
real GitHub/GHCR/VPS release and rollback, off-VPS recovery, public DNS/HTTPS,
and owner content still require external licensing, credentials, systems, and
data.

## Acceptance Evidence

| AC | Status | Evidence |
| --- | --- | --- |
| AC1 | Proven | `directus/seed/fixtures.mjs` reads the committed 13,242-byte 960x540 WebP and derives title suffix `d2e58e6a40b9` from SHA-256. `directus/seed/index.mjs` contains no inline PNG bytes and preserves `ensureFile`'s no-byte-overwrite behavior. |
| AC2 | Proven | Two consecutive `pnpm directus:seed` runs kept exactly one new file, ID `ea187623-0924-4693-b7dd-ba93697f611d`. Both `site_settings.default_og_image` and the featured article reference it. The old 70-byte PNG `0735bdc0-1d07-4607-a568-e57a00c1f994` remains present and unreferenced. |
| AC3 | Proven | `tests/unit/media.test.ts` imports the seed helper and emits deterministic 640x360 and 960x540 WebP files, validates their hashes, paths, bytes, dimensions, MIME type, srcset, and malformed-record failures. The focused file has 6 passing tests; the full suite has 52. |
| AC4 | Proven locally | An in-memory administrator session built from local Directus: 3 published posts, 1 media record, both responsive media files, all expected Astro routes, and Pagefind `zh-cn` with 3 pages and 173 words. The archived record and fixture-only route are absent from generated input, route files, RSS, sitemap, and decoded Pagefind fragments. Administrator use is diagnostic data-path evidence only, not Build Reader permission evidence. |
| AC5 | Proven | The Directus wrapper buffered output before display, scanned Git-visible files plus `.env`, `.generated`, `.astro`, `dist`, and `public/_media`, including gzip payloads, then logged out. It reported `directus build and ephemeral credential scan status=success`. The current image also passed metadata/layer secret inspection. No temporary administrator token was printed, written, committed, or passed as a Docker build argument. |
| AC6 | Proven | `pnpm verify`, Directus schema dry-run/check/workflow, Compose/Caddy validation, current operations-image validation, production dependency audit, workflow static contracts, checksum-verified actionlint, and both Git diff checks passed. `pnpm test:directus-access` fails at its deliberate Core-license assertion before scoped operations, preserving the external gate. |
| AC7 | Proven with documented mirror diagnostic | Three exact checked-in Dockerfile builds failed before project layers while resolving `docker/dockerfile:1.7` from Docker Hub. Without editing the Dockerfile, an in-memory Dockerfile used the official ECR Node mirror and built current image `sha256:22175843ed26d1622c19a3441bd82e265012286c5f1cf657281074f4b3a7f202`. Health, non-root `node`, read-only root, dropped capabilities, and secret-layer tests passed. A pinned GHCR Trivy pull stalled after partial layers, so no image vulnerability result is claimed; `pnpm audit --prod --audit-level high` found no known vulnerabilities. |
| AC8 | Proven | This record keeps Directus OIG/commercial access policies, real dispatch/GHCR/SSH/VPS deployment and rollback, public-domain checks, encrypted off-VPS restore/RPO/RTO, and owner identity/content as external launch gates. |

## Directus Evidence

- Directus 12.2.0 and PostgreSQL 17.9 were healthy.
- `pnpm directus:schema:diff`: no changes to apply.
- `pnpm directus:schema:check`: passed under the Core license.
- The schema check requires one current digest-addressed cover and verifies the
  settings/featured-post references. On migrated data it also validates that
  the optional legacy PNG is unchanged and unreferenced; clean installs do not
  require that historical file.
- `pnpm test:directus-workflow`: passed and cleaned its temporary records.
- Anonymous posts, settings, and corrected media requests returned `403`.
- Existing Build and Preview static tokens returned `401` because the Core
  instance cannot provision the required custom policies.
- `pnpm test:directus-access` stopped at the explicit licensing assertion. No
  permission rule was weakened and no administrator result is represented as
  scoped-reader evidence.

The corrected Directus file has:

```text
id=ea187623-0924-4693-b7dd-ba93697f611d
title=示例封面（非真实内容，SHA-256 d2e58e6a40b9）
type=image/webp
filename=fixture-cover.webp
filesize=13242
dimensions=960x540
folder=11111111-1111-4111-8111-111111111111
```

## Build And Image Evidence

- The Directus-backed build emitted routes
  `/notes/diagnosable-failures-first/`,
  `/writing/publish-from-content-version/`, and
  `/writing/static-publishing-data-boundary/`.
- `/notes/archived-fixture-note/` and fixture-only
  `/writing/validate-a-published-snapshot/` were absent.
- Emitted media paths ended in deterministic
  `640w-565929a3fa9615bc.webp` and `960w-8ba5c70770b4deef.webp`.
- The checked-in Dockerfile SHA-256 stayed
  `a61886a9cf42888ff82eed2250f30dc2441d05a6a14a736f01a8d9e0b76aa235`.
- The diagnostic base was official ECR Node 24.15.0 Alpine digest
  `sha256:d1b3b4da11eefd5941e7f0b9cf17783fc99d9c6fc34884a665f40a06dbdfc94f`.
- `OPS_BUILD_IMAGES=1 sh scripts/validate-operations.sh` rebuilt the current
  operations image and passed its user, executable, tool, Compose, and Caddy
  contracts.

## Passed Checks

- `pnpm exec vitest run tests/unit/media.test.ts`: 6 tests.
- `pnpm test:content`: 22 tests.
- `pnpm verify`: Prettier, ESLint, Astro check on 80 files with zero
  diagnostics, 52 Vitest tests, fixture Astro/Pagefind build, operations
  state machines, and 33 Chromium tests.
- `pnpm directus:schema:diff` and `pnpm directus:schema:check`.
- `pnpm test:directus-workflow`.
- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- `sh scripts/validate-operations.sh` and the `OPS_BUILD_IMAGES=1` form.
- `scripts/test-runtime-image.sh blog-site:ecr-diagnostic`.
- `scripts/assert-image-secret-free.sh blog-site:ecr-diagnostic`.
- Actionlint 1.7.7 archive checksum
  `023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757`;
  the binary reported no workflow findings. A first wrapper returned non-zero
  only during empty temporary-directory cleanup; the directory was then
  removed explicitly.
- `git diff --check` and `git diff --cached --check`.

## External Launch Gates

- Activate an applicable Directus OIG/commercial entitlement, bootstrap the
  Author/Build/Preview policies, enroll real users in MFA, and pass scoped
  access plus Studio workflow evidence.
- Exercise the pinned Directus media Flow event matrix before enabling real
  dispatch.
- Publish a real GHCR digest, deploy it through forced SSH to the real VPS,
  run candidate/preflight/public smoke checks, and prove post-switch rollback.
- Create an encrypted off-VPS Restic snapshot and complete a clean-room restore
  with stable media checksums and measured RPO/RTO.
- Run public-domain DNS, TLS, header, firewall, cookie, and network checks.
- Replace fixture identity, biography, social links, posts, media, production
  credentials, and alert destinations with owner-controlled values.

## Bug Retrospective

### Root Cause

The primary category was **D: test coverage gap**, compounded by **E: implicit
assumption**. The 70-byte inline PNG exposed readable metadata, but libpng
failed during the real WebP transform. Unit coverage generated a separate valid
image with Sharp, while fixture-mode builds bypassed the bytes uploaded by the
Directus seed. The stable title then correctly preserved the bad immutable
original on every reseed.

### Prevention

| Priority | Mechanism | Action | Status |
| --- | --- | --- | --- |
| P0 | Architecture | One side-effect-free helper owns the exact seed bytes, MIME, filename, and digest identity. | Done |
| P0 | Test coverage | The media regression imports that helper and performs the full 640/960 transform and decode. | Done |
| P0 | Data safety | Byte changes create a new title/file identity; references move, while old originals are not overwritten or deleted. | Done |
| P1 | Integration | A real Directus-backed build verifies seed, API, media, routes, RSS, sitemap, and Pagefind together. | Done locally |
| P1 | Documentation | The immutable media fixture contract is recorded in the backend database spec. | Done |

The same rule applies to every future seeded raster: metadata inspection and a
generated substitute are insufficient. The exact uploaded bytes must survive
the complete production transform path.
