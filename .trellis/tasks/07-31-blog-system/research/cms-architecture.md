# Research: CMS Architecture for a PostgreSQL-Backed Astro Blog

> Deployment update (2026-08-03): the owner selected Docker Compose on a VPS
> and explicitly rejected Cloudflare Workers. The Directus/PostgreSQL/CMS
> comparison in this document remains applicable; `vps-deployment.md`
> supersedes its Railway, S3/R2, Cloudflare, preview-gate, and deployment
> recommendations.

- Query: Select and define a browser CMS architecture for a single-author Astro publication where PostgreSQL is mandatory, Markdown remains the canonical body format, drafts and media are supported, and publication produces a static public site.
- Scope: mixed
- Date: 2026-07-31

## Findings

### Recommendation

Use **Directus 12.2.0 + PostgreSQL + S3-compatible object storage + Astro
7.1.6**.

PostgreSQL should be the sole authority for content and site configuration.
Git should contain application code, a Directus schema snapshot, deployment
configuration, and optional one-way portability exports. Do not implement
bidirectional synchronization between Git Markdown and PostgreSQL. It creates
two writable authorities, conflict resolution, and an ambiguous definition of
what is published.

The public Astro site should remain prerendered. At build time it reads only
published Directus records, renders the pages, RSS, sitemap, and metadata, then
runs Pagefind and deploys the resulting static assets to Cloudflare Workers.
Add one authenticated, non-prerendered Astro route for version-aware draft
preview. This keeps the reader experience static while satisfying Directus's
requirement that a static-site preview render current item data on request.

```text
Author -> Directus Studio -> Directus API -> PostgreSQL
                              |            -> S3-compatible media
                              |
                              + publish event -> Directus Flow -> build hook
                                                               -> Astro build
                                                               -> Pagefind
                                                               -> Cloudflare Workers

Directus Live Preview -> protected Astro preview route -> version-aware API read
Readers                -> prerendered HTML and static assets
```

### Why Directus Fits

| Requirement             | Directus evidence                                                                                                                                                                                                                       | Decision                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| PostgreSQL              | `DB_CLIENT` accepts `pg` or `postgres`.                                                                                                                                                                                                 | Native fit.                                                                                      |
| Canonical Markdown      | The Markdown interface is backed by a database `Text` field and provides a toolbar plus Edit and Preview modes.                                                                                                                         | Store the body as Markdown text, not HTML or editor JSON.                                        |
| Draft-first editing     | Versioned collections have reserved `published` and `draft` versions. Published content is read-only; new items begin as item-less drafts; required-field validation is deferred until publish; changes can be compared before publish. | Native fit for a single author without a custom workflow.                                        |
| Revision history        | Directus records revisions and supports comparison and restoration.                                                                                                                                                                     | Native fit, subject to a documented retention policy.                                            |
| Draft preview           | Live Preview accepts `{{$version}}`, and the frontend can request an item with `?version=draft`. Directus explicitly warns that an SSG must render preview data on request rather than only at build time.                              | Use one protected Astro on-demand route.                                                         |
| Media                   | Studio and API support uploads; the Markdown interface can be assigned a root folder; Directus supports S3 storage locations.                                                                                                           | Native fit. Use object storage rather than an ephemeral container volume.                        |
| Site-wide configuration | A collection can be marked Singleton, which bypasses its listing screen and opens its one item directly.                                                                                                                                | Use a versioned `site_settings` singleton.                                                       |
| Headless Astro frontend | Directus generates REST and GraphQL APIs and provides a TypeScript SDK.                                                                                                                                                                 | Fetch and validate records during `astro build`; do not query Directus from public browser code. |
| Schema promotion        | The Schema API can snapshot, diff, and apply a data model. The CLI supports applying a snapshot after bootstrap.                                                                                                                        | Commit a schema snapshot and apply it in controlled deployment steps.                            |
| Static build trigger    | Directus documents an Event Hook Flow followed by a Request URL operation to trigger an SSG build.                                                                                                                                      | Trigger CI after a published-row mutation, then coalesce duplicate builds.                       |

Directus's Markdown control is not a WYSIWYG editor. It is a source-oriented
Markdown editor with formatting controls and a rendered preview. That is the
correct tradeoff when Markdown must remain canonical. Adding Directus's WYSIWYG
interface would store HTML and reintroduce dual-format synchronization.

