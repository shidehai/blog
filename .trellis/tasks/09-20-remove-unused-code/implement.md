# 实施计划：V2 残留清理与运行时收敛

## Preconditions

- Preserve the pre-task working-tree changes listed in prd.md. Record their
  paths and diff before and after implementation; do not use reset, checkout,
  broad formatting or generated-file cleanup against them.
- Load trellis-before-dev and the frontend/backend specs immediately after task
  activation. The existing specs are known to be stale, so use source and
  executable checks as the authority, then update the specs after verification.
- Do not apply schema/bootstrap commands against a real Directus instance
  without the operator's normal backup and credentials. Repository changes and
  local static checks are safe; production reconciliation is an explicit
  follow-up command.

## Ordered implementation

### 1. Establish the build-time content boundary

- Update frontend-v2/lib/env.ts and the content loading entry point so fixture
  is the explicit default and directus mode requires valid URL/token and fails
  closed on fetch/decode errors.
- Remove topics/posts_topics from frontend-v2/lib/directus.ts schemas, field
  selections, schema declaration, snapshot inputs and fetch fan-out.
- Remove the now-unreachable V2 note rows/topic fields from the local fixture
  while preserving the user's avatar.svg edit; retain the same public article
  fixture behavior.
- Remove unused MOCK_POSTS, MOCK_TOOLS, ToolItem and getTools. Retain
  MOCK_PROFILE only for the fields Directus cannot currently provide, and retain
  projects/activity data that active pages consume.
- Remove rss from the V2 profile/view mapping, fixture/mock fallback and Footer;
  do not alter CMS social-link records.
- Rewrite fixture.selfcheck.mts and snapshot.check.mts to assert the surviving
  public snapshot, strict directus-mode error behavior, decoding constraints,
  categories/tags/series and profile fallback.

Checkpoint: fixture selfcheck succeeds and a repository search shows no V2
consumer of the removed snapshot members.

### 2. Restore the canonical article route

- Add app/archives/[slug]/page.tsx and ArticleClient.tsx by adapting the
  historical article implementation, not by duplicating content mapping.
- Use generateStaticParams, metadata generation and notFound for the canonical
  static route; pass existing post/navigation/heading helpers to the client.
- Retain TOC, reading progress, sharing, Markdown rendering, adjacent-post and
  related-post behavior. Remove the duplicate code-copy effect because
  MarkdownContent already owns it, and remove stale RSS action.
- Add app/writing/[slug]/page.tsx as a static known-post-only
  permanentRedirect wrapper. It must have no catch-all fallback; no root
  writing route is added.
- Change any restored detail-page links to /archives. Verify the existing
  /notes absence remains unchanged.

Checkpoint: Next output contains canonical detail pages and writing redirect
entries; unknown values are absent from static params and reach 404.

### 3. Remove UI/config leftovers without regressing active pages

- Delete CategoriesClient.tsx and the selector used only by its active state.
- Remove unused imports from app/page.tsx and CommandMenu.tsx.
- Replace the inert Tailwind utility strings in CommandMenu, ProjectCard,
  /projects and the root layout with semantic project class names; add the
  minimally equivalent CSS rules outside the user's existing CSS edits.
- Simplify Navbar theme synchronization to the data-theme mechanism used by
  globals.css.
- Remove Tailwind/PostCSS configuration and dependencies, unused next/image
  remotePatterns, then regenerate pnpm-lock.yaml through pnpm.
- Update retained project mock text that describes the deleted Astro frontend.

Checkpoint: all retained pages have real project CSS selectors; no Tailwind
configuration, dependency or utility-class-only styling remains.

### 4. Align build, image, Compose, proxy and CI

- Add a Dockerfile development stage compatible with compose.dev.yaml.
- Make fixture and directus builds explicit: Directus URL/source build arguments
  plus a BuildKit secret mount, hard failure when Directus mode lacks a token,
  and no secret export into a later stage.
- Standardize frontend scripts, container runtime, Compose health checks and
  tests on port 4321. Add the Next health route, node-owned runtime copies,
  USER node and an image healthcheck.
- Remove runtime CMS/preview settings from Compose and runtime-image tests.
- Replace Caddy's Astro resource paths and preview block with Next static cache
  paths and the documented Next-compatible public policy. Retain Caddy's CMS
  proxy, pinned images, private database network and deployment topology.
- Update validate-compose.mjs, validate-operations.sh and static operations
  tests to prove the new build/runtime separation rather than old preview
  behavior.
- Remove the stale CI Playwright-install and missing CSP-hash steps. Keep the
  immutable Directus-backed image build, runtime exercise and secret-leak
  inspection.
- Delete root scripts/env.mjs and only those root dependencies which its deleted
  V1 runtime owned; do not remove frontend-v2's own Directus SDK/Zod
  dependencies.

Checkpoint: rendered production and development Compose parse, Caddy validates,
and the fixture image passes its non-root health test.

### 5. Retire preview access while keeping CMS data

- Change Posts preview_url metadata in directus/schema.yaml to null.
- Remove Preview Reader definitions, permissions and normal provisioning from
  directus/constants.mjs and directus/bootstrap.mjs.
- Add the exact-ID idempotent retirement logic before normal bootstrap
  reconciliation; it may remove only objects created by the old managed Preview
  Reader identifiers and must tolerate 404s.
- Narrow Build Reader fields/collections to the V2 directus query after topic
  removal. Keep author permissions for notes/topics and private draft assets.
- Remove preview variables from all environment examples, Compose/Caddy,
  operation fixtures and documentation.
