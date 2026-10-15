# CMS database, media and recovery contracts

## 1. Scope / Trigger

Applies to store/auth/migrations/media/transfer and shared fields. PostgreSQL is
the only live authority. Git contains code/fixtures, not a second live body store.

## 2. Signatures

- `migrate(pool: Pool): Promise<void>`
- `store.save(id, expectedVersion, draft): Promise<AdminContent>`
- `store.publish(id, {version, revisionId, key}): Promise<Publication>`
- `store.archive(id, version)` / `store.restore(id, version, revisionId)`
- `persistImage(root, bytes, filename, id?, reuseExisting?)`
- `manage.mts migrate | owner --password-stdin`
- `transfer.mts export|verify|restore|source-export|source-import PATH`
- `importSource(pool, mediaRoot, sourceInput, uploads, sourceOrigin)` returns the
  saved report; replay of the same batch returns the original report unchanged.

CLI explicitly loads .env.local with `node --env-file=.env.local --import=tsx`.

## 3. Contracts

Provision blog_cms role/schema with an administrative identity; normal migrations
use a nonsuperuser without createdb/createrole or legacy grants, owning author_cms.
Check pg_namespace before CREATE SCHEMA: even IF NOT EXISTS requires database
CREATE privilege. Never repeat schema creation in migration SQL. Ordered migrations
are checksum-verified, transactional and advisory-locked; never edit applied SQL.

owner.id=1 is the sole identity. Passwords use salted scrypt; sessions store digests
and are revoked on reset. No registration/team/role model.

Changed saves create immutable revisions and advance draft/version optimistically;
identical saves deduplicate. Restoring history creates a new draft, never publishes.
Publish locks content/referenced media, checks exact version/revision, required
fields, taxonomy, slugs/aliases and original files; atomically changes published
pointer/references/generation/idempotent result. Same key/request returns same
result; preserve the key across unknown outcomes. Archive atomically withdraws.

Published fields come from one revision. Public catalog contains article/tutorial
summaries only. Profile/taxonomy saves explicitly change public configuration.
Aliases point to content IDs and resolve directly to current slug; archives keep
reserved addresses. No public note/topic channel is implied.

Images: PNG/JPEG/WebP/GIF/AVIF, <=20 MiB, <=40 million pixels, verified with Sharp.
Persist immutable bytes with atomic link and file/directory fsync before DB metadata.
Verify checksum on read/publish. Public media requires publishable=true and a
current public reference; privacy changes advance generation. Never expose root.

Read-only consistent source export/import preserves stable IDs, addresses/times,
relationships, versions/revisions and raw archive. Import into an empty isolated
target. Keep SVG originals private plus PNG display copies. Interrupted retry reuses
only verified identical files; replay never overwrites author changes. Report every
unconverted partial/deleted/junction/non-post history. readyForCutover=false requires
reconciliation; preserving raw history is not reconstructing editable history.

Historical relations require independent arrays of objects with tags_id/topics_id;
explicit [] stays empty. Never fill missing fields, ID-only arrays or relation delta
operations from the current junction table. Complete deleted snapshots with matching
IDs and a timestamped deletion event recover as archived=true, published pointer=null,
draft_slug=null, without aliases. Restore only recoverable fields; topic membership is
owned by posts. Order revisions by activity time/id, not export row order.

Report historyReconciliation.version=1 with per-record source/id/collection/item,
activityId/action/timestamp, disposition, targetId/targetRevisionId or code/reason/
missingFields. Count every source revision/version and activity lacking a revision.
Delete events with separate snapshots remain event-only; deleted-item-without-snapshot
is a limitation. Checking a new converter needs a new empty target, not same-batch replay.

Browser JSON export omits files. Full bundles include actual media/raw archives,
manifest/checksums, exclude passwords/sessions. Restore verifies all bytes, requires
an empty schema and commits atomically; target owns access. Full pg_restore ownership
repair stays inside author_cms, never broad REASSIGN OWNED in the shared database.

## 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| Stale version, occupied slug/name | 409, no overwrite |
| Missing fields/relations/media | 422, no partial publication |
| Same key, changed publish request | 409 |
| Private/unreferenced media | Public 404 |
| Missing/corrupt bytes | Refuse read/publish |
| Nonempty import/restore target | Refuse, preserve source/target |
| Incomplete history | Explicit limitations; no automatic cutover |
| Historical ID-only / delta relations | archive-only, never borrow current values |
| Complete deleted snapshot + deletion proof | Private archival recovery; no alias |
| Delete activity without any original snapshot | deleted-item-without-snapshot limitation |
| Changed migration checksum | Roll back, stop startup |

## 5. Good / Base / Bad Cases

- Good: reject stale tabs, restore to draft, publish one precise revision.
- Base: restricted schema owner initializes and full bundle restores elsewhere.
- Bad: draft title joined to old public body, new key after timeout, superuser as startup fix, or matching current counts called lossless history.

## 6. Tests Required

DB tests cover singleton owner, saves/dedup, rollback, aliases/idempotency, history,
archive/privacy generation, reader denial and full bundle round-trip. Source tests
cover unbound versions, incomplete/junction history, interrupted retry and originals.
Assert explicit empty/old relations differ correctly from current ones, unsafe relation
forms refuse conversion, absent deletion proof refuses recovery, shuffled history picks
the latest recoverable revision, archival recovery never publishes/reserves addresses,
and full restore preserves audit records plus raw source.
CMS image test proves restricted startup, Sharp/auth/publish/bundled CLIs. Compare
restored data manifests and actual original bytes, not just counts.

## 7. Wrong vs Correct

Wrong: separately update published pointer, media and generation.
Correct: `store.publish(id, {version, revisionId, key})` performs every check/state
change in one transaction, with media durably stored beforehand.

Retired runtime/schema/seed/launch tools are removed. Keep offline source snapshot
conversion and raw archives recoverable without reintroducing a platform dependency.
