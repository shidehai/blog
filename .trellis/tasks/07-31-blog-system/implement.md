# Implementation Plan: Personal Blog System

## Working Rules

- Do not start implementation until the final planning summary is approved and
  `task.py start` changes this task to `in_progress`.
- PostgreSQL/Directus is the only live content and settings source. Do not add
  local Markdown content collections or synchronization jobs.
- Prefer Directus configuration, PostgreSQL constraints, Astro primitives,
  native HTML/CSS, and installed framework capabilities over custom services.
- Use Astro as a fully custom rendering foundation, not a theme. Do not add a
  blog starter, page builder, UI kit, or site-wide React runtime.
- Keep normal public routes prerendered. Only `/preview/[id]` may read Directus
  on request.
- Treat CMS responses as untrusted at the API boundary and fail closed.
- Pin production versions and commit the lockfile and Directus schema snapshot.
- Never place secrets, author credentials, preview tokens, or real private
  content in fixtures, snapshots, generated HTML, or logs.
- Execute Phase 1 as its own reviewable iteration. Return to the main session,
  populate and finish the existing `00-bootstrap-guidelines` task from those
  real patterns, refresh both JSONL manifests, and only then dispatch the wider
  CMS/frontend phases. Empty placeholder specs are not implementation guidance.

## Planned Repository Shape

Keep Astro at the repository root rather than creating a monorepo for one
frontend. Add only these top-level product areas as they become necessary:

```text
deploy/
  Caddyfile
  compose.yaml
  compose.dev.yaml
directus/
  schema.yaml
  seed/
scripts/
  deploy-site.sh
  backup.sh
  restore.sh
src/
  components/
  layouts/
  lib/
  pages/
  styles/
tests/
public/
Dockerfile
```

Directus itself remains a pinned container, not copied application source. Any
bootstrap script must cover configuration that a schema snapshot cannot
reliably promote; do not create a custom CMS backend.

## Sub-Agent Dispatch Waves

- Wave 0 runs Phase 1 alone because every later package and project spec depends
  on the real foundation. The implement agent owns the initial repository and
  deployment skeleton; a check agent verifies the Phase 1 gate before reuse.
- After Phase 1 and `00-bootstrap-guidelines` are complete, Phase 2 owns
  `directus/` and its integration tests while Phase 4 owns the public shell,
  components, styles, and component tests. They may run in parallel; the main
  session coordinates shared root configuration and integrates both results.
- Phase 3 starts after Phase 2 fixes the CMS schema contract. Phase 5 starts
  only after both the Phase 3 content boundary and Phase 4 shell pass their
  gates.
- After Phase 5, Phase 6 and Phase 7 may run in parallel with disjoint ownership
  of search/metadata and preview/deployment respectively. Phase 8 and the final
  quality gate run only after both are integrated.
- Keep this as one Trellis task until a wave becomes independently releasable;
  child tasks would add bookkeeping without enabling more safe concurrency in
  the empty repository.

## Phase 1. Foundation and Local Infrastructure

- [x] Initialize the Git repository with a focused `.gitignore`, safe line-ending
      defaults, and no generated output, environment file, bind-mounted data, or
      production content in version control.
- [x] Initialize Astro with strict TypeScript and `pnpm`; pin Node and package
      manager versions.
- [x] Add only the required integrations: Node adapter, Directus SDK,
      runtime validation, Markdown pipeline, Pagefind, and focused test tooling.
- [x] Add formatting, lint, type-check, unit, build, search-index, and browser
      test scripts with one documented `pnpm verify` aggregate.
- [x] Create `.env.example` with separate Directus build/preview credentials,
      canonical site URL, PostgreSQL, upload paths, Caddy preview authentication,
      GHCR/deployment, and encrypted backup variables. Validate required server
      variables at process start/build.
- [x] Add production Docker Compose for Caddy, one Astro Node site service,
      PostgreSQL 17, pinned Directus 12.2.0, and an on-demand backup profile.
- [x] Use explicit host bind paths for PostgreSQL, Directus uploads, Caddy state,
      deployment state, and backup staging; add health checks, restart policies,
      log rotation, and safe resource ceilings.
- [x] Add a development Compose override with localhost-only Directus/PostgreSQL
      ports and a single development site process.
- [x] Ensure PostgreSQL is not published beyond localhost in development and is
      private-network only in production.
