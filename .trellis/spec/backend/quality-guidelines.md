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
- Public header probe: `pnpm test:headers -- --url <https-origin>`
- Inline-script CSP sync: `node scripts/verify-csp-hash.mjs [dist/client] [deploy/Caddyfile]`

### 3. Contracts

- Build defaults to `CONTENT_SOURCE=fixture`; Directus builds receive the build
  token only through a BuildKit secret, never `ARG` or `ENV`.
- Runtime requires explicit `CONTENT_SOURCE`, `SITE_URL`, `DIRECTUS_URL`,
  `DIRECTUS_PREVIEW_TOKEN`, and `PREVIEW_TRUSTED_HEADER`. Production Compose
  fixes `CONTENT_SOURCE=directus`; fixture tests must opt into `fixture`.
- `CONTENT_SOURCE` is one cross-layer contract: the image build controls the
  published snapshot, while the runtime value controls preview reads. Every
  production, development, Playwright, and container entrypoint must set its
  intended value explicitly; no runtime consumer may add a fixture fallback.
- Compose interpolation uses the root `.env` explicitly because the first
  Compose file lives under `deploy/`.
- Production exposes only Caddy 80/443. PostgreSQL remains on the internal
  `data` network.
- Development binds PostgreSQL to `127.0.0.1` and also joins the existing
  non-internal `web` network. Docker 29 does not activate a published port for
  a container connected only to an `internal: true` network, even though
  `docker compose config` still lists that port.
- An unauthenticated `/preview/*` request through Caddy returns `401`. The
  Astro route's generic `404` proves only its trusted-header check, not Basic
  Auth, so a public header probe must not accept the two statuses
  interchangeably.
- Every executable inline script emitted into `dist/client/**/*.html` has a
  SHA-256 source expression in both the public and preview Caddy policies.
  External scripts, empty scripts, and `application/ld+json` are excluded.
  The generated hash set and configured hash set must match exactly: each
  current hash occurs twice and no stale hash remains.

### 4. Validation & Error Matrix

| Input/state | Result |
| --- | --- |
| Missing required Compose value | `docker compose config` fails |
| `CONTENT_SOURCE=directus` without secret | image build fails before content fetch |
| Runtime `CONTENT_SOURCE` missing or invalid | site exits before listening |
| Production Compose resolves runtime source to `fixture` | Compose contract validation fails |
| Incomplete runtime environment | container exits before listening |
| Unhealthy site | Caddy waits and Docker reports unhealthy |
| Unhealthy PostgreSQL | Directus and backup do not start |
| Development PostgreSQL joins only `data` | `docker port` is empty; attach `web` in the development override |
| Incoming `X-Preview-Trusted` | Caddy strips it; authenticated preview injects the trusted value |
| Unauthenticated preview through Caddy | exact `401` with private/no-store and noindex headers |
| Direct site request without trusted preview header | generic `404`; never count this as proxy-auth evidence |
| Generated inline-script hash missing from Caddy | `verify-csp-hash.mjs` fails and reports the hash plus occurrence count |
| Caddy contains a stale inline-script hash | `verify-csp-hash.mjs` fails before deployment |

### 5. Good/Base/Bad Cases

- Good: pinned images, `CONTENT_SOURCE=directus` in production Compose,
  read-only non-root site, localhost-only dev ports, a real Caddy `401` for
  unauthenticated preview, and healthy routes.
- Base: fixture image builds without production credentials, and every local
  runtime test explicitly sets `CONTENT_SOURCE=fixture`.
- Bad: implicit runtime fixture fallback, accepting an application `404` as
  proof of proxy authentication, mutable production site tag, public database
  port, secret build arg, anonymous data volume, broad Docker prune, or editing
  an inline Astro script without rebuilding and synchronizing both CSPs.

### 6. Tests Required

- `pnpm verify` proves application checks and browser behavior.
- `tests/unit/env.test.ts` rejects a missing runtime `CONTENT_SOURCE` and accepts
  only explicit `fixture` or `directus` values.
- Rendered Compose validation and the static operations contract both assert
  that the production site receives `CONTENT_SOURCE=directus`.
- Compose config must parse both production and development files.
- Build and run the runtime image; assert `/healthz`, non-root `node`, read-only
  root, and dropped capabilities.
- Validate `deploy/Caddyfile` with the pinned Caddy image.
- Run `pnpm test:headers` through the real Caddyfile and assert that an
  unauthenticated preview is exactly `401`, not an allow-list containing
  Astro's fail-closed `404`.
- After changing any inline Astro component/layout script, run a fresh
  `pnpm build` followed by `pnpm test:operations`; assert CSP verification finds
  the same generated hash set in public and preview policies with no stale
  entries.
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

  # Runtime source omitted.
  site:
    environment: {}
```

```javascript
// This can pass even when the request bypasses Caddy Basic Auth.
assert([401, 404].includes(preview.status));
```

#### Correct

Production has no `ports` entry and uses only `data`. The development override
adds the localhost binding and a non-internal network:

```yaml
services:
  postgres:
    ports: ["127.0.0.1:5432:5432"]
    networks: [web, data]

  site:
    environment:
      CONTENT_SOURCE: directus
```

```javascript
assert(preview.status === 401);
```

Do not keep a superseded hash after a bundled component script changes:

```caddyfile
# Wrong: a generated hash is missing or an obsolete hash remains.
script-src 'self' 'sha256-old=';

# Correct: every generated executable inline-script hash appears in both
# public and preview policies, and no other inline-script hash is configured.
script-src 'self' 'sha256-current-a=' 'sha256-current-b=';
```
