# Site deployment

## Host contract

Use a dedicated checkout such as `/opt/personal-journal/releases/<git-sha>` and
an owner-controlled `/opt/personal-journal/current` symlink. Routine CI does
not change that symlink or any checked-in host file. Install the sanitized
examples as real host configuration:

```sh
install -d -m 0755 /etc/personal-journal
install -d -m 0700 /var/lib/personal-journal/deploy
install -d -m 0755 /srv/personal-journal/data
install -m 0600 ops/env/production.env.example /etc/personal-journal/production.env
install -m 0644 ops/env/deploy.env.example /etc/personal-journal/deploy.env
```

Replace every placeholder. `deploy.env` is deliberately non-secret and must be
root-owned and not group/world writable; `deploy-site.sh` rejects a weaker
file. `production.env` contains credentials and must be readable only by the
host account that runs Compose. That account requires Docker access, which is
host-equivalent privilege even though the remote SSH key is constrained.

Create the data subdirectories named in `deploy/compose.yaml`, set ownership
for the pinned container users, render Compose, build the operations image, and
start the stack from the reviewed checkout:

```sh
docker compose --env-file /etc/personal-journal/production.env \
  --file deploy/compose.yaml config --quiet
docker compose --env-file /etc/personal-journal/production.env \
  --file deploy/compose.yaml build backup restore restic-maintenance
docker compose --env-file /etc/personal-journal/production.env \
  --file deploy/compose.yaml up -d
```

Only Caddy may publish host ports. Verify this against the running containers,
not only rendered YAML:

```sh
docker compose --env-file /etc/personal-journal/production.env \
  --file deploy/compose.yaml ps
docker port personal-journal-postgres-1
docker port personal-journal-site-1
```

Both `docker port` commands must be empty.

## Forced SSH key

Create a dedicated Ed25519 key for GitHub Actions, pin the VPS host key in the
`VPS_KNOWN_HOSTS` secret, and install its public half using
`ops/ssh/authorized_keys.example`. The `restrict` option disables forwarding,
PTY, agent, and X11 access; the forced command ignores a requested shell and
passes the exact `SSH_ORIGINAL_COMMAND` as one argument to `deploy-site.sh`.

The deployment script accepts only the configured lowercase
`ghcr.io/<owner>/<repository>@sha256:<64 lowercase hex>` reference. It rejects
tags, other repositories, multiple arguments, whitespace, line breaks, and
shell syntax. Do not give this key a second unrestricted `authorized_keys`
entry.

If the GHCR package is private, authenticate the forced-command host account
once with a dedicated read-only package credential before enabling CI. Keep its
`~/.docker/config.json` owner-only and outside application backups, verify an
allow-listed digest can be pulled, and record credential rotation in the
password-manager inventory. The CI package-write token is not a VPS pull
credential.

GitHub production configuration:

| Name                   | Kind                 | Purpose                                       |
| ---------------------- | -------------------- | --------------------------------------------- |
| `DIRECTUS_URL`         | environment variable | Directus endpoint for the build-time snapshot |
| `DIRECTUS_BUILD_TOKEN` | secret               | Published snapshot and publishable media only |
| `VPS_DEPLOY_KEY`       | secret               | Private half of the forced-command key        |
| `VPS_DEPLOY_TARGET`    | secret               | `deploy-user@host`                            |
| `VPS_KNOWN_HOSTS`      | secret               | Pre-collected, reviewed host key line         |

The workflow runs its quality gate on every push to `main` and every pull
request, but publishing is gated to manual dispatch from `main` and
`repository_dispatch` type `directus-publish`; a plain push never deploys.
Every publish event rebuilds the complete published snapshot; an event payload
is never treated as content. Push/PR runs share a cancellable concurrency
group, while publish events use a separate non-cancelling production group so
a push cannot interrupt an in-flight deployment. The token is mounted as
a BuildKit secret during that build; the resulting Next runtime image receives
neither the Directus URL/token nor a content-source setting.

The Directus Flow declares `items.create`, `items.update`, and
`items.delete` for `posts`, `topics`, `posts_topics`, `categories`, `tags`,
`series`, `posts_tags`, `site_settings`, `social_links`, and
`directus_files`. Draft-version saves are outside this matrix. File events proceed only when their event payload identifies the
`publishable-assets` folder. Before enabling the Flow, exercise promotion,
metadata update, and deletion against the pinned Directus version and confirm
the payload filter dispatches every public-file transition; the static
repository contract cannot prove runtime event payloads.

