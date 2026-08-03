# Technical Design: Personal Blog System

## 1. Design Summary

The system has one content authority and two delivery surfaces:

1. Directus Studio is the private authoring and administration surface.
2. PostgreSQL is the single source of truth for content, taxonomy, media
   metadata, revisions, and editable site settings.
3. A persistent Directus upload volume on the VPS holds media bytes referenced
   by PostgreSQL.
4. Astro reads a validated snapshot from Directus during a build and emits
   static public pages plus one protected on-demand preview route.
5. Pagefind indexes the generated HTML. An Astro Node container serves the site
   behind Caddy in Docker Compose on the owner's VPS.

Normal public requests never query Directus or PostgreSQL. This keeps reading
fast and available during CMS maintenance while still giving the owner a
database-backed workflow.

```text
Owner browser
    |
    | HTTPS + Directus login/MFA
    v
Directus Studio/API ----> PostgreSQL
    |                         |
    | media metadata          | content, config, revisions
    v                         |
Persistent uploads volume <---+
    |
    | publish/config event
    v
GitHub Actions -> validated content snapshot -> Astro -> Pagefind
    |                                                   |
    +---------- immutable Docker image -> VPS ----------+
                                        |
                           Caddy -> Astro Node
                                        |-- prerendered public pages
                                        +-- protected preview -> Directus API
```

## 2. Selected Stack

| Concern            | Selection                                             | Reason                                                                                                                                                         |
| ------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CMS/API            | Directus, exact image version pinned                  | Mature database-first Studio, Markdown interface, permissions, revisions, content versions, files, REST/GraphQL, and schema snapshots without a custom backend |
| Database           | PostgreSQL 17                                         | Durable relational constraints, standard backups, and first-class Directus support                                                                             |
| Media              | Directus local storage on a persistent VPS bind mount | Keeps large binaries out of PostgreSQL, remains simple on one host, and preserves database-owned metadata and relationships                                    |
| Frontend           | Astro with strict TypeScript and the Node adapter     | Fully custom routes, layouts, CSS, Markdown, and optional framework islands with static-first public output and one server preview route                       |
| Content API client | Official Directus SDK plus runtime schema validation  | Least custom protocol code and an explicit trust boundary                                                                                                      |
| Markdown           | A single remark/rehype pipeline with Shiki            | Portable Markdown, deterministic headings, GFM, footnotes, safe HTML handling, and high-quality code rendering                                                 |
| Search             | Pagefind extended build                               | Static search with Chinese segmentation and no search service                                                                                                  |
| Runtime            | Docker Compose on one VPS                             | Runs Caddy, one Astro site service, Directus, and PostgreSQL with explicit volumes and networks                                                                |
| Reverse proxy      | Caddy                                                 | Automatic TLS, compression, headers, and fixed routing to the private site/CMS services                                                                        |
| Automation         | GitHub Actions plus a small VPS deploy script         | Produces immutable images, coalesces content builds, preflights a candidate, and preserves one-command prior-image rollback                                    |
| Offsite recovery   | Restic-compatible remote repository                   | Encrypts PostgreSQL dumps and upload snapshots outside the VPS without becoming a runtime dependency                                                           |

Directus currently uses the Monospace Sustainable Core License rather than an
OSI open-source license. Personal internal self-hosting is a permitted use and
does not compete with Directus' hosted offering. The implementation must pin a
version, record the applicable license/key tier, and re-check the terms before
any future commercial or hosted-CMS use.

Astro is used as a rendering framework, not a blog product or theme boundary.
The project owns every public component, route, style, content transform, and
interaction. Native `.astro` components and CSS are the default; React, Vue, or
Svelte islands remain available for a future interaction that genuinely needs
one, without forcing that runtime across the reading experience.

## 3. System Boundaries

### 3.1 Directus owns

- Author authentication, MFA, and administrative permissions
- Content entry forms, Markdown edit/preview, media library, drafts, revisions,
  and content versions
