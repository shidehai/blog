# Database Guidelines

## Source of Truth

PostgreSQL is the only live authority for content, settings, taxonomy, media
metadata, users, and revisions. Directus owns access and schema configuration.
The Astro application consumes validated API snapshots; it does not connect to
PostgreSQL or introduce an ORM.

## Current Contract

`deploy/compose.yaml` pins PostgreSQL 17.9 and Directus 12.2.0. Required database
configuration is `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`.
Directus receives those values over the internal `data` network.

- Production publishes no PostgreSQL port.
- Development may publish `127.0.0.1:5432` only.
- Data lives at `${BLOG_DATA_ROOT}/postgres`; uploads live separately at
  `${BLOG_DATA_ROOT}/directus/uploads`.
- The Directus schema snapshot belongs at `directus/schema.yaml` once Phase 2
  creates real collections.

## Schema Changes

Use reviewed Directus snapshots and expand/deploy/contract ordering. Never
apply a destructive contraction in the release that first stops reading the
old field. A full database restore already includes the Directus schema and
must not be followed by a blind schema apply.

Do not add speculative SQL migrations before a real Directus snapshot exists.
Database constraints and CMS validation added in Phase 2 must agree on slug,
status, required-field, and relationship rules.

## Scenario: Immutable Seeded Media Fixture

### 1. Scope / Trigger

Apply this contract whenever a Directus seed adds or changes raster media used
by public builds. A fixture that only exposes readable metadata is not valid;
the exact uploaded bytes must pass the same transform path as production media.

### 2. Signatures

- Fixture owner: `loadSeedCoverFixture()` returns `bytes`, `filename`,
  `mimeType`, and a digest-addressed `title`.
- Seed boundary: `ensureFile(title, folder, type, bytes, filename)` uses the
  title as its idempotency key and never replaces an existing original's bytes.
- Regression boundary: `emitPublicMediaAsset(record, bytes, options)` emits and
  decodes every expected responsive variant.

### 3. Contracts

- Read fixture bytes from a committed raster asset relative to
  `import.meta.url`; do not embed opaque Base64 raster bytes in the seed.
- Include the first 12 lowercase hexadecimal characters of SHA-256 in the
  Directus title. Identical bytes reuse one file identity; changed bytes create
  a new identity.
- After a byte change, update settings and post relations to the new file. Keep
  the old original unmodified and unreferenced; hard deletion is an explicit
  administrator maintenance action.
- The unit test imports the same fixture helper as the seed. A generated
  lookalike or metadata-only Sharp check does not cover this contract.

### 4. Validation & Error Matrix

| Input/state | Required result |
| --- | --- |
| Identical bytes seeded twice | One digest-addressed file; stable references |
| Fixture bytes change | New title and Directus file identity |
| Fresh database has no legacy original | Pass without manufacturing an orphan |
| Old invalid original exists | Leave bytes intact; move references away |
| Metadata reads but variant transform fails | Test and Directus build fail closed |
| MIME, byte length, or dimensions disagree | Media validation fails with file context |
| File is outside the publishable folder | Public build rejects it |

### 5. Good/Base/Bad Cases

- Good: a committed WebP is digest-addressed, seeded twice idempotently, and
  transformed from the exact helper bytes into deterministic 640/960 outputs.
- Base: the current bytes reuse the existing file and refresh only safe
  metadata such as title/folder plus content references.
- Bad: an inline Base64 image, a stable human-only title across byte changes,
  overwriting an existing Directus original, deleting the orphan automatically,
  or testing a separately generated image.

### 6. Tests Required

- Import the seed fixture helper and assert its full digest, MIME, filename,
  byte length, and intrinsic dimensions.
- Run `emitPublicMediaAsset` twice in separate directories and compare the
  returned model plus emitted bytes.
- Decode every emitted WebP and assert deterministic paths and 640/960
  dimensions.
- Seed a real local Directus twice, query uniqueness and references, then run a
  Directus-backed Astro/Pagefind build.
- Make the schema check accept a clean install with no legacy original. When a
  legacy fixture is present, assert that it remains unchanged and unreferenced.

### 7. Wrong vs Correct

#### Wrong

```javascript
const bytes = Buffer.from("opaque-raster-base64", "base64");
await ensureFile("fixture-cover", folder, "image/png", bytes, "cover.png");
// The test creates a different valid image, so corrupt seed bytes are missed.
```

