# Maintenance and security

## Routine release boundary

Routine code/content automation may change only the digest-addressed `site`
service. It cannot update Compose, Caddy, deployment scripts, Directus,
PostgreSQL, schema snapshots, host units, or its own forced-command entrypoint.
Those files require an owner-run maintenance release from a reviewed immutable
Git commit.

Before maintenance:

1. Confirm the selected commit and review infrastructure/schema diffs.
2. Run a fresh offsite backup, `restore verify`, and the freshness check.
3. Render production Compose and validate Caddy with the pinned image.
4. Inspect the Directus schema diff. Additive expansion ships first; compatible
   application code ships next; removal/rename is a later contract release
   after no retained site digest reads the old field.
5. Record current Compose config, Directus/PostgreSQL/Caddy image versions,
   current/previous site digests, and the backup snapshot ID.

Apply one service/config change at a time. Verify PostgreSQL, Directus, site,
preview, and public HTTPS health after each. Roll back host files to the prior
commit and pinned image when schema-compatible; otherwise stop and restore the
recorded backup into a clean environment. Never blindly apply a schema snapshot
after a full database restore.

## HTTP policy

Caddy is the only public container. Current route policies are:

| Surface | Cache | Framing/indexing |
| --- | --- | --- |
| `/_astro/*`, `/_media/*` | one year, `immutable` | public CSP, frame denied |
| Public documents | revalidate | public CSP, frame denied |
| `/healthz` | `no-store` | public CSP |
| `/preview/*` | `private, no-store` | basic auth, `noindex`, CMS-only `frame-ancestors`, `img-src 'self' data:` |
| CMS/API | `private, no-store` | same-origin frame policy; preview origin in `frame-src` |

The trusted preview request header is always stripped. It is injected only in
the authenticated preview proxy and the site port is not published. Preview
requests are omitted from access logs because their paths contain draft/version
identifiers.

The public CSP allows the exact pre-paint theme script hash and Pagefind's
WebAssembly requirement; it does not allow arbitrary inline scripts. A change
to that inline script must update Caddy in an expand/deploy/contract maintenance
sequence. `scripts/verify-csp-hash.mjs` fails CI when generated HTML and Caddy
drift. Preview permits `data:` images because normalized private media is
rendered inline; public `img-src` remains self-only.

## Host hardening

- Allow inbound 80/443 and key-only SSH from the required administration/CI
  sources. Disable SSH passwords, root login, agent/port/X11 forwarding for the
  deployment key, and unrestricted duplicate key entries.
- Apply host security updates on a planned cadence. Reboot into kernel updates
  only after verifying backups and recording site rollback state.
- Keep PostgreSQL on the internal Docker `data` network. Confirm site,
  Directus, and PostgreSQL have no host ports after every Compose change.
- Enable the capacity and external-health timers. Docker and Caddy logs are
  size-limited; alerts must contain operation/unit identifiers, not bodies,
  tokens, preview URLs, or environment dumps.
- Run `pnpm audit --prod` and the workflow's high/critical OCI scan before a
  production image is deployed. Review exceptions explicitly; do not silently
  disable the gate.

## Credential recovery inventory

Store values only in the password manager or protected host/CI environments.

| Credential | Recovery action |
| --- | --- |
| PostgreSQL and Directus `SECRET` | Restore for database recovery; rotate in a planned maintenance window |
| Directus human password/MFA recovery | Restore break-glass access, then rotate after suspected exposure |
| Build/Preview Reader tokens | Recreate/rotate and redeploy the affected build/runtime |
| GitHub dispatch token | Recreate; Directus Flow may publish nothing until replaced |
| GHCR/GitHub Actions token | Recreate through GitHub; never store in Restic |
| Preview basic-auth password/hash and trusted header | Rotate together and recreate Caddy/site |
| Forced SSH key and VPS host key record | Recreate deploy key; independently verify any changed host key |
| Restic password/backend credential | Restore in place unless exposed; losing the password loses backups |
| Alert webhook | Recreate; verify a synthetic generic alert |

Production env files use mode `0600`. They are excluded from application
backups. Never print or source them in CI logs.

## Directus license gate

Directus 12.2.0 uses the Monospace Sustainable Core License. In the tested
architecture, Core does not provide the custom permission rules required to
limit Build Reader/Preview Reader by publication state, fields, and media
folder. There is no broad-read fallback: production remains blocked until the
owner has an applicable OIG/commercial entitlement and the Directus access
tests pass. OIG eligibility and activation/renewal limits must be rechecked
before launch and whenever legal entity size or use changes. No automated local
test can accept those legal terms or allocate an activation.