### Recommended Data Model

Use one versioned `entries` collection for all public writing:

| Field          | Suggested shape                                   | Notes                                                                                                         |
| -------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `id`           | UUID primary key                                  | Stable internal identity.                                                                                     |
| `slug`         | unique string, required                           | Public URL identity; do not regenerate when the title changes.                                                |
| `kind`         | enum: `article`, `tutorial`, `note`               | One collection, different presentation.                                                                       |
| `title`        | string, required                                  | Display title.                                                                                                |
| `summary`      | text, required                                    | Listing and metadata description.                                                                             |
| `body`         | text with Markdown interface, required at publish | Canonical authored body.                                                                                      |
| `status`       | enum: `published`, `archived`                     | Versioning represents editorial draft state. This field controls public visibility and supports unpublishing. |
| `published_at` | timestamp, required at publish                    | Sort and archive date.                                                                                        |
| `updated_at`   | managed timestamp                                 | Derived from the published row where possible.                                                                |
| `featured`     | boolean, default false                            | Optional homepage signal.                                                                                     |
| `cover`        | many-to-one relation to `directus_files`          | Optional.                                                                                                     |
| `cover_alt`    | string                                            | Validate as non-empty whenever `cover` is present.                                                            |
| `tags`         | many-to-many relation to `tags`                   | `tags` should have a stable unique slug and display label.                                                    |

Enable content versioning on `entries`. The author edits the reserved draft and
uses Publish to update the read-only published row. A new item's draft can be
incomplete, but the fields above must pass validation at publish time. The
static build and any public Directus permission must additionally filter
`status = published`. This extra filter is necessary so publishing an archived
version removes an entry from the next build.

Use a versioned `site_settings` singleton for site name, author identity,
description, biography, social links, default sharing image, and other global
metadata. Keep navigation structure in code unless editors genuinely need to
reorder it. This avoids turning a personal blog into a generic page builder.

Astro should derive reading time, heading outline, canonical URL, related
entries, and structured data during the build. Do not store these computed
values in Directus.

### API and Validation Boundary

Use `@directus/sdk` 24.0.0 from build-side TypeScript. Request a deliberate
field allowlist, filter `entries.status = published`, and sort deterministically.
The build credential should be a read-only service token stored in CI secrets,
never a client-side environment variable. An alternative is a tightly filtered
Public role, but Directus warns that public collection access exposes every row
unless item restrictions are configured correctly. A private build token gives
the smaller accidental-exposure surface.

Treat CMS data as untrusted external input even though there is one author.
Validate API responses at the Astro boundary, reject duplicate slugs and
invalid relations, parse Markdown with the project's chosen Markdown pipeline,
and fail the build rather than silently deploying missing content. The same
published-entry query must feed routes, lists, Pagefind, RSS, sitemap, metadata,
and related-entry generation so draft leakage cannot differ by feature.

### Draft Preview

Install the Cloudflare adapter but keep Astro's default static output. Mark only
a route such as `/preview/[id]` with `prerender = false`. Directus Live Preview
should pass both the item identity and `{{$version}}`; the route then performs a
server-side version-aware Directus read and renders the normal article
components.

Protect the preview hostname or route with Cloudflare Access (or an equivalent
author-only control) and keep the Directus preview service token in Worker
secrets. Do not append a reusable Directus token to a query string, even though
the Directus guide describes that as an option. Configure both sides' CSP:
Directus must allow the preview origin in `frame-src`, and the preview response
must allow the Directus origin in `frame-ancestors`.

The preview route must set `Cache-Control: private, no-store`, must never be
indexed, and must not be included in Pagefind or the sitemap. Public article
routes remain prerendered and do not gain sessions or database reads.

### Media

Configure an S3-compatible Directus storage location and store only asset
metadata in PostgreSQL. Use a dedicated content folder as the Markdown
interface's root folder. Covers should be relations to `directus_files`, not
free-form URLs, so dimensions, MIME type, and ownership remain queryable.

Serve public assets through a dedicated asset origin/CDN and grant no public
upload permission. Use UUID-based stable URLs, strip credentials, restrict
allowed MIME types and upload sizes, and decide whether replacing a file in
place is forbidden so long-lived CDN caching cannot serve stale bytes. Covers
can be fetched and optimized during the Astro build. Inline Markdown images can
initially use the CDN URL; mirroring every inline asset into the static build is
a separate portability enhancement, not required for the MVP.