- [x] Add a multi-stage Astro Node Dockerfile with an unprivileged runtime,
      immutable build output, `.dockerignore`, and no build credential in layers.
- [x] Add Caddy routing for the public site, `cms.<domain>`, protected preview,
      compression, TLS, security headers, and a fixed private site upstream.
- [x] Add a minimal local runbook for bootstrap, health check, schema apply,
      seed, and teardown without destructive wildcard commands.
- [x] Once real foundation files exist, resume `00-bootstrap-guidelines`, record
      the actual Astro/TypeScript/CSS/Directus/Compose conventions with real
      examples, and add those completed specs to this task's JSONL manifests
      before broad feature implementation. Do not fill specs with hypothetical
      examples before code exists.

Validation gate:

```bash
pnpm install --frozen-lockfile
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml config --quiet
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml up -d postgres directus
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml ps
docker build --target runtime -t blog-site:test .
pnpm format:check
pnpm lint
pnpm astro check
```

Rollback point: no content schema exists yet; containers and generated Astro
files can be removed without data migration. Preserve bind-mounted data unless
an explicit, backed-up reset is intended.

## Phase 2. Directus Schema and Policies

- [ ] Create versioned `posts` and `site_settings` collections plus `topics`,
      `posts_topics`, and `social_links` according to `design.md`.
- [ ] Configure the `posts.body` long-text field with Directus' Markdown
      interface and a dedicated media folder.
- [ ] Add database uniqueness/indexes and Directus field/status validation,
      including stable lowercase slugs and publish-time required fields.
- [ ] Enable content versioning and verify new item-less draft, compare,
      publish, update, archive/unpublish, revision restore, and deletion flows.
- [ ] Configure `site_settings` as a singleton and make navigation structure
      code-owned rather than introducing a page builder.
- [ ] Configure allowed media MIME types and size limits. Covers use file
      relations; inline images use stable Directus file IDs. Create stable
      `publishable-assets` and `private-draft-assets` folders as permission
      scopes and validate promotion before a public build.
- [ ] Create Author, Build Reader, Preview Reader, and deny-all Public policies.
      Verify collection, field, item, version, revision, and file access with
      each role rather than relying on UI visibility.
- [ ] Create a separate break-glass Administrator, enable MFA on both human
      accounts, store recovery material outside the repository, and prove
      Author handles routine publishing without platform-admin access.
- [ ] Create distinct, rotatable build and preview tokens.
- [ ] Configure Directus local storage at `/directus/uploads`, backed by the
      explicit development or production bind mount. Verify container
      recreation preserves every upload.
- [ ] Deny Author binary replacement and file deletion; replacement creates a
      new file ID and orphan cleanup is an Administrator maintenance action.
      Prove Build Reader cannot access `private-draft-assets`. Keep SVG originals
      private and perform public/preview sanitization in the shared Phase 3
      asset boundary rather than introducing a Directus upload extension.
- [ ] Add and validate `site_settings.locale=zh-CN` and
      `site_settings.timezone=Asia/Shanghai` using constrained locale and IANA
      timezone values.
- [ ] Snapshot the schema to `directus/schema.yaml`. Add an idempotent bootstrap
      step only for Flow/policy state not represented by the snapshot.
- [ ] Prove schema promotion uses expand/deploy/contract sequencing. Keep an
      old-field reader fixture until a later snapshot safely removes that field.
- [ ] Add clearly fake Chinese article, tutorial, note, topic, settings, and
      media fixtures without system-user or token exports.

Required integration spike before leaving this phase:

- Observe Directus 12.2.0 events for first publish, republish, archive,
  unpublish, delete, topic relation changes, and settings publication.
- Exercise Live Preview for an item-less first draft and a named content
  version using `{{$version}}`.
- Compare Directus Markdown Preview with the target portable Markdown fixtures.
- Record the exact free core/OIG activation requirements for this personal
  deployment and verify every required feature is available under that tier.

Validation gate:

```bash
pnpm directus:schema:diff
pnpm directus:schema:apply
pnpm directus:schema:check
pnpm test:directus-access
pnpm test:directus-workflow
```

Rollback point: take a database backup before every schema apply. Revert the
schema snapshot and pinned Directus image only when the generated diff is
backward-compatible; otherwise restore the pre-apply database in a clean
environment.

## Phase 3. Typed Content and Markdown Boundary