- PostgreSQL schema metadata and schema snapshots
- Publication/configuration event flows
- Read-only REST API used by build and preview services

No custom Directus extension is planned for the initial release. Configuration,
field validation, roles, and flows use supported platform features.

### 3.2 The Astro application owns

- Runtime validation and projection of Directus records into one frontend
  `Post` contract
- Markdown parsing, safe HTML generation, heading IDs, code highlighting,
  reading time, related-content selection, and media resolution
- Public routes, design system, metadata, feeds, sitemap, and search markup
- Static build behavior and the private preview route

The frontend never writes to Directus. It does not expose a generic API proxy.

### 3.3 PostgreSQL owns

- Relational integrity and uniqueness
- Content, settings, taxonomy, Directus system metadata, revisions, and users
- Durable timestamps and audit relationships

Application code does not query PostgreSQL directly. Directus is the only data
access layer so permissions and schema metadata are not duplicated.

### 3.4 The uploads volume owns

- Original uploaded media bytes

The Directus upload directory is a durable, explicitly mounted VPS path rather
than container-layer storage. Original files are immutable: a replacement gets
a new Directus file ID. Directus folders provide two permission scopes:
`publishable-assets` for media intended to become public and
`private-draft-assets` for draft-only material. The Build Reader can access only
the former; the Preview Reader can access both. Publication validation rejects
public references to the private scope. The routine Author cannot replace file
bytes or hard-delete originals; reviewed cleanup uses the break-glass
Administrator after checking current references and backups. Published builds
emit optimized public variants, so no upload becomes reader-accessible merely
because it exists in Directus. Encrypted snapshots of PostgreSQL dumps and this
volume are copied to an off-VPS backup repository.

## 4. Data Model

Directus system fields use its supported conventions. Project collection and
field names use lower-case snake_case.

### 4.1 `posts`

| Field                 | Shape                | Rules                                                                                   |
| --------------------- | -------------------- | --------------------------------------------------------------------------------------- |
| `id`                  | UUID primary key     | Generated once; never used as the public URL                                            |
| `status`              | enum                 | `published` or `archived` on the main item; Directus versions own editorial draft state |
| `kind`                | enum                 | `article`, `tutorial`, or `note`                                                        |
| `title`               | string               | Required, trimmed, practical display-length limit                                       |
| `slug`                | string               | Required, lower-case ASCII kebab-case, unique, immutable after first publish            |
| `summary`             | text                 | Required for article/tutorial; optional for note and derived when absent                |
| `body`                | text                 | Required Markdown for publication; no MDX                                               |
| `published_at`        | timestamptz          | Required for `published`, null for a new draft                                          |
| `featured`            | boolean              | Default false; affects homepage selection only                                          |
| `cover_image`         | M2O `directus_files` | Optional                                                                                |
| `cover_alt`           | string               | Required with a meaningful cover; empty only when explicitly decorative                 |
| `cover_decorative`    | boolean              | Default false                                                                           |
| `seo_title`           | string               | Optional override with length guidance                                                  |
| `seo_description`     | string               | Optional override with length guidance                                                  |
| Directus audit fields | user/timestamps      | Managed by Directus                                                                     |

Indexes cover unique `slug`, `(status, published_at)`, and
`(status, kind, published_at)`. Status transition validation enforces the
publication requirements. Slug validation avoids case-collision ambiguity.

### 4.2 `topics`

| Field         | Shape            | Rules                               |
| ------------- | ---------------- | ----------------------------------- |
| `id`          | UUID primary key | Generated                           |
| `name`        | string           | Required, unique display name       |
| `slug`        | string           | Required, unique, stable kebab-case |
| `description` | text             | Optional public introduction        |

`posts_topics` is a normal many-to-many junction with unique `(posts_id,
topics_id)` and indexes on both foreign keys.

### 4.3 `site_settings` singleton

