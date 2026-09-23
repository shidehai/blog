# Backend and Infrastructure Directory Structure

## Ownership

```text
Dockerfile                    # Next development, build, and standalone runtime stages
deploy/
  compose.yaml                # Production topology and private networks
  compose.dev.yaml            # Localhost-only development override
  Caddyfile                   # TLS, public/CMS routing, headers and cache policy
  backup.Dockerfile           # PostgreSQL client plus Restic jobs
directus/                     # Versioned schema, bootstrap, seed and fake fixtures
scripts/                      # Small operational, Compose and image entrypoints
tests/                        # Directus and operations contract checks
```

Directus remains a pinned upstream container; do not copy it into this
repository or build a custom CMS. `frontend-v2/` owns the public Next
application; database migrations and content records do not belong in it.

## Service Boundary

Production Compose defines Caddy, site, Directus, PostgreSQL, and opt-in
backup/restore/maintenance jobs:

- Caddy alone publishes ports 80/443 and joins `web`.
- Site joins `web`, has no production host port, and is a read-only standalone
  image listening on 4321.
- Directus joins `web` and internal `data`; PostgreSQL joins only `data`.
- Development may bind site, Directus, and PostgreSQL to `127.0.0.1`.
- There is no preview proxy, basic-auth preview service, or trusted preview
  header. Caddy caches `/_next/static/*`, forwards public requests to the site,
  and keeps CMS/API responses private/no-store.

## Build and Runtime Boundary

The Dockerfile's `build` stage selects either the offline fixture or Directus
snapshot. A Directus URL is a build argument; the Build Reader token is a
BuildKit secret mount. The `runtime` stage receives only standalone output,
static assets, and public assets, runs as `node`, and exposes `/healthz` on
4321. Never copy a local `.env` into a build context or runtime layer.

## Filesystem Boundary

Production data uses explicit host bind paths configured by `BLOG_DATA_ROOT`.
Never persist PostgreSQL or uploads in the application image, an anonymous
volume, Git, or `directus/`. The site runtime root is immutable and only `/tmp`
is a tmpfs.
