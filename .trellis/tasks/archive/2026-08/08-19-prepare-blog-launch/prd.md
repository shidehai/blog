# Prepare blog for real publishing

## Goal

Move the blog from a technically complete development fixture to a dependable
real publishing workflow. The owner should be able to preview and publish from
Directus without hand-editing application code, while seed/bootstrap tooling
cannot silently replace owner-managed production identity or content.

## User Value

- The owner can use the local CMS preview workflow without assembling an
  undocumented environment by hand.
- Public identity, content, media, social links, and publication timestamps are
  truthful and remain owner-managed after launch.
- Production launch and recovery use explicit, verifiable gates instead of
  relying on an apparently successful frontend build.

## Confirmed Facts

- The public frontend already exposes Home, Writing, Notes, Topics, Archive,
  Search, About, RSS, sitemap, metadata, related writing, responsive reading,
  and protected preview routes.
- A production-style fixture run passed all 64 Playwright E2E tests. Lighthouse
  scored Performance 99, Accessibility 100, Best Practices 100, and SEO 100.
- Direct `pnpm dev` does not supply every value required by
  `readRuntimeEnv()`. The dynamic preview route calls that strict parser at
  module evaluation (`src/pages/preview/[id].astro:19-23`), while the development
  Compose service supplies only `CONTENT_SOURCE`, `NODE_ENV`, and `SITE_URL`
  (`deploy/compose.dev.yaml:11-15`). A production-style start with the complete
  runtime environment serves the trusted preview successfully.
- The canonical fixture and Directus seed currently define 12 AI-engineering
  pieces, six topics, site name `海边的小卖部`, author name `关山`, no avatar,
  and no social links (`directus/seed/content.mjs:951-969`,
  `src/lib/content.ts:985-1002`).
- The Directus seed upserts public site settings with `avatar: null` and deletes
  the known social-link identities (`directus/seed/index.mjs:127-139`). Running
  seed tooling against an owner-managed database therefore needs an explicit
  development/initialization boundary.
- The owner confirmed `海边的小卖部` as the real public site name, `关山` as the
  real public pen name, and the existing 12 AI-engineering pieces as the initial
  real catalog. The fixture publication timestamps are not accepted as public
  history. The owner selected one batch launch for all 12 pieces, using their
  real first-publication times from the launch operation.
- Repository deployment, backup, restore, health, and alert tooling exists, but
  real DNS, HTTPS, credentials, off-VPS Restic storage, alert delivery, and a
  clean-room restore cannot be proven from local code alone.
- The owner does not yet have a launch VPS or domain. This task therefore ends
  with a locally verified production-ready release and migration package; real
  infrastructure provisioning and deployment will be a separate task when the
  external resources exist.
- A real avatar and public social/profile links are optional launch inputs. The
  owner approved the existing text identity and `关` initial fallback for the
  first release; later additions remain owner-managed Directus content.

## Requirements

### R1. Dependable local preview

- `pnpm dev` and the documented development Compose workflow must have one
  supported configuration for fixture preview and one documented configuration
  for Directus-backed preview.
- Missing or invalid preview configuration must fail with an intentional,
  diagnosable response. It must not expose an Astro-generated error document or
  weaken the trusted-header boundary.
- Preview remains private, `noindex`, `no-store`, and free of Directus tokens in
  generated HTML and asset URLs.

### R2. Owner-managed identity and content

- The launch workflow must distinguish deterministic development fixtures from
  owner-managed production records.
- Routine seed/bootstrap commands must not overwrite or delete real site
  settings, avatar, social links, posts, topics, joins, media, or publication
  timestamps.
- The public build continues to read one complete, validated PostgreSQL/
  Directus snapshot; Git fixture content must not become a second production
  content authority.
- Final public identity and content must reflect the owner's decision about the
  existing pseudonym/site identity and AI article catalog. `海边的小卖部`, `关山`,
  and the current 12-piece catalog are retained as the selected launch identity
  and content set.
- All 12 pieces launch in one release. The migration must preserve their chosen
  editorial order while recording real first-publication timestamps; it must not
  retain the fixture's May-August dates as claimed public history.
- Missing avatar and social-link records must continue to render as an
  intentional first-release state, not as incomplete fixture chrome or an error.

### R3. Launch validation

- Provide an ordered preflight that verifies schema and access policy, public
  build output, preview, search, metadata, responsive behavior, accessibility,
  security headers, deployment health, backups, and restore readiness.
- Local verification must clearly distinguish code-level proof from external
  production checks requiring domain, server, DNS, registry, backup, or alert
  access.
- No secret value may be committed, printed in reports, embedded in generated
  output, or copied into task artifacts.
- The release package must identify, but must not claim to complete, the real
  VPS/domain/DNS/TLS/offsite-backup/alert gates that require future resources.

### R4. Staged delivery

- Stage 1 owns local preview reliability and fixture/production data protection.
- Stage 2 owns the chosen real identity/content migration, a dry-run against an
  isolated local Directus database, and a production launch runbook.
- External DNS, server, credential, deployment, or destructive database actions
  are deferred to a separate deployment task and require explicit authorization
  at execution time.

## Acceptance Criteria

- [ ] AC1: A documented fixture-mode development start can open a trusted
      preview successfully, while an untrusted request still receives the
      intentional private 404 response.
- [ ] AC2: A documented Directus-backed development start exercises the same
      preview layout and trust boundary without leaking secrets.
- [ ] AC3: Automated tests cover missing/invalid preview configuration and both
      trusted and untrusted preview behavior without observing a generic Astro
      error document.
- [ ] AC4: Re-running development fixture setup remains deterministic; launch
      planning is read-only; applying and retrying the same launch manifest is
      idempotent; and owner-modified or ambiguous known state is rejected before
      mutation. Unknown records plus owner-managed avatar and social links remain
      unchanged throughout.
- [ ] AC5: The selected public identity, 12-piece catalog, editorial order, and
      launch-manifest publication timestamps render consistently across Home,
      About, discovery pages, detail pages, RSS, sitemap, search, Open Graph, and
      structured data. Fixture dates remain confined to fixture builds.
- [ ] AC6: Formatting, lint, type-check, unit tests, production build, operations
      checks, and the full E2E suite pass after all Stage 1 and Stage 2 changes.
- [ ] AC7: The launch checklist records evidence for every locally provable gate
      and identifies each remaining external gate with an owner and safe command
      or manual check.
- [ ] AC8: No implementation step writes secrets to Git/task artifacts or
      changes external production state without explicit authorization.

## Out of Scope

- Comments, reactions, view counters, popularity rankings, reader accounts, or
  infinite scroll.
- Newsletter infrastructure beyond the existing RSS feed.
- PWA installation or offline caching.
- A broad frontend redesign or a font replacement; the current responsive and
  accessibility contracts are already healthy.
- Inventing personal biography details, social profiles, production history, or
  publication timestamps on the owner's behalf.
- Provisioning or changing a real VPS, domain, DNS, TLS certificate, container
  registry, offsite Restic repository, or alert destination in this task.