| Field                                                   | Shape                                                 |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `site_name`, `author_name`                              | Required strings                                      |
| `tagline`, `homepage_intro`, `biography`, `footer_text` | Markdown or plain text according to presentation need |
| `default_seo_description`                               | Required plain text                                   |
| `avatar`, `default_og_image`                            | M2O `directus_files`                                  |
| `locale`                                                | Constrained locale; initial value `zh-CN`             |
| `timezone`                                              | Valid IANA identifier; initial value `Asia/Shanghai`  |

Environment-specific canonical origin, CMS endpoint, credentials, and storage
configuration are not database settings. `SITE_URL` remains an environment
variable so preview and production cannot accidentally share canonical URLs.

### 4.4 `social_links`

Child records hold `site_settings_id`, `label`, `url`, a constrained icon key,
and `sort`. A collection gives the CMS a usable form and gives the frontend a
typed relation instead of an unstructured JSON blob.

### 4.5 Directus system collections

`directus_users`, `directus_roles`, `directus_policies`, `directus_files`,
`directus_folders`, `directus_revisions`, `directus_versions`, and flow tables
remain platform-owned. Project code does not modify them with hand-written SQL.

## 5. Content Contract

The Directus SDK query selects explicit fields and paginates until complete.
The response is parsed from `unknown` once, at the content boundary. A failed
record stops the build with a field-level diagnostic and cannot produce a
partial deployment.

The frontend projection has these invariants:

- Dates are UTC ISO strings at the API boundary and `Date` values only inside
  derivation/rendering code. Human dates use `site_settings.timezone`; feeds and
  machine metadata remain unambiguous ISO timestamps.
- Relations are normalized to arrays; missing optional media stays `null`.
- A note without a manual summary derives a plain-text excerpt from Markdown.
- Related entries are derived deterministically from shared topics and kind,
  with recency as a tie-breaker.
- Draft versions are absent from ordinary item reads; main items with
  `status=archived` are filtered in the Directus query and asserted again before
  route generation as defense in depth.
- Public URLs derive from kind and slug, never database IDs or mutable titles.

The same parser and projection are used by production build, tests, and preview
so draft preview cannot drift from published rendering.

## 6. Markdown and Media Pipeline

One rendering pipeline provides:

- CommonMark and GitHub-flavored Markdown
- Footnotes, tables, task lists, fenced code, and a small documented callout
  directive
- One validated code-fence metadata grammar for filename, highlighted lines,
  and diff state; invalid metadata fails the build with a source location
- Stable, collision-safe heading IDs and a derived outline
- Shiki syntax highlighting at build/render time
- Safe external-link attributes and URL protocol validation
- Raw HTML disabled by default; any explicitly supported HTML is sanitized
- Code metadata and a progressively enhanced copy control

CMS media references use immutable Directus file IDs, not provider-specific
bucket URLs. During a production build, a media resolver fetches referenced
files from `publishable-assets` with the read-only build credential, validates
type and size, sanitizes allowed SVG, generates responsive raster variants, and
writes hashed static assets. Preview uses the same resolver in server mode and
may stream protected private-draft assets without exposing credentials. The
build also validates every internal route, fragment, and media reference; it
does not make release success depend on checking third-party link availability.
Routine automation never replaces or deletes an original; orphan cleanup is a
reviewed maintenance action.

Remote hotlinked images are not part of the authored-content contract. This
avoids broken dimensions, privacy leakage, and third-party availability in
otherwise static pages.

A print stylesheet uses the same semantic document but removes navigation,
progress, copy controls, and other chrome. It preserves visible link targets,
headings, code, tables, footnotes, and nondecorative media.

## 7. Routes and Rendering

### 7.1 Static public routes

- `/` - identity, featured/latest writing, and recent notes
- `/writing/` - article/tutorial archive with kind and topic navigation
- `/writing/[slug]/` - long-form article or tutorial
- `/notes/` and `/notes/[slug]/` - compact notes stream and permalink
- `/topics/` and `/topics/[slug]/` - taxonomy index and archive
- `/archive/` - complete chronological archive
- `/search/` - lazily loaded Pagefind experience
- `/about/` - database-configured author profile
- `/rss.xml`, `/sitemap-index.xml`, `/robots.txt`, and `/404`

