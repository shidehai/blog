# Backend and Infrastructure Directory Structure

## Ownership

```text
deploy/
  compose.yaml       # Production topology and private networks
  compose.dev.yaml   # Localhost-only development exposure
  Caddyfile          # TLS, routing, headers, protected preview boundary
  backup.Dockerfile  # PostgreSQL client plus Restic
directus/            # Versioned schema and fake fixtures, never uploads
scripts/             # Small operational entrypoints
Dockerfile           # Astro development/build/runtime stages
```

Directus remains a pinned upstream container; do not copy it into the
repository or build a custom admin/backend. `src/` owns the Astro application,
not database migrations or a second content store.

## Service Boundary

`deploy/compose.yaml` defines four normal services:

- Caddy alone publishes ports 80/443 and joins `web`.
- Site joins `web` and has no published production port.
- Directus joins `web` and the internal `data` network.
- PostgreSQL joins only `data` and has no production host port.

The development override binds site, Directus, and PostgreSQL only to
`127.0.0.1`. Put infrequent operational jobs such as backup behind a Compose
profile instead of creating an always-on service.

## Filesystem Boundary

Production data uses explicit host bind paths configured by `BLOG_DATA_ROOT`.
Never persist PostgreSQL or uploads in the container writable layer, an
anonymous volume, Git, or `directus/`. The runtime site image is immutable and
uses a read-only root with `/tmp` as tmpfs.