#### Correct

```javascript
const fixture = await loadSeedCoverFixture();
await ensureFile(
  fixture.title,
  folder,
  fixture.mimeType,
  fixture.bytes,
  fixture.filename,
);
// The media test imports loadSeedCoverFixture and transforms fixture.bytes.
```

## Scenario: Canonical Editorial Seed Migration

### 1. Scope / Trigger

Apply this contract when checked fixture content is added, replaced, or migrated
through Directus. The same records feed local builds and real seed operations,
so fixture, database, media, relation, and public-route behavior must stay in
one reviewed boundary.

### 2. Signatures

- Canonical builder: `buildEditorialFixture({ coverId })` returns Directus-shaped
  `topics`, `posts`, and `postTopics` arrays.
- Seed writer: `upsertItem(collection, id, data)` reads and writes only the
  supplied deterministic ID.
- Known cleanup: `deleteKnownItem(collection, id)` deletes only an enumerated
  deterministic fixture ID.
- Build boundary: `fixtureInput()` composes the canonical records with settings,
  media metadata, and fixture-only source details before Zod validation.

### 3. Contracts

- PostgreSQL/Directus remains the only live content authority. The checked
  module is seed/build fixture data, not a runtime Markdown store.
- Define editorial IDs, slugs, topics, joins, settings, and bodies once. Fixture
  builds and Directus seed operations consume the same builder output.
- Published post slugs are immutable. Legacy fixture posts are enumerated by
  exact ID and archived under their existing slugs.
- Seed upserts resolve only by deterministic ID. Never fall back to a title,
  slug, label, or collection-wide match that could capture owner content.
- Delete or replace only explicitly listed fake fixture records. Unknown posts,
  topics, joins, files, and social links are untouched.
- Junction IDs are deterministic, unique, and overwrite only known fixture
  joins; no public join may reference an archived post.
- Digest-addressed media follows the immutable media fixture scenario above.

### 4. Validation & Error Matrix

| Input/state | Required result |
| --- | --- |
| Seed runs twice with unchanged content | Stable counts, IDs, joins, slugs, and media reference |
| Known legacy post exists | Archive it by exact ID and preserve its slug |
| Known fake social link exists | Delete only its enumerated ID |
| Unknown owner record exists | Leave every field and relation unchanged |
| Deterministic ID exists with stale fixture data | Patch that exact record |
| Expected relation points at an archived post | Schema/seed check fails |
| Fixture and Directus catalogs diverge | Build/parity verification fails |
| Cleanup lacks permission | Post-seed check must fail; do not treat the seed log alone as proof |

### 5. Good/Base/Bad Cases

- Good: one canonical 12-piece fixture seeds twice, preserves legacy slugs,
  replaces known joins by ID, and produces the same Directus-backed public
  catalog without touching an added unknown record.
- Base: a clean database receives deterministic records and a fixture build
  validates the same raw shapes through the normal snapshot parser.
- Bad: deleting all non-canonical records, matching an upsert by slug/title,
  rewriting a legacy slug, replacing existing media bytes, or maintaining a
  second hand-copied fixture catalog.

### 6. Tests Required

- Unit tests assert record counts, kind mix, unique IDs/slugs/joins, one featured
  post, used topics, representative related ordering, and normalized settings.
- Seed a real local Directus twice and assert idempotent counts, exact archived
  legacy mappings, no archived joins, and absence of only known fake socials.
- Insert or preserve a sentinel record outside the deterministic fixture IDs and
  assert the seed does not mutate or delete it.
- Run fixture and Directus-backed Astro/Pagefind builds and compare the public
  catalog, routes, media, search, feed, sitemap, metadata, and export projections.

### 7. Wrong vs Correct

#### Wrong

```javascript
const [existing] = await request(filterPath("items/posts", "slug", post.slug));
await request(`/items/posts/${existing.id}`, { method: "PATCH", body: post });
await request("/items/posts", { method: "DELETE", body: { filter: { id: { _nin: canonicalIds } } } });
```

#### Correct

```javascript
await upsertItem("posts", post.id, post);
for (const legacy of LEGACY_FIXTURE_POSTS) {
  await upsertItem("posts", legacy.id, { ...legacy, status: "archived" });
}
for (const socialId of KNOWN_FAKE_SOCIAL_IDS) {
  await deleteKnownItem("social_links", socialId);
}
```