- [ ] Define one runtime-validated Directus response schema and one normalized
      frontend `Post` model. Keep database field decoding in this boundary.
- [ ] Implement explicit-field, paginated queries for the full published
      snapshot, topics, public settings, social links, and referenced files.
- [ ] Make `status=published` part of the API query and assert it again before
      route, RSS, sitemap, Pagefind, or related-content generation.
- [ ] Reject duplicate slugs, invalid dates/relations, incomplete long-form
      summaries, invalid URLs, and missing required image alternatives with
      useful record/field diagnostics.
- [ ] Normalize API timestamps as UTC and format human dates only through the
      validated site timezone. Test publication near a UTC/local date boundary.
- [ ] Build one Markdown renderer for production and preview: GFM, footnotes,
      callouts, heading IDs, outline, Shiki, safe links, and disabled/sanitized
      raw HTML.
- [ ] Define and test one fenced-code metadata grammar for filename, highlighted
      lines, and diff state; reject malformed or out-of-range metadata.
- [ ] Implement deterministic reading time, note excerpt, canonical route, and
      related-post derivation without database duplication.
- [ ] Implement the Directus asset resolver, MIME/size validation, responsive
      public variants, intrinsic dimensions, sanitized SVG, immutable file-ID
      behavior, and protected preview delivery.
- [ ] Validate all generated internal routes, fragments, and CMS media
      references after build. Do not make external URL reachability a
      publication gate, so a third-party outage cannot block publication.
- [ ] Add fixture tests for mixed Chinese/Latin prose, duplicate headings,
      fenced code metadata, tables, footnotes, callouts, inline images, unsafe
      URLs/HTML, empty notes, and malformed CMS data.
- [ ] Add a one-way portability export command for Markdown plus JSON metadata.
      It must never be read by the production application.

Validation gate:

```bash
pnpm test:content
pnpm test:markdown
pnpm export:content -- --dry-run
pnpm astro check
```

Rollback point: the content adapter and renderer must be replaceable without a
database migration. Do not write derived values back to Directus.

## Phase 4. Public Design System and App Shell

- [ ] Build project-owned `.astro` components and native CSS from the approved
      visual system. Add no starter theme, UI kit, or client framework baseline;
      document the concrete interaction before introducing any framework island.
- [ ] Convert `DESIGN.md` into tested CSS custom properties for neutral light
      relief and graphite dark surfaces, blue signals, text, focus, semantic
      status, type scale, spacing, radii, motion, and stable dimensions. Define
      only `flat`, `raised`, `inset`, and `floating` depth tokens; components do
      not invent private shadow formulas.
- [ ] Select and self-host only font files that materially improve Chinese and
      mixed-script rendering; otherwise use the documented high-quality system
      stack. Do not copy the reference's external Inter request. Subset and
      preload only critical files.
- [ ] Validate the final mixed-script specimen at 17px or larger on mobile,
      roughly 34–42 Han glyphs / 65–75 Latin characters per line, and Chinese
      line height around 1.75–1.9 before freezing typography tokens.
- [ ] Build the semantic site shell, skip link, compact header/navigation,
      footer, theme control, focus treatment, and responsive mobile navigation.
- [ ] Match the reference behavior with a floating capsule header that compresses
      after scroll while reserving stable layout space. Keep the active route,
      focus order, touch targets, and mobile menu state explicit.
- [ ] Use native dialog/disclosure/popover behavior where it fits and keep
      standalone controls at a comfortable 44 CSS-pixel target. Verify focus
      restoration, escape behavior, and 200% text zoom.
- [ ] Apply system/persisted theme before first paint without blocking the page;
      use a deterministic inline bootstrap with an exact CSP hash, verify no
      wrong-theme flash in screenshots, and keep JavaScript-disabled content
      readable.
- [ ] Use Lucide icons for familiar controls and accessible text/tooltips where
      an icon's meaning is not self-evident.
- [ ] Build shared content primitives: post list row, metadata, topic link,
      responsive figure, code block, callout, table wrapper, footnote, outline,
      reading progress, empty state, and pagination only where content volume
      requires it.
- [ ] Express the approved Annotation Spine through the outline/progress rail,
      captions, code filenames, and callout labels; every mark must communicate
      structure rather than become decorative grid or ruler chrome.
