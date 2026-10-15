# Site and CMS deployment

Production runs Caddy, site, cms and PostgreSQL. Content publishing updates the CMS transaction directly. CI builds code images without CMS/database credentials; manual workflow dispatch pushes both immutable images. The forced SSH key still replaces only site. CMS, schema, Compose, Caddy and host changes require an owner-run maintenance release from a reviewed commit.

For the first owner-run deployment on Debian 12, follow the [Chinese VPS guide](vps-first-deploy.md), including the portable transfer of current local content and media. It builds both images on the server and pins their local image IDs; the forced SSH publisher still requires registry digest references.

## Host configuration

Use a dedicated checkout and protected configuration:

```sh
install -d -m 0755 /etc/personal-journal
install -d -m 0700 /var/lib/personal-journal/deploy
install -d -m 0755 /srv/personal-journal/data
install -m 0600 ops/env/production.env.example /etc/personal-journal/production.env
install -m 0644 ops/env/deploy.env.example /etc/personal-journal/deploy.env
```

Replace all placeholders. Set SITE_IMAGE and CMS_IMAGE to reviewed registry digests. Set CMS_DATABASE_URL to a dedicated role owning author_cms, not the PostgreSQL administrator or an identity from a retired service. Set one random CMS_READ_TOKEN shared only by cms and the site server. Compose supplies the public HTTPS origins, SITE_URL from SITE_DOMAIN, and internal CMS URL. Outside Compose, set SITE_URL explicitly to the public root HTTP(S) origin. URI-encode database passwords. Environment files never enter Git, image builds or logs.

Create postgres, cms/media, backup-staging and caddy data/config/logs under BLOG_DATA_ROOT. The CMS media directory must be writable by UID/GID 1000. Protected source recovery archives remain separate from live service storage. The backup staging directory must be writable by the operations image user. Render Compose before starting any service:

```sh
docker compose --env-file /etc/personal-journal/production.env -f deploy/compose.yaml config --quiet
docker compose --env-file /etc/personal-journal/production.env -f deploy/compose.yaml up -d postgres
```

Before first CMS startup, create blog_cms and its schema in the configured database using the administrator and interactive psql password command described in [CMS setup](../../author-cms/README.md). Review actual role membership and inherited grants; it must not read legacy tables. CMS startup runs checksum-validated migrations as that role before serving requests. Do not grant superuser to repair a failed schema setup.

Set the owner password through stdin (never a command-line argument), then start the reviewed CMS/site/Caddy services. The CMS command below reads a password supplied through the caller's stdin:

```sh
docker compose --env-file /etc/personal-journal/production.env -f deploy/compose.yaml up -d cms
docker compose --env-file /etc/personal-journal/production.env -f deploy/compose.yaml exec -T cms node author-cms/scripts/manage.mjs owner --password-stdin
docker compose --env-file /etc/personal-journal/production.env -f deploy/compose.yaml up -d site caddy
```

When migrating, follow [CMS cutover](cms-migration.md) instead of starting an empty CMS as the formal source. Verify actual running port mappings: only Caddy publishes host ports. Site and CMS run as node with read-only roots, a writable media bind mount only for CMS, and /tmp tmpfs.

## CI and the forced SSH key

Production GitHub secrets are VPS_DEPLOY_KEY, VPS_DEPLOY_TARGET and VPS_KNOWN_HOSTS. CMS_READ_TOKEN and DATABASE_URL stay in protected host runtime configuration; GitHub builds need neither. Ordinary pushes and PRs run quality checks; only manual workflow_dispatch performs code publishing.

Install the dedicated public key using ops/ssh/authorized_keys.example. It restricts forwarding, PTY and shell access and passes only SSH_ORIGINAL_COMMAND to deploy-site.sh. The script accepts one allow-listed ghcr.io/<owner>/<repository>@sha256:<64 lowercase hex> reference. Do not add an unrestricted duplicate key entry. For private packages, give the host account a separate read-only GHCR pull credential, stored outside application backups; GitHub's temporary package-write token is not a VPS pull credential.

Under flock, deploy-site.sh resolves the actual running site digest, starts a portless candidate, verifies process and content availability, and removes it before traffic replacement. It records previous/pending state atomically, recreates only site, reloads Caddy DNS, and checks public HTTPS. A failure after replacement restores the previous compatible site digest and exits nonzero. If rollback also fails, exit 70 retains pending-deploy.env for investigation. An idempotent digest request only smokes the live site. Cleanup is restricted to unused images in the configured repository and preserves current/previous digests.

The state directory uses 0700, files 0600; deploy.env must be root-owned and not group/world writable. Preserve pending state until the running digest and failure logs have been inspected. Routine CI cannot upgrade CMS or database schema. Record the CMS digest printed by the workflow and deploy it in a separate reviewed maintenance window.

## CMS upgrades and rollback

Take a verified backup and record both running image digests and migration checksums. Ship additive SQL migrations first with compatible CMS code; do not edit an applied migration. Start the candidate against a disposable restored database/media clone before upgrading the real CMS. Startup refuses checksum drift or failed migrations. Verify login, draft save, image upload, publication, public reads and private media after the upgrade.

A code rollback must be compatible with the installed schema and preserve current content. A database rollback needs a clean restored target and reconciliation of all newer writes. Switching back to the old Directus database after new CMS writes is not an ordinary image rollback.

## Local image checks

```sh
sh scripts/validate-operations.sh
docker build --target runtime --tag blog-site:local .
docker build --target cms-runtime --tag blog-cms:local .
sh scripts/test-runtime-image.sh blog-site:local
sh scripts/test-cms-image.sh blog-cms:local
CMS_READ_TOKEN=isolated-inspection-token-32-characters sh scripts/assert-image-secret-free.sh blog-site:local
CMS_READ_TOKEN=isolated-inspection-token-32-characters sh scripts/assert-image-secret-free.sh blog-cms:local
```

The CMS smoke creates its own isolated database/container/network, uses a non-superuser schema owner, proves legacy table reads denied, and tests CLI, login, Sharp upload and publication under read-only/non-root constraints. It does not contact production or modify existing containers.

Before an Internet launch, require the production audit and actual OCI high/critical
scan, then verify the deployed HTTPS canonical/OG/Twitter URLs, share.png,
robots.txt and dynamic sitemap.xml. Publish/rename/archive should change public
URLs and sitemap immediately; private media and archived aliases remain denied.
Local validation does not replace real-domain HTTPS, offsite restore, storage
monitoring and alert delivery acceptance.