- Update tests/directus.mjs to assert no Posts preview URL and no Preview
  Reader, preserve published-only Build Reader access and author functionality,
  and use an administrative query where a private fixture is only needed as a
  test fixture.

Checkpoint: repository search finds no live preview runtime path/token/proxy;
the only allowed legacy reference is the exact-ID retirement migration, covered
by a test that asserts the retired objects are absent.

### 6. Update docs and project knowledge

- Revise root/V2/Directus READMEs and operations docs to describe the actual V2
  build, health, Directus and rollback contracts.
- Do not rewrite seeded article bodies. Document the /writing redirect and
  intentionally unresolved /notes links instead.
- After final quality checks, use trellis-update-spec to replace stale
  Astro/Pagefind/preview statements in the frontend and backend specs with the
  verified Next contracts.

## Validation matrix

Run the narrow checks after their owning step, then rerun the complete relevant
set after the final edit:

```sh
pnpm install --frozen-lockfile
pnpm --filter frontend-v2 typecheck
pnpm --filter frontend-v2 lint
pnpm --filter frontend-v2 selfcheck
pnpm --filter frontend-v2 build
pnpm --filter frontend-v2 verify
pnpm verify
pnpm --filter frontend-v2 exec tsc --noUnusedLocals --noUnusedParameters
sh tests/ops/run.sh
sh scripts/validate-operations.sh
docker build --target runtime --tag blog-site:fixture .
scripts/test-runtime-image.sh blog-site:fixture
```

When local Directus is available, also run the reviewed schema diff/apply
sequence, bootstrap and access/schema checks against a disposable or backed-up
environment:

```sh
pnpm directus:schema:diff
pnpm directus:schema:apply
pnpm directus:bootstrap
pnpm directus:schema:check
pnpm test:directus-access
```

Route validation will inspect generated routes and exercise a local standalone
server: a known /archives slug is 200, its /writing counterpart is a permanent
redirect to the same canonical path, and unknown writing/note slugs are 404.
The image inspection must prove the supplied Directus build token does not
occur in history, config, layers or runtime environment.

Final searches will cover removed frontend snapshot members, RSS endpoints,
preview runtime variables/paths, Astro/Pagefind references and Tailwind
configuration. Seed prose and the narrow retirement migration are reviewed
separately so intentional historical strings are not mistaken for live code.

## Approved follow-up: launch target origin (2026-10-10)

- [x] Record user-approved R13/AC13 and the target validation boundary in design.md.
- [x] Validate the configured HTTP(S) endpoint against the manifest's normalized
      origin in `handleApply()` before authentication or any CMS request.
- [x] Extend `tests/launch-apply.mjs` with zero-request refusals for host, port,
      scheme and invalid-URL cases, including login-based credentials; prove accepted
      equivalent-origin behavior and preserve all existing launch regressions.
- [x] Run the targeted launch test, then full-scope Trellis check with root
      fixture verify, lint, unused typecheck, formatting and diff checks.
- [x] Update the executable backend spec and validation record; keep AC8 open
      because the user has no custom-permission license available.
- [x] Prepare the reviewed commit plan under Phase 3.4. AC8 remains open; do not
      archive before all acceptance criteria have actually passed.
- [ ] Execute the code commit batches after one-shot confirmation of commit-plan.md.

## Approved follow-up: legacy owner preservation (2026-10-10)

- [x] Record user-approved R14/AC14 and explicit historical/current classification.
- [x] Add reusable immutable original legacy payloads backed by
      `29d5d85^:directus/seed/index.mjs` in the existing content module.
- [x] Classify all legacy rows before any seed/launch mutation; include legacy
      missing/migration states in seed's mutation-needed decision before early exit.
- [x] Extend both existing offline entrypoint regressions with historical
      migration, exact archived replay, legacy-only partial repair and owner-edit
      refusal with unchanged complete snapshots/timestamps.
- [x] Run targeted seed/launch regressions and final combined quality gate after
      the origin fix; record the result and update executable ownership specs.

## Review gates and rollback points

- After step 1: stop if V2's Directus/fixture contract cannot be made explicit
  without changing CMS data.
- After step 2: stop if static params cannot distinguish unknown legacy slugs;
  do not add a dynamic catch-all redirect.
- After step 4: stop if static Next output requires a runtime Directus token or
  if the token reaches an image layer/environment.
- Before step 5 against a real service: verify the normal backup and confirm
  the exact retirement IDs; the preview token is intentionally revoked.
- If a code/config validation fails, revert only task-owned hunks. Do not use
  destructive worktree operations. After a live preview retirement, restoring
  the old preview is a separate deliberate identity recreation, not automatic
  rollback.


## Follow-up R15: public image delivery (2026-10-10)

1. Implement a shared code-aware inline Markdown image scanner/rewriter and minimal escaped image rendering; preserve ordinary Markdown behavior and code examples.
2. Add bounded authenticated public-raster materialization and integrate it after published-row validation in `loadFromDirectus`; preserve original-body reading metadata. Test same-token folder preflight, refusal, byte/MIME bounds, mapping, dedup and atomic concurrent publication.
3. Add single build/dev lifecycle wrapper, failure/fixture cleanup and same-checkout serialization; wire lint/selfchecks and explicit Git/Docker excludes.
4. Independent checker runs full required gates and tests lifecycle/secret boundaries. Root verifies retained synthetic CMS read-token build, exact-byte anonymous site response in network-disabled readonly runtime, private/unreferenced absence and unchanged CMS content/timestamps.
5. Update operations/specs/validation and commit plan. AC15 may complete independently; AC8 remains open for the deferred licensed ACL validation. No commit/archive until the existing one-shot commit-plan confirmation.