- [ ] Build reusable relief primitives for raised modules, inset wells/pressed
      controls, pills, and the clipped-media feature composition. Prevent nested
      raised cards, shadow-plus-decorative-border combinations, and shadow-only
      focus/state; forced colors replaces depth with explicit borders.
- [ ] Use pointer-only 2–3px lift, inset press feedback, one coordinated first-row
      reveal, and an optional hero phrase sequence. Essential HTML starts visible;
      reduced motion renders final state immediately.
- [ ] Preserve the reference's material effect without copying its avatar,
      wording, stock photo, exact colors, counters, clock, 3D cell, icons, or
      route/content structure.
- [ ] Verify every fixed-format control has stable dimensions and long Chinese
      titles, URLs, and code do not resize or overlap adjacent UI.

Validation gate:

```bash
pnpm test:components
pnpm test:e2e -- --project=chromium
pnpm test:a11y
```

Review screenshots at 320x800, 768x1024, 1440x1000, and 1920x1080 in light,
dark, forced-colors, reduced-motion, long-title, and empty-content states before
routes are considered stable. Review raised/inset affordances with shadows
disabled as well as in normal themes.

## Phase 5. Public Routes and Reading Experience

- [ ] Implement Home from database settings plus featured/latest writing and
      recent notes as the approved asymmetric Bento surface: compact identity,
      larger featured-writing module with clipped real media or text-led fallback,
      latest writing, notes, topics, and Search/Archive/RSS shortcuts. Keep real
      writing visible in the first viewport at every target width.
- [ ] On mobile, place featured/current writing before the expanded identity
      module, collapse to one column, move feature media below its text, and keep
      the next reading choice visible without reproducing the reference's long
      profile-first stack.
- [ ] Implement Writing, Notes, Topics, topic detail, and chronological Archive
      with semantic navigation, deterministic ordering, compact raised rows,
      inset filters, and pills. Do not turn Topics into an identical icon-card
      grid or invent category artwork.
- [ ] Implement article/tutorial and note permalinks from the normalized model.
- [ ] Add long-form outline behavior, heading anchors, progress, responsive
      media, table overflow, footnotes, and keyboard-accessible code copy.
- [ ] Make the outline sticky only when space allows; use native disclosure on
      small screens. Preserve reading position and avoid scroll-jacking.
- [ ] Implement About entirely from `site_settings` and `social_links`.
- [ ] Render About as a restrained identity Bento surface, while article and note
      permalinks keep their prose plane flat and use relief only for outline,
      media, code, callouts, and actual controls.
- [ ] Implement useful empty states and a custom 404 with direct navigation back
      to current writing.
- [ ] Ensure public pages render useful HTML with JavaScript disabled.
- [ ] Add print styles for tutorials that remove controls/navigation while
      preserving URLs, code, tables, footnotes, and meaningful media.

Validation gate:

```bash
pnpm astro check
pnpm build
pnpm test:e2e
pnpm test:a11y
```

Rollback point: each route consumes the shared normalized snapshot. Route-level
failures must not introduce alternate Directus queries or draft filters.

## Phase 6. Search, Metadata, and Syndication

- [ ] Run Pagefind only after Astro output exists; mark content, kind, topic,
      date, and exclusion regions deliberately.
- [ ] Emit `lang="zh-CN"` from validated settings and verify Pagefind selects
      its Chinese segmentation path; support explicit language on isolated
      English passages.
- [ ] Lazy-load search JavaScript on `/search/` and validate Chinese
      segmentation with real mixed-script fixtures.
- [ ] Generate RSS with all published kinds and absolute URLs from the same
      content snapshot.
- [ ] Generate canonical, Open Graph, social, `BlogPosting`, `WebSite`, and
      `Person` metadata with database-configured defaults and post overrides.
- [ ] Generate sitemap/robots and exclude drafts, archive-only records,
      previews, search internals, and noncanonical URLs.
- [ ] Add a branded bitmap default sharing image and use optimized post covers
      when available.
- [ ] Add favicons, manifest metadata, and explicit feed discovery links.

Validation gate:

```bash
pnpm build
pnpm test:search
pnpm test:metadata
pnpm test:feed
```

## Phase 7. Protected Preview and Publication Automation

- [ ] Add only `/preview/[id]` as `prerender=false`; all public routes remain
      explicitly prerendered.
