# Backup and clean-room recovery

## Nightly encrypted database backup

The backup profile creates a custom-format pg_dump, verifies pg_restore --list and records size/SHA256/time. Format 2 Restic snapshots contain the dump and CMS media, including originals/. It removes the 0600 temporary dump on all exits. Live PostgreSQL files are not a logical backup. No retired uploads directory is required.

Install and review ops/systemd units for nightly backup, six-hour freshness checks (maximum age 86400 seconds), weekly retention (14 daily, 8 weekly, 12 monthly) and weekly integrity checks. Enable blog-backup.timer, blog-backup-freshness.timer, blog-restic-forget.timer and blog-restic-check.timer. Perform a quarterly full restic check --read-data and record measured recovery times. Restic credentials are outside the backup set.

```sh
docker compose --env-file /etc/personal-journal/production.env -f deploy/compose.yaml --profile backup run --build --rm backup
docker compose --env-file /etc/personal-journal/production.env -f deploy/compose.yaml --profile restore run --rm restore verify <snapshot-id>
```

Verify downloads to temporary staging and checks the dump/media payload without changing the database. Select a concrete snapshot ID for recovery evidence.

## Full clean-room restore

Apply requires an empty database, an existing writable empty CMS media target, a valid dump/manifest and no symlinks. Set RESTORE_CONFIRM=restore-empty:<database> and start only PostgreSQL in an isolated replacement stack:

```sh
RESTORE_CONFIRM=restore-empty:blog docker compose --env-file /etc/personal-journal/production.env -f deploy/compose.yaml --profile restore run --rm restore apply <snapshot-id>
```

The script refuses overwrite/cleanup of populated targets. If interrupted, retry into fresh empty targets. It uses pg_restore --no-owner --no-privileges, so the administrator restores table ownership. Before CMS startup recreate the restricted blog_cms role, then reassign **only author_cms** objects in that target database:

```sql
SELECT format('ALTER TABLE %I.%I OWNER TO blog_cms', schemaname, tablename)
FROM pg_tables WHERE schemaname='author_cms'
\gexec
ALTER SCHEMA author_cms OWNER TO blog_cms;
```

Do not use broad REASSIGN OWNED across legacy tables. Ensure the media tree is writable/readable by the node UID/GID 1000. With the recorded compatible CMS image, verify migration checksums, login/reset, latest drafts and history, taxonomy, actual images and published addresses. Start site and Caddy, then check public pages and draft/private denials. Only the custom CMS checksum-validated migrations apply to a restored database.

Record snapshot time, start/end, RPO/RTO, role/ownership changes, media checksums and URL samples. Targets remain at most 24 hours of lost changes and four hours recovery under ordinary network/DNS conditions. TLS certificates/code images can be regenerated; recovery secrets come from the password manager.

## Portable content and media bundle

The CMS CLI exports versioned JSON data, Markdown working copies, actual media/originals and SHA256 manifests. It excludes owner/sessions; the browser JSON export does not include image bytes. Use a new private destination directory:

```sh
node author-cms/scripts/transfer.mjs export /protected/new-bundle
node author-cms/scripts/transfer.mjs verify /protected/new-bundle
# On a separate empty content schema and media root after migrate:
node author-cms/scripts/transfer.mjs restore /protected/new-bundle
```

In development use pnpm --filter author-cms exec node --env-file=.env.local --import=tsx scripts/transfer.mts with the same arguments. In a container use a reviewed bind mount for /protected. DATABASE_URL and CMS_MEDIA_ROOT always name the selected target; do not point recovery at a populated authoring database. Restore validates checksums, refuses existing content and will only reuse identical immutable files. Original source archives are included. Initialize/reset the target owner separately, then re-export and compare data/media manifests with the original bundle.

## Older pre-CMS snapshots

The current restore script accepts manifest formats 1 and 2 only, and refuses either format when data/cms-media is missing. Format 1 transition snapshots containing complete CMS media can restore that media and database without a retired uploads target. Unknown formats are refused before applying data. Recover such snapshots with the pinned, reviewed pre-CMS release's restore tooling into a separate empty database/uploads target, then run the source migration procedure. Keep that release digest/commit in the recovery inventory. Do not suppress the media guard or label a legacy-only snapshot a complete backup of new CMS writes.
