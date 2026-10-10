# Production Launch Runbook

This runbook guides the one-time transition from development fixtures to the
truthful first editorial release of the 12-piece canonical catalog.

## Scope

- **In scope for this runbook:** generating a deterministic launch schedule with
  truthful timestamps, preflight state verification, applying the launch
  manifest to Directus, and verifying the published catalog and discovery routes.
- **Deferred to future deployment task:** provisioning external VPS, domain DNS,
  Let's Encrypt TLS certificates, GHCR image publishing, remote Restic backup
  repository setup, and uptime alerts.

---

## 1. Prerequisites

1. Directus and PostgreSQL services are running and accessible.
2. `directus/schema.yaml` applied and `directus:bootstrap` completed.
3. Administrator credentials available via `.env` (`DIRECTUS_ADMIN_EMAIL` /
   `DIRECTUS_ADMIN_PASSWORD` or `DIRECTUS_ADMIN_TOKEN`).
4. An isolated target database is selected (production or staging Directus
   origin).

---

## 2. Launch Planning (Read-Only)

Generate a reproducible, mode-0600 launch manifest specifying an explicit UTC
base timestamp:

```bash
pnpm launch:plan --base-time=2026-08-19T12:00:00.000Z
```

### Expected Output

- Generates `.generated/launch-manifest.json` (mode `0600`).
- Displays the target origin, base timestamp, canonical post count (12), and
  the computed 64-character SHA-256 `manifestDigest`.
- Prints the exact apply command and confirmation string.

### Abort Conditions

- `base-time` is not a valid ISO-8601 UTC string ending in `Z`.

Planning is offline and does not authenticate or contact Directus.

---

## 3. Launch Apply

Apply the planned manifest using the explicit confirmation token:

```bash
pnpm launch:apply \
  --manifest=.generated/launch-manifest.json \
  --confirm=CONFIRM_LAUNCH_<manifestDigest>_FOR_<targetOrigin>
```

The configured `DIRECTUS_URL` must have the same HTTP(S) origin as the manifest.
Host, protocol or effective-port differences, and invalid URLs, are rejected
before authentication or any CMS request. Equivalent hostname case, default
ports and trailing slashes are accepted. If the target changes, review a newly
generated plan for that target. URLs must not embed a username or password;
use the administrator environment credentials instead.

### Execution Steps Executed Automatically

1. **Manifest Integrity Check**: Verifies file contents against `manifestDigest`.
2. **Target and Confirmation Check**: Validates the configured endpoint's origin
   and explicit confirmation before authentication.
3. **Preflight State Classification**: Reads existing records; aborts if any
   known ID contains unexpected or owner-modified content. The four legacy
   fixture IDs must match either their exact historical originals or current
   archived targets before any mutation.
4. **Immutable Media**: Uploads or reuses digest-addressed cover media.
5. **Settings & Topics**: Upserts site settings (preserving existing owner avatar)
   and the 6 canonical topics.
6. **Posts**: Upserts the 12 canonical posts with unique descending
   `published_at` timestamps.
7. **Relations**: Upserts the 28 post-topic join records.
8. **Legacy Transitions**: Marks recognized legacy development fixture posts as
   archived, preserving their stable slugs.
9. **Verification**: Reports the published-post count after the writes.

---

## 4. Verification Evidence

Run the following checks to verify launch success:

```bash
# 1. Verify Directus schema and published record counts:
pnpm directus:schema:check

# 2. Run the Directus-backed Next static build:
CONTENT_SOURCE=directus DIRECTUS_URL=<url> DIRECTUS_BUILD_TOKEN=<token> pnpm build

# 3. Verify public test suite passes:
pnpm verify
```

---

## 5. Post-Launch Operational Contract

- **Directus is live source of truth**: All subsequent writing, editing, tagging,
  and media uploads must be performed via Directus Studio.
- **Non-overwrite protection**: Re-running `directus:seed` or `launch:apply`
  against a launched or edited database will be refused by preflight.
- **Rerun idempotency**: Running `launch:apply` with the exact same manifest
  against an unedited launch snapshot is a safe no-op.
- **Legacy ownership**: An edited legacy fixture body, slug or other owned
  field causes preflight refusal. A fully matching historical original may be
  archived; an already matching archive is unchanged. Seed also checks these
  rows before its no-write early exit and can repair a missing legacy row alone.