Every public content route is prerendered. The last successful deployment stays
available when Directus, PostgreSQL, or the build pipeline is unavailable.
The root document uses the validated `site_settings.locale` (`zh-CN` at launch),
which also selects Pagefind's Chinese index behavior. Mixed-language passages
may declare a narrower `lang` without changing the route language.

### 7.2 Dynamic private route

`/preview/[id]` is rendered on demand by the Astro Node adapter. Caddy protects
the path with HTTPS basic authentication whose hash is environment-managed.
Caddy removes any client-supplied preview-auth header, injects a trusted
internal header only after successful authentication, and proxies to the Astro
container over the private Docker network. Astro verifies that header, fetches
the requested Directus item/version server-side, sets `Cache-Control: private,
no-store` and `X-Robots-Tag: noindex, nofollow`, and never embeds service
credentials in HTML.

Unknown, unauthorized, archived, or malformed preview IDs return a generic
non-disclosing error. Preview is excluded from sitemap, RSS, search, analytics,
and link discovery.

### 7.3 Reference-derived public visual system

`aiayy.cn` is the primary composition and interaction reference, not a template
or implementation dependency. The project recreates its recognizable material
language with project-owned Astro markup and CSS: a floating capsule header,
single-surface light/dark neumorphism, blue signal color, asymmetric Bento
homepage, clipped featured media, raised/inset control states, scroll
compression, and restrained entry/typing motion. It does not reuse the
reference's identity, words, imagery, data, routes, icon-category mapping, or
source code.

The token system owns semantic roles instead of component-specific shadow
values:

- color: base surface, raised surface adjustment, primary ink, secondary ink,
  blue signal, focus ring, and real semantic success/warning/error roles;
- depth: `flat`, `raised`, `inset`, and `floating`, each with paired shadows for
  light and dark themes plus a border fallback for forced colors;
- shape: capsule navigation/compact controls, medium content modules, and
  tighter article/code/media radii rather than one radius everywhere;
- motion: short press/lift feedback, one header compression curve, and one
  optional hero phrase sequence, all removed or made instantaneous under
  reduced motion.

Home uses desktop's reference proportions without copying its content: a compact
author identity module sits beside a larger featured post/tutorial module with a
real post artifact or a text-led signal surface. The next Bento cells expose
latest writing, recent notes, topics, and Search/Archive/RSS shortcuts. There is
no visitor count, popularity tab, binary clock, generic technology logo grid, or
decorative 3D destination. At narrow widths the featured/current writing moves
ahead of the expanded author card, modules become one column, media becomes a
bottom crop, and useful reading remains in the first viewport.

Writing, Notes, Archive, Topics, and Search borrow the reference's raised list
rows, compact pills, and inset search/control treatment. They do not repeat an
identical icon card for every topic. About may use a small Bento composition
because identity is the content. Article/tutorial pages retain the capsule shell
but place prose on a flat, high-contrast 34–42-Han-character reading plane; only
the outline, code frames, media, callouts, and controls use controlled depth.

The reference's colors are evidence, not tokens. Its dim reference values
measure only 3.13:1 on dark and 2.23:1 on light, so this implementation raises
secondary text to WCAG AA, keeps blue link/focus contrast at AA, uses 44px
standalone targets, and never relies on shadow alone for focus or state. Content
is visible before scripts run; the type phrase is enhancement-only, the header
compression reserves stable space, and no opacity entrance can leave a page
blank in reduced-motion, background-tab, print, or headless contexts.

## 8. Publication and Deployment Flow

### 8.1 Production topology

Production Docker Compose defines these services:

