# Personal Knowledge Journal

Astro 7 frontend with a private Directus 12 / PostgreSQL 17 publishing stack.
The repository is intentionally a single package; PostgreSQL is the only live
content source.

## Local bootstrap

Requirements: Node 24.15.0, pnpm 9.15.9, Docker, and Docker Compose.
Directus and the backup job use UID/GID `1000`; on a host whose owner uses a
different ID, make `.data/directus/uploads` and `.data/backup-staging` writable
by `1000:1000` before starting the services.

```bash
install -m 600 .env.example .env
mkdir -p \
  .data/postgres \
  .data/directus/uploads \
  .data/caddy/data \
  .data/caddy/config \
  .data/caddy/logs \
  .data/backup-staging
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml config --quiet
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml up -d postgres directus
pnpm dev
```

Replace every placeholder secret in `.env` before using anything beyond local
development. Production must set `SITE_IMAGE` to a real GHCR digest; a tag is
not a deployment identity.

## Health and validation

```bash
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml ps
curl --fail http://127.0.0.1:8055/server/ping
curl --fail http://127.0.0.1:4321/healthz
pnpm verify
```

## Schema and fixtures

Phase 2 creates `directus/schema.yaml` and `directus/seed/`. Once present, apply
and seed them explicitly; neither command resets existing data:

```bash
test -f directus/schema.yaml
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml exec -T directus \
  npx directus schema apply --yes /directus/project/schema.yaml
test -f directus/seed/index.mjs
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml exec -T directus \
  node /directus/project/seed/index.mjs
```

## Backup and teardown

The backup profile creates a verified PostgreSQL custom dump and sends that dump
plus uploads to the configured encrypted Restic repository:

```bash
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml --profile backup run --build --rm backup
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml down
```

`down` leaves bind-mounted data intact. Deleting `.data/`, using `down -v`, or
running broad Docker prune commands is intentionally not part of the runbook.