The Markdown parser and Directus preview renderer may not support exactly the
same extensions. Define a portable Markdown/GFM subset, including the intended
footnote and fenced-code conventions, and add fixture tests for round-tripping
representative Chinese technical content. Sanitize raw HTML or disable it.

### Schema and Configuration as Code

Pin the production Docker image to `directus/directus:12.2.0`; Directus itself
recommends an explicit production version rather than `latest`.

After changing the data model in a development instance, generate a schema
snapshot (for example, `npx directus schema snapshot directus/schema.yaml`) and
commit it. On a new environment, bootstrap Directus and apply the reviewed
snapshot with `npx directus schema apply directus/schema.yaml`. Use schema diff
before applying to an existing environment and back up PostgreSQL first.

The snapshot is a data-model artifact, not a content backup. It does not replace
PostgreSQL backups, S3 versioning/backups, secrets management, or an explicit
record of environment-specific Flow and access-policy setup. Verify which
Directus system configuration is present in the chosen snapshot format before
depending on it; keep any missing Flow, permission, and role provisioning in a
reviewed bootstrap mechanism.

For portability, run a one-way export of published entries to Markdown plus a
JSON media manifest after successful builds or nightly. The export is a backup
and migration input only. It must never be accepted as a second writable source
for production content.

### Publish Trigger and Deployment

Configure a non-blocking Directus Event Hook Flow on the published collections,
then a Request URL operation that invokes an authenticated CI build hook.
Because versioned published rows are read-only, normal draft saves should
modify version records rather than the main `entries` row. Trigger on main-row
`items.create`, `items.update`, and `items.delete`, plus published changes to
`site_settings`, `tags`, and the entry/tag junction collection.

Do not use the common rule "build only when the new status is published" in
isolation. It misses unpublishing or deleting content and leaves stale public
pages deployed. Rebuild for both transitions into and out of public visibility.
Integration-test the exact Directus event scopes emitted by Publish, Unpublish,
relation edits, and item-less first publication before finalizing the Flow.

Recommended delivery sequence:

1. Directus Publish updates the PostgreSQL published row.
2. A signed build hook dispatches GitHub Actions (or an equivalent CI runner).
3. CI fetches and validates the complete published dataset using a read-only token.
4. CI runs the Astro production build, content tests, RSS/sitemap checks, and Pagefind indexing.
5. CI deploys static output to Cloudflare Workers only after every check succeeds.
6. Failed builds leave the previous deployment live and alert the author for retry.

Use CI concurrency to cancel or coalesce superseded builds. The hook must be
idempotent and authenticated; deployment credentials must not be stored in
content or exposed to the browser. Cloudflare deployment rollback restores a
previous static artifact, while the next successful full build reconciles it
with the current PostgreSQL state.

Directus, PostgreSQL, and object storage need independent health checks,
backups, restore drills, and upgrades. The public site remains available during
a CMS outage, but authoring, preview, and new builds will not. A build must fail
closed if Directus is unavailable.

### License Decision

Directus 12.2.0 is **not MIT licensed**. The current official licensing guide
states that it uses the Monospace Sustainable Core License (MSCL). An unlicensed
self-hosted instance runs on the core tier. Free commercial use through the
Open Innovation Grant is limited to eligible entities with less than USD 5M in
annual revenue and fewer than 50 employees; eligibility is evaluated across the
legal entities whose representatives use Studio. Confirm eligibility, tier
limits, activation needs, and acceptable future cost with the owner before the
architecture is approved.

Astro 7.1.6, Payload 3.86.0, Ghost 6.54.1, and `@directus/sdk` 24.0.0 report MIT
licenses. The SDK's MIT license does not change the Directus server license.

### Alternatives

