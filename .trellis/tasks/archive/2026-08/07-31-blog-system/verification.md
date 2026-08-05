# Verification: Personal Blog System

Date: 2026-08-05 (Asia/Shanghai)

## Verdict

The local implementation and its fixture-backed release contracts are ready.
Production acceptance is not claimed: Directus fine-grained permissions,
GitHub/GHCR/VPS deployment, off-VPS recovery, and owner content require external
credentials, infrastructure, and licensing evidence that are not available in
this repository.

Status meanings:

- **Locally proven**: implementation, automated checks, and any required local
  manual review passed.
- **Partially proven**: the local contract passed, but a Directus- or
  production-backed portion remains.
- **Externally blocked**: acceptance depends on owner-controlled licensing,
  credentials, infrastructure, or real data.

## Acceptance Evidence

| AC | Status | Evidence and remaining boundary |
| --- | --- | --- |
| AC1 | Locally proven | Chromium checks and screenshots cover Home at 320, 768, 1440, and 1920 px in light/dark themes with no overflow, overlap, failed media, console error, or failed request. Current desktop navigation targets measure 46.75 px. Screenshots are under `/tmp/blog-final-visuals/`. Owner identity and launch content remain deferred inputs. |
| AC2 | Locally proven | `tests/e2e/reading.spec.ts` reaches Writing, Notes, a topic, Search, About, Archive, and RSS without authentication. |
| AC3 | Partially proven | Directus schema checks prove one `posts` collection with article, tutorial, and note kinds; fixture routes render kind-specific density. A production Directus-backed build awaits scoped Build Reader permission. |
| AC4 | Locally proven | Reading tests cover outline, anchors, copy feedback, tables, footnotes, callouts, responsive media, related entries, no-JS HTML, print, and mobile disclosure. Desktop/mobile light/dark screenshots confirm the flatter prose plane and shared relief system. |
| AC5 | Externally blocked | Schema versioning and the administrative workflow test pass, but routine Author permissions and Studio upload/preview/publish/edit/revision-restore proof require Directus OIG or commercial entitlement plus owner accounts and MFA. The local workflow test uses the administrator. |
| AC6 | Partially proven | Published-status filtering and archived-row rejection are unit-tested; routes, search, feed, sitemap, metadata, and related output share that snapshot. Anonymous posts, settings, files, users, versions, and revisions all return 403. Scoped Build Reader proof is blocked by the Directus license gate. |
| AC7 | Externally blocked | Local state-machine tests prove candidate isolation, digest-only replacement, interruption recovery, prior-digest rollback, idempotency, and scoped cleanup. A real Directus dispatch, GitHub Actions run, GHCR digest, SSH/VPS deployment, external smoke failure, and under-five-minute latency remain production exercises. |
| AC8 | Locally proven | The production-mode fixture build creates a `zh-cn` Pagefind index for 3 pages, 155 words, and 3 filters. Browser tests prove Chinese matching and that Pagefind is not requested until search input is used. Real owner content remains deferred. |
| AC9 | Locally proven | Axe covers Home, long post, Notes, Search, About, Preview, and 404 with no serious violations. Browser checks cover keyboard focus restoration, skip link, 200% text reflow, 320 px overflow, reduced motion, forced colors, no-JS content, and stable controls. Manual screenshots found no overlap or blank state. |
| AC10 | Locally proven | Unit and browser checks cover canonical, Open Graph, social cards, `BlogPosting`, `WebSite`, `Person`, RSS, sitemap, robots, manifest, icons, `zh-CN`, and timezone-boundary formatting. `AppLayout.astro` selects a post cover before the configured default sharing image. |
| AC11 | Partially proven | Runtime schemas, internal references, unit tests, build, Pagefind, 33 browser tests, Compose/Caddy validation, cached runtime health, and simulated candidate/rollback checks pass. A fresh runtime image build was attempted twice but Docker Hub metadata timed out before project build steps; real VPS preflight/rollback remains external. |
| AC12 | Externally blocked | Anonymous Directus access is deny-all; media scope/current-reference and unsafe-SVG checks pass locally; image-layer inspection finds no supplied token. Directus Core cannot create the required field/item/folder-scoped policies, so `pnpm test:directus-access` intentionally fails until OIG or commercial licensing is activated. |
| AC13 | Externally blocked | Backup/restore state-machine tests cover verified custom dumps, mode-0600 cleanup, manifests, refusal to overwrite, clean-room apply, retention, and stale-backup detection. They use fixture PostgreSQL/Restic commands. A real encrypted off-VPS snapshot, clean VPS restore, stable-URL comparison, and measured 24-hour RPO/four-hour RTO are still required. |
| AC14 | Locally proven | The checked-in Caddyfile passed validation and a local HTTPS proxy run. `pnpm test:headers` proves document/asset/health caching, security headers, and an exact Caddy Basic Auth 401 for unauthenticated preview. Source and browser review find no reader login, comment, reaction, or tracking surface. Repeat against the public domain at launch. |

## Passed Checks

- `pnpm install --frozen-lockfile`
- `pnpm verify`: Prettier; ESLint; Astro check on 79 files with zero
  diagnostics; 8 Vitest files and 52 tests; production Astro/Pagefind build;
  operations state machines; 33 Chromium tests.
- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- `pnpm directus:schema:diff`: no changes to apply.
- `pnpm directus:schema:check` and `pnpm test:directus-workflow`.
- Anonymous Directus GETs for posts, settings, files, users, versions, and
  revisions: all 403.
- `OPS_BUILD_IMAGES=1 sh scripts/validate-operations.sh`: rendered Compose,
  Caddy, and operations image passed.
- Operations image: non-root `backup`, Restic 0.18.0, PostgreSQL client 17.9.
- `scripts/test-runtime-image.sh blog-site:test` and image secret inspection.
- `pnpm test:headers -- --url https://localhost:8443` through the production
  Caddyfile with a local certificate.
- Lighthouse on Home and the long tutorial: 100 Performance, 100
  Accessibility, 100 Best Practices, and 100 SEO for both.
- `git diff --check`.

## Deliberate Failure And External Limits

- `pnpm test:directus-access` exits non-zero with the explicit message that
  Directus Core cannot enforce the required status/folder/field-scoped
  credentials. Do not weaken permissions to make this test pass. Activate an
  applicable OIG/commercial license, rerun bootstrap, and then rerun the test.
- Media Flow behavior still needs the pinned Directus 12.2.0 event matrix for
  moving files into/out of the publishable folder, update, and deletion before
  production activation.
- Fresh `docker build --target runtime --tag blog-site:final .` attempts failed
  while resolving Docker Hub metadata for `docker/dockerfile:1.7` and
  `node:24.15.0-alpine`. Cached runtime and fresh operations images passed; CI
  must repeat the fresh runtime build when Docker Hub is reachable.
- No real GHCR push/pull, forced SSH deployment, VPS candidate switch,
  post-switch rollback, firewall inspection, public-domain header probe, or
  offsite Restic restore was performed.
- Owner name, domain, biography, social links, articles, media, production
  credentials, and alert destination remain deferred launch inputs.

## Prevented Regressions

- Production Compose now fixes runtime `CONTENT_SOURCE=directus`; runtime
  validation rejects a missing source, while Playwright and runtime fixture
  tests opt into `fixture` explicitly.
- The public header test now requires an exact Caddy `401` for unauthenticated
  preview. Astro's trusted-header `404` can no longer mask a missing proxy Basic
  Auth boundary.
