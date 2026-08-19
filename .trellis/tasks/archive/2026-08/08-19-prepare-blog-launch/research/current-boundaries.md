# Current launch boundaries

## Research question

How can the repository support dependable local preview and a truthful one-time
launch of the canonical 12-piece catalog without weakening fail-closed runtime
configuration or allowing development seed tooling to overwrite owner-managed
Directus data later?

## Evidence

### Preview environment

- `scripts/env.mjs` owns one strict runtime schema. Runtime requires explicit
  `CONTENT_SOURCE`, `SITE_URL`, `DIRECTUS_URL`, `DIRECTUS_PREVIEW_TOKEN`, and
  `PREVIEW_TRUSTED_HEADER`.
- `.trellis/spec/backend/quality-guidelines.md` explicitly prohibits a runtime
  fixture fallback. Every production, development, Playwright, and container
  entrypoint must set its intended content source.
- `src/pages/preview/[id].astro` evaluates `readRuntimeEnv()` before its trusted
  header check. Missing configuration therefore fails at route module loading.
- `playwright.config.ts`, `scripts/test-runtime-image.sh`, and production Compose
  already demonstrate complete explicit runtime environments.
- `deploy/compose.dev.yaml` supplies only `CONTENT_SOURCE`, `NODE_ENV`, and
  `SITE_URL` to the site service. Direct `pnpm dev` likewise does not load a
  runtime env file. This is an entrypoint wiring defect, not a reason to loosen
  the schema.

### Fixture and live content ownership

- `directus/seed/content.mjs` owns one canonical fixture definition used by
  fixture builds and the current Directus seed. It contains deterministic IDs,
  bodies, topics, joins, settings, and fixture publication dates.
- `directus/seed/index.mjs` currently upserts deterministic settings with
  `avatar: null`, deletes known social-link IDs, upserts every canonical post,
  topic, and relation, and archives known legacy fixture IDs.
- `.trellis/spec/backend/database-guidelines.md` requires exact-ID operations,
  unknown owner-record preservation, immutable media originals, stable
  idempotent timestamps, and PostgreSQL/Directus as the sole live authority.
- The current canonical-seed contract permits patching stale data at a known
  deterministic ID. That is appropriate while all known records are fixtures,
  but becomes unsafe once those same IDs represent owner-managed launched
  content with truthful timestamps, avatar, or later edits.
- Directus system `date_created` and `date_updated` are operational metadata;
  `published_at` is the explicit public publication time.

### Launch and infrastructure

- The selected first release keeps `海边的小卖部`, `关山`, and all 12 existing
  pieces, but rejects the fixture's May-August dates as public history.
- All 12 pieces launch in one release. The existing array order is the intended
  editorial order.
- The owner has no VPS/domain yet. Real deployment, DNS, TLS, offsite backup,
  and alerts cannot be acceptance criteria for this implementation task.
- Avatar and social links are optional at first release; the current initial and
  text fallback is intentional.

## Selected technical direction

### Explicit development preview

Keep `readRuntimeEnv()` strict. Add a repository-owned development entrypoint or
environment wrapper that supplies non-secret fixture preview values explicitly,
and make development Compose supply the same complete set. Document a separate
Directus-backed variant that obtains real values from the untracked root `.env`.
Do not add defaults inside the runtime schema or preview route.

The fixture trusted-header value is local test data, not a production secret.
The route must continue returning its intentional private 404 without the exact
header. Directus-backed preview continues to require a real preview token and
must not expose it to the browser.

### Separate fixture installation from real launch

Retain the canonical content module as fixture and launch input, not a runtime
store. Split mutation policy into explicit modes:

1. **Development fixture install** is allowed only after a clear fixture-mode
   confirmation and a complete read-only preflight. It may create a fresh
   deterministic fixture or confirm an unchanged fixture. If a known ID contains
   launched/owner-modified state, the command fails before any content mutation.
2. **One-time launch import** requires a distinct confirmation containing the
   target identity and a launch timestamp. It refuses partial/ambiguous known
   state, preserves unknown records, uploads/reuses immutable media, imports the
   selected settings/topics/posts/joins, and assigns truthful unique
   `published_at` instants in the existing editorial order.
3. **Post-launch operation** is Directus-only. Rerunning launch performs a
   no-change verification when the recorded import already matches, or fails on
   owner edits; it never reapplies fixture dates, clears avatar, deletes owner
   social links, or rewrites content.

Preflight must finish before the first mutation. Where the Directus API cannot
provide a transaction spanning files and items, the importer records bounded
progress by deterministic ID, is idempotent for its exact launch manifest, and
fails with recovery instructions rather than deleting or rolling back unknown
data.

### Truthful batch timestamps

At launch, capture one explicit UTC base timestamp from the operator. Derive
stable per-post instants from that base while preserving the canonical array
order (newest item first in public sorting) and store the exact derived schedule
in a generated dry-run plan before apply. A rerun uses the same base/plan and
never calls `new Date()` independently for existing records.

Fixture builds retain deterministic fixture dates so CI and screenshots remain
reproducible. Only the one-time Directus launch plan substitutes real launch
timestamps.

## Verification implications

- Extend unit coverage for explicit runtime environments, launch timestamp plan
  ordering, confirmation parsing, preflight classification, and secret-free
  errors.
- Extend Compose/static contracts so the development site has the complete
  explicit runtime environment and production remains `CONTENT_SOURCE=directus`.
- Exercise development seed twice on an isolated local Directus instance and
  prove an owner-modified sentinel and unknown records are untouched/refused.
- Exercise launch dry-run/apply/rerun on isolated local Directus, then compare
  fixture and Directus projections except for the intentionally substituted
  publication timestamps and operational IDs.
- Run a Directus-backed build and verify Home, About, all discovery/detail
  routes, search, RSS, sitemap, Open Graph, JSON-LD, preview, and export.
- Run `pnpm verify`, operations/CSP validation, Compose validation, and relevant
  Directus checks. License-gated checks must be reported honestly if the local
  Directus entitlement is unavailable.

## Relevant specifications

- `.trellis/spec/backend/database-guidelines.md`
- `.trellis/spec/backend/error-handling.md`
- `.trellis/spec/backend/logging-guidelines.md`
- `.trellis/spec/backend/quality-guidelines.md`
- `.trellis/spec/frontend/type-safety.md`
- `.trellis/spec/frontend/quality-guidelines.md`