| CMS             | PostgreSQL                                          | Canonical Markdown authoring                                                                                                                                                                                            | Draft/version support                                                | License                                   | Decision                                                                                                           |
| --------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Directus 12.2.0 | Native `pg`/`postgres` client                       | Native `Text` + Markdown interface, Edit/Preview                                                                                                                                                                        | Native draft-first content versioning and revisions                  | MSCL; grant eligibility must be confirmed | **Select**                                                                                                         |
| Payload 3.86.0  | Official Drizzle/Postgres adapter                   | First-class rich editor stores Lexical JSON. Official Markdown examples derive Markdown and deliberately delete the derived field before save. Canonical Markdown therefore needs a textarea or custom admin component. | Mature `_status`, versions, autosave, preview, and scheduled publish | MIT                                       | Viable fallback, but more custom editor work and a Next.js-based CMS application for an Astro frontend.            |
| Ghost 6.54.1    | **No**: official production support is MySQL 8 only | Card/rich editor with Markdown and HTML cards, not a canonical Markdown body contract                                                                                                                                   | Mature publishing product                                            | MIT                                       | Reject because mandatory PostgreSQL is unsupported; its membership/newsletter product surface is also unnecessary. |

Payload is the fallback if Directus licensing is unacceptable. It satisfies the
PostgreSQL requirement and has strong drafts, but its default authoring model is
Lexical editor JSON. Payload's official conversion example exposes a derived
Markdown field in `afterRead` and explicitly removes it in `beforeChange` so it
is not saved. Making Markdown authoritative would therefore mean accepting a
plain textarea/code editor or building and maintaining a custom admin field.
Payload also requires explicit access control that filters `_status =
published`; its docs warn that the draft query parameter alone does not protect
drafts. Scheduled publication additionally requires a running jobs processor.

Ghost is not a fallback under the confirmed constraints. Its official
production database support is MySQL 8 only, so choosing it would reverse the
mandatory PostgreSQL decision before editor or API fit is considered.

### Files Found

- `.trellis/tasks/07-31-blog-system/prd.md`: Current product requirements. Its content model and static-reader goals remain useful, but its Git-only authority and no-runtime-database decisions are stale.
- `.trellis/tasks/07-31-blog-system/research/design-references.md`: Existing platform research selecting Astro, Pagefind, Cloudflare Workers, and the now-superseded Pages CMS architecture.
- `.trellis/spec/frontend/index.md`: Frontend spec index; every project-specific guide is still marked "To fill."
- `.trellis/spec/backend/database-guidelines.md`: Database conventions template; no project database rules have been recorded yet.
- `PRODUCT.md`: Product seed referenced by the PRD; it does not define CMS storage or deployment contracts.
- `DESIGN.md`: Visual direction referenced by the PRD; it does not constrain CMS selection.

No application source, package manifest, database migration, or deployment
configuration exists yet. There are therefore no implementation code patterns
to preserve or cite.

### Local Code and Requirement Patterns

- `.trellis/tasks/07-31-blog-system/prd.md:52` requires one collection for articles, tutorials, and notes; the proposed `entries.kind` model preserves this.
- `.trellis/tasks/07-31-blog-system/prd.md:54` requires title, summary, kind, date, draft state, tags, and Markdown; all are represented directly or by Directus content versioning.
- `.trellis/tasks/07-31-blog-system/prd.md:58` requires derived reading metadata at build time; the proposed Astro boundary preserves this.
- `.trellis/tasks/07-31-blog-system/prd.md:60` requires complete draft exclusion across routes and indexes; one shared published-entry query should enforce it.
- `.trellis/tasks/07-31-blog-system/prd.md:122` requires public pages to be statically generated; only the author-only preview route should opt out.
- `.trellis/tasks/07-31-blog-system/research/design-references.md:69` already selects Astro as the frontend foundation.
- `.trellis/tasks/07-31-blog-system/research/design-references.md:99` already selects Pagefind for static Chinese search.
- `.trellis/tasks/07-31-blog-system/research/design-references.md:107` already selects Cloudflare Workers Static Assets.
- `.trellis/spec/frontend/index.md:15` and `.trellis/spec/backend/database-guidelines.md:19` show that implementation conventions remain unfilled; they cannot currently resolve data-fetching or migration details.

### External References

Checked on 2026-07-31. Package versions are the current npm `latest` values on
that date.