| Service    | Exposure                                                                | Persistent data                               |
| ---------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| `caddy`    | Host ports 80/443 only                                                  | TLS state and rotated access/error logs       |
| `site`     | Private `web` network                                                   | None; runs the selected immutable Astro image |
| `directus` | Private networks; reached publicly only through Caddy at `cms.<domain>` | `/directus/uploads` bind mount                |
| `postgres` | Private `data` network only                                             | PostgreSQL data bind mount                    |

Caddy and `site` share `web`. Directus joins `web` and `data`; PostgreSQL joins
only `data`. No application or database port is published directly on the host.
The site needs Directus at runtime only for the private preview route; its
normal public pages and media variants are already inside the image. The deploy
script may start one short-lived, traffic-free candidate container on `web` for
preflight; it is not a permanent service.

Compose uses explicit pinned image references, health checks, restart policies,
log-size limits, resource ceilings appropriate to the VPS, and
`no-new-privileges` or read-only filesystems where each upstream image supports
them. PostgreSQL and uploads use documented host bind paths under the deployment
directory so backup and disk usage are visible.

### 8.2 Code deployment

1. A push or pull request runs formatting, lint, type/content validation, unit
   tests, production build, Pagefind indexing, and browser smoke tests.
2. Pull requests build and exercise the Docker image in CI with fake fixtures;
   they do not receive access to production drafts or credentials.
3. A successful default-branch workflow fetches the published snapshot with a
   read-only token, builds the Astro output, and publishes an image to GHCR. It
   resolves and records the OCI digest; build credentials are CI-only and are
   not image layers or runtime env.
4. A forced-command SSH deploy key invokes the reviewed VPS deploy script with
   only an allow-listed `ghcr.io/<owner>/<site>@sha256:<digest>` reference. The
   entrypoint rejects every other repository, argument shape, and command.
5. Under a deployment lock, the script pulls the image and starts a uniquely
   named candidate container with the production runtime contract but no Caddy
   traffic. It waits for `/healthz`, checks representative static routes, then
   removes the candidate.
6. The script records the running image digest as rollback state, updates the
   single `site` service to the candidate digest, waits for Compose health, and
   runs a graceful Caddy reload so the fixed Docker-DNS upstream is freshly
   resolved, then runs external smoke checks. Failure redeploys the recorded
   digest and reloads Caddy again; success records current/previous digests and
   prunes only safe old site images. Human-readable commit tags remain trace
   labels, never deployment identity.

Replacing the one site container may cause a few seconds of restart time. That
is acceptable for this personal publication and avoids permanent blue/green
services, dynamic proxy state, and a more failure-prone deploy script.

### 8.3 Content deployment

1. The owner saves freely in Directus' reserved draft version; no public build
   runs.
2. Directus validates required fields when the draft is published to the main
   row, or when a published row is archived/unpublished.
3. A Directus Flow calls the GitHub `repository_dispatch` endpoint. Its
   fine-grained credential is exposed to the Flow only through the Directus
   environment allow-list, not stored in collection data or Git. A failed
   dispatch follows an owner-visible rejection path; manual workflow dispatch
   remains the recovery action.
4. GitHub Actions fetches the complete published snapshot and referenced media
   from the VPS Directus API with the Build Reader token.
5. Validation, Astro generation, Pagefind, tests, image publication, candidate
   preflight, and the single-service VPS replacement run. CI concurrency
   cancels stale content builds so the newest complete snapshot wins.
6. Failure sends an owner-visible CI notification and leaves the previous
   image running or automatically restores it. A manual workflow dispatch can
   retry without a content edit.

Relevant changes include published posts, topics used by published posts,
public site settings, social links, and referenced media metadata. Draft-only
edits do not trigger production builds.

The operational publication latency target is under five minutes. Immediate
request-time publication is intentionally not required because static delivery
removes a database dependency from every reader request.

### 8.4 Infrastructure and schema releases

The frequent code/content workflow is deliberately allowed to change only the
`site` image digest. It never updates its own host deploy script and never
applies Compose, Caddy, Directus/PostgreSQL image, or database-schema changes.

