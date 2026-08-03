# Research: Docker VPS Deployment and Frontend Customization

- Decision date: 2026-08-03
- Requirement: Deploy production with Docker on the owner's VPS, not
  Cloudflare Workers; use a frontend framework only if it preserves maximum
  product and visual customization.
- Supersedes: the hosting, media-runtime, preview-authentication, and frontend
  deployment sections of `cms-architecture.md`. Its Directus/PostgreSQL/CMS
  comparison remains valid.

## Decision

Keep Directus 12.2.0, PostgreSQL 17, Astro 7.1.6, Pagefind, and the database
content model. Replace Railway/R2/Cloudflare Workers with one production Docker
Compose stack on the owner's VPS:

```text
Internet
  |
  v
Caddy :80/:443
  |-- site domain ------> Astro Node `site`
  |                         |-- prerendered public pages and media
  |                         +-- authenticated dynamic preview
  +-- cms subdomain ----> Directus ----> PostgreSQL
                              |
                              +--------> persistent uploads bind mount
```

Only Caddy publishes host ports. PostgreSQL is on a private data network.
Directus and Astro are addressed by Docker DNS. The host firewall
allows HTTP/HTTPS and restricted key-only SSH.

Use GitHub Actions as build automation, not as a production runtime. Code and
Directus publish events build an Astro image with the complete published
snapshot and Pagefind index, push it to GHCR, resolve its immutable OCI digest,
then invoke a constrained VPS deployment command. CI can be replaced later by
another OCI-capable runner without changing the site, CMS, database, or Compose
topology.

## Why Astro Still Fits Maximum Customization

Astro is not a CMS, theme system, or page builder. Its `.astro` files emit
project-owned HTML, and the project controls every route, component, layout,
style, Markdown transform, asset rule, metadata record, and client interaction.
It supports framework islands for React, Vue, Svelte, and others, so a later
interactive demonstration is possible without converting the entire reading
experience into a client application.

The implementation therefore uses:

- no purchased or starter blog theme;
- no component UI kit that determines visual language;
- native HTML and CSS custom properties by default;
- a project-owned remark/rehype/Shiki pipeline;
- custom Astro layouts and components;
- an integration island only when native HTML/CSS and a small script cannot
  satisfy a measured interaction.

Next.js was considered. It also allows custom design, but its persistent React
runtime, server cache/revalidation behavior, and larger default client boundary
do not improve the confirmed publication model. Astro provides the needed Node
preview endpoint while allowing all public content to remain prerendered.

## Container Topology

### `caddy`

- Terminates and renews TLS automatically.
- Redirects HTTP to HTTPS, compresses responses, applies public security/cache
  headers, and proxies the site and CMS hostnames.
- Protects `/preview/*` with basic authentication and injects a trusted internal
  authorization header after removing any client-supplied copy.
- Proxies to the fixed private `site` service; deployment does not rewrite Caddy
  state.
- Persists certificate state and rotates logs.

### `site`

- Runs the selected immutable Astro Node image.
- Serve prerendered pages, hashed media, Pagefind, and a lightweight `/healthz`.
- Use a server-only Directus Preview Reader token for `/preview/[id]`; normal
  public requests perform no CMS or database call.
- Have no writable application-data volume.

### `directus`

- Uses an exact pinned image, never `latest`.
- Joins the web network for Caddy/site access and the data network for
  PostgreSQL.
- Stores uploads at `/directus/uploads`, mapped to an explicit host directory.
- Exposes the Studio/API only through Caddy. Directus login, MFA, rate limits,
  deny-all Public policy, and scoped Build/Preview Reader tokens remain
  required; a private Docker network is not an authorization system.

### `postgres`

- Uses PostgreSQL 17 with an explicit data directory mount.
- Joins only the data network and publishes no host port in production.
- Receives a health check and a conservative memory/connection configuration
  appropriate to the VPS.

### Backup profile

A short-lived operations container has the PostgreSQL client and Restic. A host
timer invokes it; no scheduler, MinIO, Redis, Prometheus, or Kubernetes service
is added to the always-running stack.

## Media Decision

Directus local storage on a persistent host bind mount is selected for the live
system. On one VPS, MinIO would add an API, credentials, memory, upgrades, and a
second data service while still sharing the same disk and failure domain. It
would not make the files more durable.

PostgreSQL stores Directus file metadata and every post relationship. File bytes
stay out of PostgreSQL. The production build fetches files with the Build Reader
token and embeds optimized public variants in the Astro image; draft uploads
remain behind Directus authorization. Preview streams required files
server-side with the Preview Reader token.

Use Directus' native folders as two permission scopes: `publishable-assets` and
`private-draft-assets`. Build Reader can access only the former, Preview Reader
can access both, and build validation rejects a public reference to the private
scope. This is simpler than duplicating every inline Markdown image into a
second relation solely for permissions.

Treat originals as immutable and create a new file ID for replacements. Routine
Author permissions do not replace file bytes or hard-delete media.
This avoids stale-cache identity problems and makes a database dump followed by
an upload snapshot recoverably consistent: the file snapshot may contain harmless
extras, but it cannot lose an original still referenced by the dump.

Directus file IDs keep a future migration to S3-compatible storage possible if
media exceeds the VPS, multiple Directus replicas are introduced, or a dedicated
asset CDN becomes justified.

