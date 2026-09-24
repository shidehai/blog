# Backend and Infrastructure Quality Guidelines

## Scenario: Static Snapshot Image and CMS Retirement Boundary

### 1. Scope / Trigger

Apply this contract when changing `Dockerfile`, `deploy/`, `scripts/`, CI,
Directus schema/bootstrap, Caddy, or an environment value shared by those
layers. It covers the complete path from a private Directus record to the
published static Next image and deliberately excludes a runtime CMS/preview
reader.

### 2. Signatures

```sh
# Offline fixture image
docker build --target runtime --tag blog-site:fixture .

# Published Directus image
docker build --target runtime \
  --secret id=directus_build_token,env=DIRECTUS_BUILD_TOKEN \
  --build-arg CONTENT_SOURCE=directus \
  --build-arg DIRECTUS_URL=https://cms.example.test \
  --tag blog-site:published .

scripts/test-runtime-image.sh blog-site:fixture
DIRECTUS_BUILD_TOKEN=<inspection-token> scripts/assert-image-secret-free.sh blog-site:fixture
```

The runtime contract is `GET /healthz` on port 4321 from the `node` user.
`deploy/compose.yaml` supplies the immutable site image but no V2 content-source
or Directus environment variables. `directus/bootstrap.mjs` is the only owner
of exact-ID legacy reader retirement.

### 3. Contracts

- `CONTENT_SOURCE=fixture` is the default image build and requires no CMS
  value. `CONTENT_SOURCE=directus` requires a URL build argument and a mounted
  Build Reader secret; Docker must fail before `next build` if either is absent.
- The token is never an `ARG`, `ENV`, label, copied file, later-stage input, or
  runtime variable. `.env` files stay outside the Docker context.
- The runtime stage contains only standalone output, `/_next` static assets,
  and public assets; it runs read-only as `node` on 4321 and has a Docker
  healthcheck for `/healthz`.
- Caddy caches only `/_next/static/*` immutably, marks `/healthz` no-store, and
  applies a Next-compatible source-scoped CSP. It permits same-origin scripts
  plus Next's inline hydration bootstrap, but does not retain fixed legacy
  hashes, preview routing, Basic Auth, or trusted preview headers.
- Posts expose no CMS `preview_url`. Bootstrap removes permissions and the
  former reader's access/user/role/policy only by the known fixed IDs, treating
  absent IDs as a successful no-op. It does not delete content, author users,
  private assets, notes, topics, or the Build Reader.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Fixture image build without token | Succeeds and contains the fixture snapshot |
| Directus image build without secret or URL | Fails before content fetch/build |
| Directus request/decode fails | Next build fails; fixture is not substituted |
| Runtime image has CMS/preview env or token bytes in metadata/layers | Secret inspection fails |
| Runtime starts read-only | `/healthz` and `/` become healthy on 4321 as `node` |
| Caddy contains `/_astro`, preview, hash, or trusted-header policy | Static operations test fails |
| Legacy exact-ID reader objects are absent | Bootstrap proceeds idempotently |
| A similarly named operator identity exists | Bootstrap leaves it untouched |
| Production Compose injects source/CMS variables into site | Rendered Compose validation fails |

### 5. Good / Base / Bad Cases

- Good: CI mounts a short-lived Build Reader token only into the build command,
  then deploys a digest-pinned image whose runtime has no Directus environment.
- Base: a local fixture image builds and passes health/non-root/secret checks
  without any external CMS.
- Bad: passing a token through `--build-arg`, setting it in Compose runtime,
  catching a Directus build failure with fixture data, deleting a role by name,
  or preserving a proxy endpoint for retired preview URLs.

### 6. Tests Required

- `pnpm verify` and `sh tests/ops/run.sh` cover V2 and static operations
  contracts.
- `sh scripts/validate-operations.sh` renders production/development Compose,
  validates the pinned Caddyfile, and checks build/runtime separation.
- Build a fixture runtime image, then run `scripts/test-runtime-image.sh` and
  `scripts/assert-image-secret-free.sh` with a non-production inspection token.
- Inspect generated routes through a standalone server: archive 200, known
  writing redirect 308, unknown writing/note 404, health 200.
- Run schema/bootstrap/access checks only against a disposable or backed-up
  Directus instance. The access test must prove Build Reader receives published
  article/tutorial fields but not topics/posts_topics, while author workflows
  and private draft assets remain protected.

### 7. Wrong vs Correct

#### Wrong

```yaml
services:
  site:
    environment:
      CONTENT_SOURCE: directus
      DIRECTUS_BUILD_TOKEN: ${DIRECTUS_BUILD_TOKEN}
```

#### Correct

```dockerfile
RUN --mount=type=secret,id=directus_build_token,required=false \
  set -eu; \
  DIRECTUS_BUILD_TOKEN="$(cat /run/secrets/directus_build_token)" \
  CONTENT_SOURCE=directus DIRECTUS_URL="$DIRECTUS_URL" \
  pnpm --filter frontend-v2 build
```

The correct form confines the credential to the one build process that needs it
and leaves no CMS capability in the deployed site.

## Convention: Regenerate Consumed Files via Temp + Rename

Any command that regenerates a file consumed by a later step (e.g.
`directus/database.sql` is the input of `directus:schema:apply`) must write to
a temporary sibling and rename on success (`> file.tmp && mv -f file.tmp
file`). A bare `> file` truncates the target before the producer runs, so a
mid-stream failure leaves a half-written file that the consuming command then
applies. This cost us a real finding (2026-09 audit, `directus:schema:dump`).

## Verification Order

Run fast static checks first, then image checks, then guarded live CMS checks:

```sh
pnpm --filter frontend-v2 verify
pnpm verify
sh tests/ops/run.sh
sh scripts/validate-operations.sh
docker build --target runtime --tag blog-site:fixture .
scripts/test-runtime-image.sh blog-site:fixture
DIRECTUS_BUILD_TOKEN=<inspection-token> scripts/assert-image-secret-free.sh blog-site:fixture
```

If Docker Hub or another external registry is unavailable, record that external
failure separately. Do not weaken the Dockerfile secret or runtime contract to
make a network outage appear green.
