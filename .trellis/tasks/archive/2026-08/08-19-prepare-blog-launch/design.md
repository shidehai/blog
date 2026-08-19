# Technical Design

## Overview

This task produces a locally verified release package, not a live deployment.
It closes two launch blockers without changing the public information
architecture:

1. development preview receives a complete, explicit runtime environment;
2. deterministic fixture installation and one-time real catalog launch become
   separate mutation policies.

The current Astro rendering, Directus schema, canonical content definitions,
and public route model remain in place. PostgreSQL/Directus becomes the only
live authority immediately after the one-time launch import.

## Boundaries

### Application runtime

`scripts/env.mjs` remains the single parser for build and site runtime
configuration. `readRuntimeEnv()` stays strict: there is no route-level or
schema-level fixture fallback.

A small development launcher owns only entrypoint wiring:

```text
pnpm dev
  -> load optional untracked .env
  -> prepare fixture or Directus snapshot using readBuildEnv()
  -> construct a complete explicit runtime environment
  -> validate it with readRuntimeEnv()
  -> exec Astro dev with signal/exit propagation
```

For `CONTENT_SOURCE=fixture`, the launcher supplies fixed local-only values for
the otherwise unused Directus URL/token and preview trusted header. These values
are test fixtures, not production defaults, and are never added to
`readRuntimeEnv()`. For `CONTENT_SOURCE=directus`, every URL/token/header must
come from the untracked environment and validation fails before Astro starts.

The development Compose override supplies the same complete contract and may
select fixture or Directus mode explicitly. Production Compose remains fixed to
`CONTENT_SOURCE=directus`.

### Editorial data

`directus/seed/content.mjs` remains the one checked definition of the selected
site identity, topics, 12 post bodies, deterministic IDs, joins, and fixture
dates. Fixture dates remain stable for CI and visual regression only.

Mutation logic is factored into a reusable editorial-state boundary with pure
classification/plan functions and a thin Directus transport. It compares only
explicit deterministic IDs and seed-owned fields. Unknown records and owner
social links are never collection-wide cleanup targets.

There are two commands:

- **Fixture install** creates or verifies development fixture state. It requires
  an explicit fixture confirmation and completes a read-only preflight before
  uploading or writing anything. Exact unchanged fixture state is a no-op. A
  launched timestamp, non-fixture avatar, owner-edited canonical field, partial
  unsafe state, or unexpected known-ID payload makes it fail closed.
- **Launch plan/apply** transforms the canonical fixture into the accepted real
  first release. `plan` is read-only and emits a non-secret manifest;
  `apply` requires that exact manifest hash plus a target-specific confirmation.
  It accepts only absent records, exact fixture records, or records already
  matching that manifest. Anything else fails before mutation.

Neither command deletes unknown posts, topics, joins, files, or social links.
Known legacy fixture cleanup remains exact-ID-only and is allowed only in the
development fixture path unless the launch manifest explicitly names the same
legacy transition.

## Development Preview Data Flow

```text
untracked .env / fixture constants
        |
        v
readBuildEnv() ------> prepare-content.ts ------> .generated/site.json
        |
        v
readRuntimeEnv() ----> Astro dev -------------> /preview/:id
                                               trusted header required
```

The trusted preview route retains all existing behavior:

- no header: intentional text 404 with `private, no-store` and `noindex`;
- trusted fixture mode: reuse prepared public snapshot and post layout;
- trusted Directus mode: server-only preview token, version fetch, and inline
  protected media with no credential-bearing browser URL;
- invalid configuration: process fails before listening with field names only.

Browser tests must run against the production-style server as today. A focused
development-entrypoint test proves the previous generic Astro error page cannot
recur.

## Launch Manifest

The read-only planning command accepts one explicit ISO-8601 UTC launch base
timestamp and writes a mode-0600 JSON manifest under `.generated/` or an
operator-selected ignored path. The manifest contains no credentials or content
bodies. It includes:

- version and target Directus origin (scheme/host only);
- canonical site/settings ID and the 12 post IDs/slugs;
- base launch timestamp and stable per-post `published_at` values;
- canonical array order and a digest of every owned payload;
- expected preflight classifications and allowed mutations;
- overall manifest digest used by the apply confirmation.