Those infrequent changes use an owner-run maintenance release from a reviewed,
pinned Git commit. The runbook creates and verifies a pre-change offsite backup,
validates Compose and Caddy configuration, inspects the Directus schema diff,
applies only the expand step, updates the affected services, and runs CMS plus
public smoke checks. The prior repository commit, container digests, host
configuration, and database backup remain available for rollback. Contracting
an old field is a later maintenance release after no deployed site digest reads
it. This split keeps a compromised content webhook from mutating host
infrastructure and makes schema changes explicit without adding a staging stack.

## 9. Permissions and Security

### 9.1 Directus policies

- `Author`: the owner's MFA-protected daily account; creates, versions,
  publishes, archives, and restores project content/settings but cannot manage
  platform users/policies, replace file bytes, or hard-delete files.
- `Administrator`: a separate break-glass account for schema, policy, token, and
  account recovery; credentials and MFA recovery material live in the owner's
  password manager and are not used for routine writing.
- `Build Reader`: read only published posts, related topics, public settings,
  social links, and the `publishable-assets` file scope; build code fetches only
  media referenced by the current snapshot.
- `Preview Reader`: server-only read access to drafts, selected versions,
  relations, and both approved asset scopes; no writes or user/role access.
- `Public`: no read or write access to project or system collections.

Build and preview credentials are distinct static tokens so either can be
rotated or revoked without affecting the owner account.

### 9.2 Network and browser controls

- The VPS firewall accepts 80/443 and restricted SSH only. SSH uses keys,
  disables password/root login, and is not exposed through application
  containers.
- Caddy is the only container publishing host ports. PostgreSQL is reachable
  only on the private `data` network.
- `cms.<domain>` uses Directus login plus MFA and rate limiting. `/preview/*`
  additionally uses Caddy basic authentication and the trusted-header boundary
  described above.
- Directus CORS allows only required authoring/preview origins.
- Authentication cookies use secure settings; login and API endpoints are rate
  limited.
- Public pages use a restrictive CSP, HSTS after domain validation,
  `Referrer-Policy`, `X-Content-Type-Options`, and a permissions policy.
- The pre-paint theme bootstrap is a deterministic inline script covered by an
  exact CSP hash. Search, preview framing, code copy, and Pagefind WebAssembly
  are exercised under the final route-specific policy; CSP is never weakened
  with a blanket `unsafe-inline` merely to make an enhancement work.
- Secrets are environment-managed and masked in CI. Fixture exports contain no
  users, tokens, revisions, or private media URLs.
- Production env files are owner-readable only and excluded from both Git and
  application backups. A password-manager inventory covers every secret needed
  to restore or reconnect the stack: Directus and database secrets, human/MFA
  recovery, build/preview/dispatch/GHCR credentials, preview authentication,
  SSH deploy access, and the Restic repository key. Each entry says whether to
  restore the value or rotate/recreate it; no value is duplicated in the
  repository.
- Caddy obtains and renews public TLS certificates automatically. Certificate
  storage is persistent but recoverable; DNS and an offsite restore do not
  depend on copying private certificate keys.

## 10. Schema and Environment Management

The repository contains:

- A pinned Directus container version
- Production Docker Compose configuration for Caddy, one Astro site service,
  Directus, PostgreSQL, and an on-demand backup profile
- A development Compose override that exposes only localhost ports
- A reviewed Caddyfile, health endpoints, and candidate-preflight deployment
  script with explicit prior-image rollback
- A sanitized `.env.example`
- A Directus schema snapshot covering project collections, fields, relations,
  interfaces, validation, policies, and flows where supported
- A small non-sensitive development seed/fixture set

Schema changes are made in a development Directus instance, snapshotted,
reviewed, and promoted with expand/deploy/contract ordering. A release first
adds backward-compatible fields and applies that snapshot, then deploys code
that can use them. Removing or renaming the old fields is a later reviewed
release after no running image reads them. Content data and site settings are
never embedded in schema snapshots. Every production apply starts with a
verified PostgreSQL backup and an inspected diff.

