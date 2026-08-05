# Operations

Production is one Docker Compose stack on the owner's VPS. Routine releases
replace only the digest-addressed `site` image. Compose, Caddy, deployment
scripts, Directus/PostgreSQL versions, schema snapshots, and host units change
only in an owner-run maintenance release.

- [Deployment](./deployment.md): CI inputs, forced SSH command, candidate
  preflight, automatic rollback, and state files.
- [Backup and restore](./backup-restore.md): nightly snapshots, retention,
  integrity checks, freshness monitoring, and clean-room drills.
- [Maintenance and security](./maintenance-security.md): infrastructure
  changes, headers, firewall/SSH, secret recovery, licensing, and patching.

No command in these runbooks deletes the live database, uploads, Docker
volumes, or unrelated images. A destructive recovery action requires a clean
target or a separately approved maintenance window.