## Publication and Rollback

1. Directus publishes or unpublishes the main row and sends an authenticated,
   non-blocking repository dispatch.
2. CI fetches and validates the complete published snapshot. Draft saves do not
   trigger production.
3. CI produces Pagefind and an immutable OCI image; the Directus build token is
   a masked CI variable and is absent from image layers and runtime env.
4. A forced-command SSH entrypoint accepts only the allow-listed GHCR repository
   plus a `sha256` digest; it rejects tags, extra arguments, and shell syntax.
5. The VPS script takes a deployment lock, pulls the image, starts a uniquely
   named traffic-free candidate with the production runtime contract, and checks
   its health plus representative routes.
6. If healthy, the script removes the candidate, records the current digest, and
   replaces the single Compose `site` service, then gracefully reloads Caddy so
   its fixed Docker-DNS upstream is freshly resolved. A few seconds of restart
   time is accepted for this personal publication.
7. External smoke success records current/previous digests and prunes only safe
   old site images. Failure redeploys the recorded prior digest. Commit-SHA tags
   remain human-readable trace labels but are never deployment identity.

This preserves fail-before-traffic validation and deterministic rollback
without permanent blue/green services or mutable Caddy routing. The running
public site remains independent of Directus/PostgreSQL, and a bad content build
cannot survive the deployment checks.

The automated path replaces only the site digest. Compose, Caddy, the host
deploy script, Directus/PostgreSQL versions, and schema snapshots use a separate
owner-run maintenance release from a reviewed pinned Git commit. That runbook
requires a verified backup, configuration and schema diff, expand/deploy/contract
ordering, smoke checks, and explicit rollback. The content webhook can therefore
never rewrite the host machinery that authorizes it.

## Preview Authentication

Without Cloudflare Access, Caddy basic authentication is the smallest robust
author-only gate. Caddy stores only a password hash from environment-managed
configuration. It strips `X-Preview-Authorized` from incoming requests and sets
it for the private Astro upstream only after successful authentication. The site
container has no published port, so clients cannot inject the header by
bypassing Caddy.

Astro still checks the header, accepts only a validated item/version identifier,
uses its server-side Preview Reader token, and returns private/no-store/noindex
responses. Directus and preview CSP values explicitly allow their mutual iframe
relationship. A reusable Directus token never appears in the URL or browser.

## Backup and VPS Loss

Nightly backup creates a verified `pg_dump --format=custom`, then snapshots that
dump and the Directus uploads path into an encrypted Restic repository outside
the VPS. Retention is 14 daily, 8 weekly, and 12 monthly restore points. Prune
and `restic check` run on separate schedules so a slow maintenance task cannot
block the nightly recovery point.

The resulting targets are an RPO of at most 24 hours and a clean-host RTO of
four hours under normal network and DNS conditions. Quarterly drills measure
both rather than treating a successful backup command as recovery evidence.

A quarterly clean-room drill must prove this sequence:

1. provision a clean Docker host from the repository;
2. restore PostgreSQL and uploads from Restic;
3. start the pinned Directus version and compare the restored database with the
   schema snapshot; do not blindly apply a snapshot to a full database restore;
4. start Directus and verify revisions/settings/media;
5. build the Astro site and compare representative stable URLs.

The database bind mount itself is not copied live as a backup. Caddy
certificates and container layers are regenerable. Secrets need a separate,
documented password-manager recovery process and are never put into Restic
through the application backup job.

## VPS Sizing and Operations

A sensible starting profile for a single-author site is 2 vCPU, 4 GB RAM, and
at least 50 GB NVMe plus swap; media volume, build-image retention, and database
growth determine the real disk requirement. CI performs image builds so the VPS
does not need build-time memory headroom. Start larger only when measured usage
or the existing VPS requires it.

The always-running stack deliberately excludes Redis, MinIO, a queue, and a
metrics suite. Docker health checks, Caddy/Docker log rotation, publication and
backup notifications, disk/inode alerts, and one external HTTPS monitor cover
the initial operational risks. Add dedicated monitoring only when a concrete
availability target demands it.

## Official References

- Docker Compose: <https://docs.docker.com/compose/>
- Docker Compose networking: <https://docs.docker.com/compose/how-tos/networking/>
- Docker image health checks: <https://docs.docker.com/reference/dockerfile/#healthcheck>
- Caddy automatic HTTPS: <https://caddyserver.com/docs/automatic-https>
- Caddy reverse proxy: <https://caddyserver.com/docs/caddyfile/directives/reverse_proxy>
- Caddy basic authentication: <https://caddyserver.com/docs/caddyfile/directives/basic_auth>
- Caddy graceful reload: <https://caddyserver.com/docs/command-line#caddy-reload>
- Astro Node adapter: <https://docs.astro.build/en/guides/integrations-guide/node/>
- Astro on-demand rendering: <https://docs.astro.build/en/guides/on-demand-rendering/>
- Directus local file storage: <https://directus.com/docs/raw/configuration/files.md>
- GitHub container registry: <https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry>
- Restic preparing a new repository: <https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html>
- PostgreSQL `pg_dump`: <https://www.postgresql.org/docs/17/app-pgdump.html>