Development and production both use Directus' local storage driver with
different mounted paths. The frontend addresses files by Directus ID, so a
future move to an S3 driver would not alter post records. Production uploads
must never use an anonymous Docker volume or the writable container layer.

## 11. Backup, Recovery, and Observability

### 11.1 Backup policy

- A host timer invokes the Compose `backup` profile nightly. The short-lived
  backup container writes a PostgreSQL custom-format logical dump, verifies it,
  and snapshots the dump plus Directus uploads with Restic.
- The Restic repository is encrypted and physically outside the VPS (for
  example S3-compatible storage, SFTP, or a second server). It is recovery
  infrastructure, not a public-site runtime dependency.
- Retention keeps 14 daily, 8 weekly, and 12 monthly restore points. Prune and
  integrity checks run separately from snapshot creation.
- Backup jobs record size, checksum, duration, and success/failure without
  logging secrets or content bodies.
- The temporary dump is mode `0600`, lives outside the public/upload paths, and
  is removed after a successful or failed Restic attempt. Original media is
  immutable and not hard-deleted routinely, so a database dump followed by an
  upload snapshot may contain harmless extra files but cannot omit a file that
  the dump still references.
- Raw live PostgreSQL files are not copied as a substitute for a consistent
  logical dump. Caddy certificates and regenerable container layers are not
  required recovery data.
- At least quarterly, a clean environment restore imports the PostgreSQL dump
  and uploads, starts the pinned Directus version, and compares the restored
  schema with the repository snapshot before proving stable URLs and a
  representative frontend build. A full database restore already contains the
  project and Directus schemas, so automation never blindly applies the schema
  snapshot on top of it; schema apply is for a fresh bootstrap or an explicitly
  reviewed repair. Nightly frequency defines an RPO target of 24 hours; the
  drill targets a four-hour RTO under normal network and DNS conditions.

Revision history is not a substitute for backup: revisions handle an editorial
undo, while database/media backups handle deletion or infrastructure failure.

### 11.2 Operational signals

- Docker health checks cover Caddy, the site, Directus, and PostgreSQL; Compose
  restart policies recover an isolated process failure. Candidate health is
  checked separately during deployment.
- GitHub Actions separates fetch, validation, build, index, test, and deploy
  failures.
- The owner receives failure notifications for publication builds and backups.
- Caddy and Docker logs rotate by size. VPS disk-space/inode thresholds alert
  before PostgreSQL or uploads exhaust the filesystem.
- Image cleanup is scoped to this site's repository and protects the deployed
  and recorded rollback digests. It never runs a host-wide prune that could
  affect unrelated VPS workloads.
- A simple external HTTPS monitor checks the public home page and CMS health
  endpoint; a full Prometheus/Grafana stack is not introduced for one host.
- Logs use request/build identifiers and never include tokens, Markdown bodies,
  or preview URLs.

No Redis, queue, or multi-replica Directus deployment is introduced initially.
Add Redis only if multiple Directus replicas or measured cache/coordination
needs appear.

## 12. Failure and Rollback Behavior

| Failure                    | Expected behavior                                                             | Recovery                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Invalid content or config  | Build fails before deploy; production is unchanged                            | Correct the CMS record and republish                                                                               |
| Directus/PostgreSQL outage | Public static site remains available; authoring and preview pause             | Restore service or database backup                                                                                 |
| Media fetch failure        | Build fails rather than emitting broken public media                          | Restore upload or fix reference, then rebuild                                                                      |
| Bad published edit         | Static deployment can roll back immediately                                   | Restore Directus revision and deploy corrected snapshot                                                            |
| Bad frontend release       | Candidate preflight blocks it, or the post-replacement smoke check detects it | Redeploy the recorded prior image digest; no content migration required                                            |
| Directus upgrade failure   | Existing public site remains available                                        | Roll back pinned image if schema-compatible; otherwise restore pre-upgrade backup                                  |
| Credential exposure        | Revoke the one scoped credential                                              | Rotate environment secret and redeploy affected service                                                            |
| VPS loss                   | Public site and authoring are unavailable                                     | Provision a replacement VPS, apply Compose/schema, restore PostgreSQL/uploads from offsite Restic, and repoint DNS |
| Disk exhaustion            | Writes/builds stop before corruption; existing site may remain readable       | Stop publication, free safe caches/images, expand disk, and verify PostgreSQL/uploads before resuming              |