The canonical array is newest-first. The schedule assigns unique instants around
the explicit launch base in a bounded interval so Directus' existing
`-published_at, slug, id` ordering reproduces that array. These seconds represent
one batch launch operation; they replace the fixture's fabricated multi-month
history. The schedule is generated once and reused verbatim on retry.

The manifest deliberately excludes administrator tokens, preview URLs with
version IDs, passwords, Markdown bodies, and complete environment snapshots.

## Preflight State Machine

Each deterministic record is classified before mutation:

| State | Fixture install | Launch apply |
| --- | --- | --- |
| Absent | create fixture | create launch payload |
| Exact fixture | no-op | transition owned fields to manifest |
| Exact launch manifest | reject as non-fixture | no-op |
| Owner-modified known ID | reject | reject |
| Unsafe partial known state | reject | reject |
| Unknown ID | preserve | preserve |

Site settings use a field ownership split. The launch owns the accepted text
identity, locale/timezone, SEO copy, and default social image reference. It
preserves an existing avatar and never clears or enumerates owner-created social
links. Fixture install accepts only the known no-avatar/no-social development
state.

Media remains digest-addressed. Exact bytes reuse the existing original;
changed bytes create a new file identity; no command overwrites or automatically
deletes an existing original.

## Apply And Recovery

The Directus API cannot guarantee one transaction across file upload and all
item collections. Apply therefore follows dependency order using deterministic
IDs:

1. repeat full read-only preflight;
2. ensure immutable cover media;
3. write/verify settings and topics;
4. write posts with the manifest timestamps;
5. write joins and exact legacy transitions;
6. re-read and compare the complete launch projection;
7. print only counts, IDs, manifest digest, and status.

An interrupted apply is retried with the same manifest. Records already matching
the manifest are no-ops; fixture/absent records continue; any other state stops.
There is no broad rollback or cleanup. Recovery instructions name the exact
failed phase and require operator review rather than deleting owner data.

After successful launch verification, the import command has no routine update
role. Future content, avatar, social links, and editorial changes occur through
Directus and trigger the normal build flow.

## Compatibility

- Public routes, slugs, topics, article bodies, related-writing scoring, media
  rendering, RSS, sitemap, Pagefind, JSON-LD, and Open Graph shapes do not change.
- Fixture builds keep their deterministic dates and expected screenshots.
- The real Directus projection differs only where intended: launch timestamps,
  operational Directus timestamps/IDs, optional avatar, and future social links.
- Existing published slugs remain immutable.
- No dependency, local Markdown store, public API, or new always-on service is
  introduced.

## Verification

Pure unit tests own plan generation, timestamp ordering, payload digests,
confirmation parsing, field ownership, state classification, and secret-free
errors. Operational/static tests own package scripts and Compose wiring.

An isolated local Directus exercise must prove:

- fixture install twice is stable;
- unknown sentinel records remain byte-for-byte unchanged;
- launched or owner-modified known records make fixture install refuse before
  mutation;
- launch dry-run is read-only;
- apply plus same-manifest retry is idempotent;
- changed manifest or owner-edited known state is rejected;
- public Directus build matches the selected 12-piece catalog and all discovery
  surfaces with launch timestamps;
- avatar/social absence remains intentional and a later owner social/avatar
  addition is preserved.

The final local gate runs focused tests, `pnpm verify`, Compose validation,
operations/CSP checks, and Directus schema/access/workflow checks when the local
license entitlement permits them. Unavailable license-gated evidence is reported
as an external prerequisite, not silently skipped as success.

## Rollback And Deferred Deployment

Source rollback is a normal revert and fixture rebuild. Isolated test databases
can be discarded only through their existing explicit development teardown
procedure. The implementation never performs destructive operations against an
owner database.

Real VPS provisioning, DNS, TLS, image deployment, offsite Restic, alert setup,
and clean-room production restore are deferred to a separate task. The generated
runbook records their commands and prerequisites but does not claim completion.