- [ ] Configure Caddy basic authentication for `/preview/*`, strip any incoming
      trusted-preview header, and inject it only after authentication. Keep the
      site container port private so the header boundary cannot be bypassed.
- [ ] Verify the trusted header in Astro before fetching content, use the
      Preview Reader token server-side, support `{{$version}}`, and render the
      same normalized components as public pages.
- [ ] Set preview `private, no-store` and `noindex, nofollow`; exclude it from
      Pagefind and sitemap. Configure compatible `frame-src`/`frame-ancestors`
      CSP for Directus Live Preview.
- [ ] Add Directus Flow triggers based on the observed Phase 2 event matrix for
      every transition into and out of public visibility and every relevant
      published setting/relation change.
- [ ] Read the fine-grained GitHub dispatch credential from the approved
      Directus Flow environment allow-list. Never persist it in content fields.
- [ ] Give dispatch failure an owner-visible Directus rejection/notification
      path and prove manual workflow dispatch reconciles the full snapshot.
- [ ] Add GitHub Actions for code and content dispatches with a concurrency
      group that cancels stale builds, explicit snapshot validation, Pagefind,
      browser smoke tests, an immutable Astro image, and GHCR publication.
- [ ] Pass the Directus Build Reader token only as a masked CI secret while
      building. Inspect image history and runtime env to prove it is absent.
- [ ] Create a least-privilege forced-command SSH deploy key and pin the VPS host
      key in CI. The key may invoke only the reviewed site deployment entrypoint,
      which accepts one allow-listed GHCR repository plus `sha256` digest and
      rejects tags, extra arguments, and shell metacharacters.
- [ ] Implement the smallest safe single-service deployment: take a lock, pull
      the immutable image, run it as a uniquely named traffic-free candidate
      with production env/network, verify `/healthz` and representative routes,
      then remove the candidate.
- [ ] Resolve and record the current digest, update the one Compose `site`
      service by candidate digest, wait for health, gracefully reload Caddy to
      refresh Docker DNS, and smoke-test through Caddy. A failure automatically
      restores the recorded digest and
      reloads Caddy again. Accept the few-second container restart instead of
      keeping permanent blue/green services and proxy-switch state.
- [ ] Make deployment idempotent and concurrency-safe. Cleanup may remove only
      unreferenced images from this site's repository and must protect the
      deployed and rollback digests; commit-SHA tags are trace labels only.
- [ ] Prove that an intentionally invalid post fails before deploy, preserves
      the prior production version, and yields an owner-visible diagnostic.
- [ ] Prove publish, edit, archive, delete, topic change, and settings change all
      reconcile the complete public snapshot in under five minutes.

Validation gate:

```bash
pnpm test:preview
pnpm test:publish-flow
pnpm build
docker build -t blog-site:integration .
pnpm test:deployed-smoke -- --url "$PRODUCTION_URL"
```

Rollback point: a failed candidate never receives traffic; after replacement,
the deployment state retains the prior immutable digest for automatic Compose
redeploy. Disable the Directus Flow if it loops, revoke the dispatch token, and
continue authoring drafts while the last successful image remains online.

## Phase 8. Security, Backup, and Production Readiness

- [ ] Apply TLS, CORS, CSP, HSTS after validation, referrer, content-type,
      permissions, frame, cache, and robots headers per route type.
- [ ] Harden the VPS firewall and SSH, publish only Caddy's 80/443 ports, keep
      PostgreSQL on the `data` network, and verify no container bypasses Caddy.
- [ ] Verify the browser bundle, generated HTML, Docker layers/history, runtime
      env, and logs contain no Directus, database, GHCR/GitHub, backup, or
      preview credentials.
- [ ] Store production env files with owner-only permissions and document
      a complete password-manager recovery inventory for Directus/database,
      human/MFA, build/preview/dispatch/GHCR, preview-authentication, SSH, and
      Restic credentials. Mark each value restore-in-place or rotate/recreate,
      without copying it into Git or application backups.
- [ ] Add a separate owner-run infrastructure release runbook for Compose,
      Caddy, deploy-script, Directus/PostgreSQL image, and schema changes. It
      must use a reviewed pinned Git commit, verified backup, config/schema
      diff, expand/deploy/contract order, smoke checks, and explicit rollback;
      the routine content workflow may update only the site image digest.
- [ ] Add a short-lived backup container that creates and verifies a PostgreSQL
      custom-format logical dump, then snapshots it and the Directus upload
      bind mount to an encrypted off-VPS Restic repository.
