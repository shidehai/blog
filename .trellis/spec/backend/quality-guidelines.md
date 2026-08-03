# Backend and Infrastructure Quality Guidelines

## Scenario: Foundation Runtime Boundary

### 1. Scope / Trigger

Apply this contract when changing `Dockerfile`, `deploy/`, operational scripts,
or environment wiring. These files span build, runtime, proxy, CMS, database,
storage, and backup boundaries.

### 2. Signatures

- Build: `docker build --target runtime -t blog-site:test .`
- Runtime: `node scripts/env.mjs runtime && node dist/server/entry.mjs`
- Compose: `docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml ...`
- Backup: `docker compose --env-file .env -f deploy/compose.yaml --profile backup run --rm backup`
- Health: `GET /healthz` and Directus public liveness `GET /server/ping`

### 3. Contracts

- Build defaults to `CONTENT_SOURCE=fixture`; Directus builds receive the build
  token only through a BuildKit secret, never `ARG` or `ENV`.
- Runtime requires `SITE_URL`, `DIRECTUS_URL`, `DIRECTUS_PREVIEW_TOKEN`, and
  `PREVIEW_TRUSTED_HEADER`.
- Compose interpolation uses the root `.env` explicitly because the first
  Compose file lives under `deploy/`.
- Production exposes only Caddy 80/443. PostgreSQL remains on the internal
  `data` network.
- Development binds PostgreSQL to `127.0.0.1` and also joins the existing
  non-internal `web` network. Docker 29 does not activate a published port for
  a container connected only to an `internal: true` network, even though
  `docker compose config` still lists that port.

### 4. Validation & Error Matrix

| Input/state | Result |
| --- | --- |
| Missing required Compose value | `docker compose config` fails |
| `CONTENT_SOURCE=directus` without secret | image build fails before content fetch |
| Incomplete runtime environment | container exits before listening |
| Unhealthy site | Caddy waits and Docker reports unhealthy |
| Unhealthy PostgreSQL | Directus and backup do not start |
| Development PostgreSQL joins only `data` | `docker port` is empty; attach `web` in the development override |
| Incoming `X-Preview-Trusted` | Caddy strips it; authenticated preview injects the trusted value |

### 5. Good/Base/Bad Cases

- Good: pinned images, read-only non-root site, localhost-only dev ports, and
  healthy routes.
- Base: fixture image builds without production credentials.
- Bad: mutable production site tag, public database port, secret build arg,
  anonymous data volume, or broad Docker prune.

### 6. Tests Required

- `pnpm verify` proves application checks and browser behavior.
- Compose config must parse both production and development files.
- Build and run the runtime image; assert `/healthz`, non-root `node`, read-only
  root, and dropped capabilities.
- Validate `deploy/Caddyfile` with the pinned Caddy image.
- Start PostgreSQL/Directus and assert both health checks plus localhost-only
  published development ports with `docker port`; Compose rendering alone is
  insufficient.

### 7. Wrong vs Correct

#### Wrong

```yaml
services:
  postgres:
    ports: ["127.0.0.1:5432:5432"]
    networks: [data]
```

#### Correct

Production has no `ports` entry and uses only `data`. The development override
adds the localhost binding and a non-internal network:

```yaml
services:
  postgres:
    ports: ["127.0.0.1:5432:5432"]
    networks: [web, data]
```