A rejected GitHub request creates a Directus notification for the Author
without including the token or content body. The Flow cannot be activated
without an Author recipient. Inspect the Flow log for the bounded request
failure, then use the main-branch manual workflow dispatch to reconcile the
complete snapshot.

## Public image delivery

The Directus build materializes only public images referenced by the published
article/tutorial snapshot and profile. The actual Build Reader token reads
`/files/<id>` metadata and canonical `/assets/<id>` originals; the exporter
requires the exact publishable folder, raster MIME/signature and bounded byte
size before writing `frontend-v2/public/_cms/<sha256>.<ext>`. Docker copies those
files with the public directory, so the read-only standalone runtime serves
them anonymously without CMS network access or credentials. Public CMS
originals need no anonymous permission and may continue returning 403.

Do not loosen Public or production Build Reader policies to repair browser
images. Missing/forbidden/private files and invalid originals fail the build.
Authors must deliberately move intended body uploads from the editor's private
folder into `publishable-assets`. Only JPEG, PNG, WebP, GIF and AVIF originals
are exported (20 MiB each, 100 MiB unique references, 15 seconds/request); SVG
CMS uploads, transformations, HTML and reference-style CMS images are refused.
Authored local SVG assets remain supported.

Rebuild and deploy to revoke an already-published image, just as for static
article text. Verify public-file removal/promotion triggers against the pinned
Flow event payload; use manual dispatch to reconcile when needed. The build
wrapper resets only the generated namespace once before Next workers and after
failure, including fixture builds. Use isolated checkouts for concurrent builds;
never invoke `next build` directly to bypass that lifecycle.

Before deployment, inspect the exact token consumed by the successful image,
then start that image with `--network none --read-only` and verify anonymous
site cover/body bytes and MIME, private/unreferenced absence, and no CMS runtime
environment. This delivery test is separate from the licensed production
status/field/folder permission acceptance.

## Candidate, replacement, and rollback

`scripts/deploy-site.sh` performs these steps under `flock`:

1. Resolve the actual running Compose site's `.Config.Image` and require an
   allow-listed digest.
2. Pull the requested digest and start a uniquely named `docker compose run`
   candidate. Compose run publishes no port and does not receive the `site`
   network alias, so Caddy cannot route to it.
3. Wait for Docker health and execute `/healthz` plus `/` inside that candidate.
4. Remove the candidate, atomically record the running digest as `previous`,
   and create `pending-deploy.env` before replacing traffic.
5. Recreate only `site`, wait for health, reload Caddy to refresh Docker DNS,
   and check `/healthz` plus `/` through public HTTPS.
6. On success, atomically record `current`, `previous`, `site-image.env`, and
   deployment time. On any failure after replacement starts, recreate `site`
   from the recorded prior digest, reload Caddy, and smoke it again. The failed
   deployment still exits nonzero so CI notifies the owner.

State lives under `DEPLOY_STATE_DIR` with mode `0700`; state files use `0600`.
If automatic rollback itself fails, the script exits 70 and deliberately keeps
`pending-deploy.env` for diagnosis. A later invocation validates that file
against the actual running digest: it finishes a healthy interrupted switch,
restores the recorded prior digest when the switched image fails smoke, or
fails closed when the running digest matches neither value. Do not edit or
remove pending state before inspecting the running container and failure logs.

An idempotent request for the running digest performs the external smoke check
and does not recreate the service. A candidate failure never reaches traffic.

Manual prior-image rollback uses the same preflight and replacement path:

```sh
scripts/deploy-site.sh "$(cat /var/lib/personal-journal/deploy/previous-image)"
```

Image cleanup enumerates only the configured site repository, skips `current`
and `previous`, and refuses to remove an image referenced by any container. It
never invokes a generic Docker prune.

## Local contract checks

These commands do not contact a production account or deploy externally:

```sh
sh tests/ops/run.sh
sh scripts/validate-operations.sh
pnpm build
docker build --target runtime --tag blog-site:fixture .
scripts/test-runtime-image.sh blog-site:fixture
```

Set `OPS_BUILD_IMAGES=1` for `validate-operations.sh` to build the PostgreSQL /
Restic operations image too.