Database restores are destructive last-resort operations and require a fresh
backup plus an explicit maintenance window. Normal content corrections use
Directus revisions and a new static deployment.

## 13. Alternatives and Trade-offs

### Astro vs Next.js or a prebuilt blog framework

Astro is selected because it does not impose a theme, design system, CMS model,
or client framework. It gives direct ownership of HTML, CSS, routes, Markdown,
server endpoints, and component boundaries, while its island integrations leave
React, Vue, and Svelte available for isolated future features. The Node adapter
supports the one live preview route required by this architecture.

Next.js could also produce a fully custom site, but its persistent React server,
cache/revalidation model, and larger default client/runtime surface solve no
confirmed requirement once public pages are rebuilt on publication. A prebuilt
Astro blog theme would reduce design ownership and is explicitly rejected.

### Directus vs Payload

Directus is selected because its database-first Studio, field-level Markdown
interface, schema introspection, revisions, and generated APIs cover the CMS
without building an admin application. Payload is permissively licensed and
excellent when the CMS lives inside a custom Next.js application, but its
standard editor stores Lexical structured data; preserving Markdown as the
canonical body would require a custom editor field and more application code.

### Directus vs Ghost

Ghost has a polished editorial experience but centers its own publishing,
membership, theme, and Koenig-content model. The requested mixed content model,
portable Markdown body, custom Astro reading experience, and database-owned
settings fit Directus more directly.

### Static public site vs full SSR

Static public output adds a short publication delay but provides the best
reader performance, cheap scaling, straightforward search/SEO generation, and
continued availability during CMS/database outages. One protected SSR preview
route supplies the only author workflow that truly needs live database access.

### Docker VPS vs managed edge hosting

One Docker Compose VPS is selected because the owner explicitly wants control of
the runtime and deployment. Caddy, Astro, Directus, PostgreSQL, volumes, and
network boundaries remain inspectable and portable. This adds responsibility
for patching, disk capacity, TLS/DNS, monitoring, and offsite recovery; the
documented health checks, candidate preflight, immutable rollback image, and
Restic restore path address those obligations without Kubernetes or a managed
platform.

### Database source vs Git synchronization

A bidirectional Git/database workflow is rejected. It creates conflict rules,
duplicate revision systems, and failure modes without improving the browser
authoring experience. Portable Markdown and tested exports provide ownership
without a second live source.

### Persistent upload volume vs object storage or PostgreSQL binary data

For one VPS, a Directus local-storage bind mount is the fewest moving parts and
keeps the runtime self-contained. PostgreSQL retains ownership of file identity,
metadata, and relationships; storing bytes as `bytea` would increase database
load and logical backup size. If storage outgrows the VPS, multiple Directus
replicas are needed, or a dedicated asset CDN becomes necessary, the same file
IDs can move to Directus' S3 driver without changing post content. Offsite
Restic storage is backup only and does not create a live media source.

## 14. Compatibility and Migration

There is no existing product database or published content to migrate. Initial
real content can be entered through Directus or imported once from Markdown by
an explicit, idempotent import script. The import is a bootstrap tool, not a
continuing sync mechanism.

Exports preserve post IDs, slugs, Markdown bodies, timestamps, status, topic
slugs, settings, and file references in documented JSON/Markdown form. This
keeps a future migration possible even though the running system uses Directus.
