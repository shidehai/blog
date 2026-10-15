# Infrastructure verification

## 1. Scope / Trigger

API/DB/contracts, Docker/Compose/Caddy/CI, backup or migration changes. Main AI
conversation only, all execution serial.

## 2. Signatures

```sh
CMS_TEST_DATABASE_URL=postgres://.../author_cms_test pnpm verify
CMS_TEST_DATABASE_URL=postgres://.../author_cms_test pnpm test:runtime
sh scripts/validate-operations.sh
docker build --target runtime --tag blog-site:test .
docker build --target cms-runtime --tag blog-cms:test .
sh scripts/test-runtime-image.sh blog-site:test
sh scripts/test-cms-image.sh blog-cms:test
CMS_READ_TOKEN=<synthetic-marker> sh scripts/assert-image-secret-free.sh blog-site:test
CMS_READ_TOKEN=<synthetic-marker> sh scripts/assert-image-secret-free.sh blog-cms:test
```

## 3. Contracts

DB tests destroy only explicitly selected local _test schemas; do not run while
preview shares that schema. test:runtime --preview retains synthetic production
processes for visual checks; report lifecycle accurately. Source instances are
read-only evidence. CMS image smoke removes only its own temporary containers.

Images build without secrets/content services; run read-only/non-root. Image
smokes also assert bundled license/copyright and native-library notices exist. CMS smoke
provisions restricted role, exercises Sharp/auth/publish/CLIs and denies legacy
sentinel reads. Secret scans inspect config/history/layers; CI additionally audits
dependencies and images. No marker scan alone proves build-time secret consumption.

Runtime checks verify never-built formerly-404 slug, list/category/series/search,
draft isolation/update/archive/media, writing 308, outage 503, unchanged build/PIDs.
Browser checks separately prove focus/history/cached404, image insertion, conflict
and responsive design. Full recovery compares actual bytes and re-exported data.
Reconciliation gaps block declaring lossless cutover despite successful builds.

## 4. Validation & Error Matrix

| Check | Passing evidence |
| --- | --- |
| App gates | Real files selected; DB tests not skipped when claimed |
| Runtime publishing | New/update/withdrawn observed, unchanged build/PIDs |
| Restricted role | Startup works, legacy SELECT denied |
| Media | Private404 → exact published bytes200 → revoked404 |
| Recovery | Separate restored manifest/files equal source export |
| Registry outage | Record unverified result, retain security contract |

## 5. Good / Base / Bad Cases

- Good: sequential app/container/browser checks with honest migration gaps.
- Base: focused checks; repeat only checks affected by changes/failures.
- Bad: fixture build alone, skipped DB coverage, or claiming unexecuted UI gestures.

## 6. Tests Required

Run the applicable commands above. Publication/storage need DB+production runtime;
cache/navigation need browser checks; infra needs proxy/backup checks. Root gate covers only active CMS, fixture, Markdown and operations behavior;
retired seed/launch tests are removed. Backup regressions prove CMS-only format 2
round-trip with originals, format 1 compatibility, missing media/unknown format
refusal and preservation of nonempty targets. Deployment requires final frozen-source reconciliation.

Standalone setup: run `tests/ops/vps-setup.test.sh`, render the root model with
`validate-compose.mjs --standalone`, and run the CMS image smoke against the shared
empty-volume role initializer. Exercise fresh setup plus repeat setup/import in
isolated Compose projects; compare owner/session state, content and actual media.
Previously scanned images may be reused when only orchestration changes; report
that scope and do not claim a new image scan or real HTTPS acceptance.

## 7. Wrong vs Correct

Wrong: `pnpm build` proves immediate publication/restore.
Correct: build once, run services, publish/revoke and compare build/PIDs; separately
restore full bytes. Regenerate consumed files via temp+rename only on success.