- [ ] Create temporary dumps as mode `0600`, remove them on every exit path, and
      rely on immutable/no-hard-delete media so the subsequent upload snapshot
      cannot omit a file referenced by the database dump.
- [ ] Configure 14 daily, 8 weekly, and 12 monthly Restic retention, with prune
      and integrity checks separated from the nightly snapshot path.
- [ ] Add backup checksums, failure notifications, and a documented clean-room
      restore procedure.
- [ ] Perform one restore drill by importing the full database dump and uploads,
      starting the pinned Directus version, and comparing the restored schema to
      the snapshot without automatically applying it. Build representative
      content and compare stable URLs/checksums. Verify a recovery point no older
      than 24 hours can be restored within four hours under normal conditions.
- [ ] Configure Docker health checks, Caddy/Docker log rotation, external HTTPS
      availability checks, backup/build alerts, and VPS disk/inode thresholds
      without logging content bodies.
- [ ] Run dependency/security audits, confirm the recorded Directus MSCL tier,
      scan the final OCI image for high/critical vulnerabilities, and document
      pinned-version plus host patch upgrade/rollback steps.
- [ ] Replace fixtures with owner-provided identity and real content/media
      before the production acceptance run.

Validation gate:

```bash
pnpm verify
pnpm audit --prod
docker compose --env-file .env -f deploy/compose.yaml config --quiet
pnpm test:headers -- --url "$PRODUCTION_URL"
pnpm test:backup-restore
pnpm lighthouse -- --url "$PRODUCTION_URL"
```

## Final Quality Gate

Before reporting implementation complete:

- [ ] Every acceptance criterion in `prd.md` has evidence and an owning test or
      explicit manual check.
- [ ] `pnpm verify` and the production build pass from a clean install.
- [ ] Directus access tests prove no unauthenticated content/settings access and
      no draft leakage through items, versions, files, preview, search, feed,
      sitemap, metadata, or related content.
- [ ] Desktop/mobile screenshots and browser-console/network review show no
      overlap, blank media, layout shift, errors, failed requests, or leaked CMS
      calls on public pages.
- [ ] Side-by-side design review recognizes the approved reference family in the
      capsule header, blue signal system, relief states, asymmetric Bento Home,
      clipped feature media, and restrained motion without copied identity,
      content, imagery, or reference-only modules.
- [ ] WCAG checks include keyboard-only, visible focus, 200% zoom, 320px reflow,
      contrast, reduced motion, forced colors, and meaningful alternatives.
- [ ] Representative mobile Lighthouse runs meet the PRD targets or every
      exception has measured evidence and explicit user acceptance.
- [ ] Publication failure, frontend rollback, revision restore, token rotation,
      and full backup restore have each been exercised.
- [ ] Candidate preflight, automatic prior-image redeploy, protected image
      cleanup, UTC/timezone boundary formatting, no-flash theming, print output,
      and sanitized SVG behavior have each been exercised.
- [ ] The theme bootstrap, Pagefind search, copy controls, and Directus preview
      framing all work under the final restrictive CSP without broad inline
      execution allowances.
- [ ] Directus schema snapshot and operational documentation match the deployed
      version and no unreviewed production-only configuration remains.

## High-Risk Areas

- `directus/schema.yaml` and any bootstrap provisioning: an incorrect apply can
  alter production data or silently omit permissions/flows.
- The shared content query/validator: draft leakage or a partial snapshot would
  affect routes, search, RSS, sitemap, and metadata together.
- Directus version-event mapping: missing archive/delete/relation events leaves
  stale static pages live.
- Markdown/media rendering: unsafe HTML/URLs, broken asset protection, or
  preview/public divergence creates security and content-loss risk.
- The reference-derived neumorphic system: weak contrast, excessive nesting,
  shadow-only affordances, profile-first mobile ordering, or opacity-gated motion
  would reproduce the reference's weaknesses instead of its useful character.
- Preview authentication, trusted proxy headers, and server secrets: failures
  can expose drafts.
- Candidate-to-site replacement and deploy state: a partial replacement can
  lose the rollback digest or leave the single site service unhealthy.
- Backup/restore automation: an untested successful job is not proof of a
  usable recovery point.

These areas receive focused integration tests and manual review; do not hide
them behind speculative abstraction layers.