- Directus licensing: <https://directus.com/docs/raw/licensing/overview.md>
- Directus license text: <https://directus.com/license>
- Directus PostgreSQL configuration: <https://directus.com/docs/raw/configuration/database.md>
- Directus Markdown interface: <https://directus.com/docs/raw/guides/data-model/interfaces.md>
- Directus content versioning: <https://directus.com/docs/raw/guides/content/content-versioning.md>
- Directus live preview: <https://directus.com/docs/raw/guides/content/live-preview.md>
- Directus collection and singleton configuration: <https://directus.com/docs/raw/guides/data-model/collections.md>
- Directus access control: <https://directus.com/docs/raw/guides/auth/access-control.md>
- Directus SDK: <https://directus.com/docs/raw/guides/connect/sdk.md>
- Directus file upload and storage: <https://directus.com/docs/raw/guides/files/upload.md> and <https://directus.com/docs/raw/configuration/files.md>
- Directus schema promotion: <https://directus.com/docs/raw/tutorials/migration/promoting-changes-between-environments-in-directus.md>
- Directus migrations and schema apply: <https://directus.com/docs/raw/configuration/migrations.md>
- Directus production deployment and version pinning: <https://directus.com/docs/raw/self-hosting/deploying.md>
- Directus SSG build Flow example: <https://directus.com/docs/raw/tutorials/workflows/trigger-netlify-site-builds-with-directus-automate.md>
- Payload PostgreSQL adapter: <https://raw.githubusercontent.com/payloadcms/payload/3.x/docs/database/postgres.mdx>
- Payload drafts: <https://raw.githubusercontent.com/payloadcms/payload/3.x/docs/versions/drafts.mdx>
- Payload rich text and Markdown conversion: <https://raw.githubusercontent.com/payloadcms/payload/3.x/docs/rich-text/overview.mdx> and <https://raw.githubusercontent.com/payloadcms/payload/3.x/docs/rich-text/converting-markdown.mdx>
- Payload MIT license: <https://raw.githubusercontent.com/payloadcms/payload/main/LICENSE>
- Ghost production database support: <https://docs.ghost.org/faq/supported-databases.md>
- Ghost editor output: <https://docs.ghost.org/themes/content.md>
- Ghost MIT license: <https://docs.ghost.org/license/index.md>
- Astro on-demand rendering: <https://docs.astro.build/en/guides/on-demand-rendering/>
- Astro Cloudflare adapter: <https://docs.astro.build/en/guides/integrations-guide/cloudflare/>

### Related Specs

- `.trellis/spec/frontend/index.md`: The implementation must establish Astro data-boundary, validation, and test conventions because this index is currently a placeholder.
- `.trellis/spec/frontend/type-safety.md`: Should later record the rule that generated/declared SDK types do not replace runtime validation of CMS responses.
- `.trellis/spec/backend/database-guidelines.md`: Should later record PostgreSQL ownership, Directus schema snapshot promotion, backup, and no-bidirectional-sync rules.
- `.trellis/spec/guides/cross-layer-thinking-guide.md`: Relevant to tracing `status` from Directus through routes, search, RSS, sitemap, and deployment.

## Caveats / Not Found

1. **The PRD is stale and must be revised before implementation.** It still says Git-backed Markdown is the only content source (`prd.md:31`), browser saves must create Git commits (`prd.md:65`), production has no database or application API (`prd.md:137`), and a runtime database is out of scope (`prd.md:179`). The Pages CMS selection in `design-references.md:80` is likewise superseded. These statements directly conflict with the mandatory PostgreSQL decision and this recommendation.
2. The old requirement for both rich-text and raw-Markdown modes (`prd.md:66`) is not exactly met. Directus supplies Markdown Edit and Preview modes, not a WYSIWYG editor that round-trips the same Markdown. Confirm that source editing plus preview is acceptable; otherwise the canonical-format requirement needs a separate editor spike.
3. Directus is MSCL, not MIT. Open Innovation Grant eligibility has not been established for the owner and must not be assumed.
4. Directus schema snapshots cover the data model, not the complete operational state or content backup. Flow, role, permission, and policy promotion needs verification against 12.2.0 before production automation is designed.
5. The exact Flow events emitted when publishing an item-less draft, publishing an archived state, deleting a published item, and editing many-to-many tags were not proven against a running Directus 12.2.0 instance. This is a required integration spike because a missed event leaves stale static output live.
6. Version-aware preview of an item-less draft was documented conceptually but not exercised. If Directus cannot supply a stable item identity before first publish, first-publication preview needs a versions-API-specific route.
7. Directus Markdown preview parity with the eventual Astro remark/rehype stack is not guaranteed. Footnotes, code-fence metadata, raw HTML, and asset URL behavior require fixtures before authors rely on them.
8. PostgreSQL and S3 backup/restore targets, hosting region, Cloudflare build-hook mechanism, domain names, and legal license eligibility are not yet specified.
