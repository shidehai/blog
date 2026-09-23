# Backup and clean-room restore

## Policy and schedule

The nightly `backup` profile creates a PostgreSQL custom-format logical dump,
verifies it with `pg_restore --list`, writes a checksum/size/timestamp manifest,
and snapshots that temporary set plus immutable Directus uploads to an
encrypted Restic repository outside the VPS. The mode-`0600` temporary set is
removed on every exit path. Live PostgreSQL data files are never copied as a
database backup.

Install the units under `ops/systemd/`, review their absolute paths, then run:

```sh
systemctl daemon-reload
systemctl enable --now \
  blog-backup.timer \
  blog-backup-freshness.timer \
  blog-restic-forget.timer \
  blog-restic-check.timer
systemctl list-timers 'blog-*'
```

The jobs are intentionally separate:

- nightly snapshot;
- six-hour freshness check with a maximum age of 86,400 seconds;
- weekly retention/prune keeping 14 daily, 8 weekly, and 12 monthly points;
- weekly repository integrity check, with optional data subset configured by
  `RESTIC_CHECK_SUBSET`.

Run a full `restic check --read-data` during a quarterly drill. Never put
Restic credentials in Git, a database export, or the backup set itself. Test
the alert unit after configuring the owner-provided HTTPS alert endpoint.

## Safe manual verification

The verify mode downloads one snapshot into temporary staging, validates the
manifest checksum, and lists the custom dump. It does not connect to or alter
PostgreSQL/uploads:

```sh
docker compose --env-file /etc/personal-journal/production.env \
  --file deploy/compose.yaml --profile restore \
  run --rm restore verify latest
```

Use a concrete snapshot ID during a drill so the evidence names an immutable
recovery point.

## Clean-room apply

Recovery is deliberately fail-closed. `apply` requires all of these:

- a newly created PostgreSQL database containing no user tables;
- an existing, writable, empty Directus upload target;
- `RESTORE_CONFIRM=restore-empty:<database>`;
- a valid manifest/dump checksum and no symlink in restored uploads.

On a clean replacement host, start only PostgreSQL, then run:

```sh
RESTORE_CONFIRM=restore-empty:blog \
docker compose --env-file /etc/personal-journal/production.env \
  --file deploy/compose.yaml --profile restore \
  run --rm restore apply <snapshot-id>
```

The script refuses to clean, truncate, or overwrite a non-empty target. If an
apply is interrupted, discard that clean-room database/upload target and retry
from a new empty target. Do not turn the guard into `pg_restore --clean`.

After apply:

1. Start the pinned Directus 12.2.0 image and verify `/server/ping`.
2. Inspect users, policies, revisions, site settings, representative posts, and
   media through the break-glass account.
3. Compare the restored database with `directus/schema.yaml` using the schema
   diff command. A full database restore already contains Directus and project
   schemas: do **not** automatically apply the snapshot on top of it.
4. Create a fresh Build Reader token if the recovery inventory marks it for
   rotation, then build the complete public snapshot with a BuildKit secret.
5. Compare a recorded set of stable URLs and public media checksums, and verify
   draft/private assets remain absent.
6. Record snapshot time, restore start/end, measured RPO/RTO, and every manual
   intervention. The targets are at most 24 hours of data loss and four hours
   to restore under normal network/DNS conditions.

Caddy certificates and OCI layers are regenerated. Human credentials, MFA
recovery, database/Directus secrets, Restic password, GitHub/GHCR credentials,
SSH keys and alert credentials are recovered from the password manager, not
Restic.
