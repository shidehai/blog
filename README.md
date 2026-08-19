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

## Directus license

Directus 12.2.0 can run on its Core tier without a key, but Core disables the
custom permission rules required to limit Build Reader and Preview Reader by
status, folder, and field. `pnpm directus:bootstrap` checks that entitlement
and stops before installing scoped permissions; `pnpm test:directus-access`
checks it again. There is no broad-read fallback.

The Open Innovation Grant (OIG) is available to eligible entities with less
than USD 5 million in annual revenue and fewer than 50 employees. Eligibility
is evaluated across the legal entities whose representatives use Directus
Studio. Apply at <https://directus.com/oig>; the owner must accept the grant
terms and keep renewal eligibility under review.

After receiving a key, set `DIRECTUS_LICENSE_KEY` in `.env` and keep
`DIRECTUS_PUBLIC_URL` at one stable absolute development URL. Compose maps the
key to Directus' `LICENSE_KEY`; production still derives `PUBLIC_URL` only from
the required HTTPS `CMS_DOMAIN`. Recreate Directus to apply an environment
change, then rerun the policy bootstrap and access check:

```bash
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml up -d --force-recreate directus
pnpm directus:bootstrap
pnpm test:directus-access
```

An OIG key currently provides five activations and is valid for one year.
Deactivate a license before discarding its database or changing a bound
`PUBLIC_URL`; deleting a container alone does not release an activation. Do not
put a real key in Git, logs, fixtures, or command output.

## Health and validation

```bash
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml ps
curl --fail http://127.0.0.1:8055/server/ping
curl --fail http://127.0.0.1:4321/healthz
pnpm verify
```

## Schema, fixtures, and launch

Apply the reviewed schema, database constraints, policy/bootstrap state, and
editorial data explicitly; these commands do not reset existing data:

```bash
test -f directus/schema.yaml
pnpm directus:schema:diff
pnpm directus:schema:apply
pnpm directus:bootstrap
# Install development fixtures (requires explicit target confirmation):
pnpm directus:seed --confirm=CONFIRM_FIXTURE_INSTALL_http://127.0.0.1:8055
pnpm directus:schema:check
```

### One-time editorial launch

To transition canonical content to truthful publication timestamps for the first release:

```bash
# 1. Generate read-only launch manifest:
pnpm launch:plan --base-time=2026-08-19T12:00:00.000Z

# 2. Apply launch plan with explicit confirmation token printed by plan:
pnpm launch:apply --manifest=.generated/launch-manifest.json --confirm=CONFIRM_LAUNCH_<digest>_FOR_http://127.0.0.1:8055
```

Subsequent authoring and article updates occur exclusively inside Directus Studio and are protected against fixture overwrites.

## Backup and teardown

The backup profile creates a verified PostgreSQL custom dump and sends that dump
plus uploads to the configured encrypted Restic repository:

```bash
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml --profile backup run --build --rm backup
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml down
```

`down` leaves bind-mounted data intact. Deleting `.data/`, using `down -v`, or
running broad Docker prune commands is intentionally not part of the runbook.
