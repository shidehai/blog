# Database Guidelines

## Source of Truth

PostgreSQL is the only live authority for content, settings, taxonomy, media
metadata, users, and revisions. Directus owns access and schema configuration.
The Next build consumes validated published API snapshots; it does not connect
to PostgreSQL or introduce an ORM.

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
by public builds. Seed media belongs to Directus, not the retired V1 public
directory. A successful fixture build alone does not prove CMS image integrity.

### 2. Signatures

- Fixture owner: `loadSeedCoverFixture()` returns `bytes`, `filename`,
  `mimeType`, and a digest-addressed `title`.
- Seed boundary: `ensureFile(title, folder, type, bytes, filename)` uses the
  title as its idempotency key and never replaces an existing original's bytes.
- Committed source: `directus/seed/assets/ai-reliability-boundaries-960.webp`.
- Offline regression: `node tests/seed-fixture.mjs` checks the exact committed
  bytes and digest-addressed metadata without CMS credentials.
- Public mapping: V2 validates referenced publishable originals during the build
  and copies exact raster bytes to `/_cms/<sha256>.<ext>`; it does not emit V1
  responsive variants or regenerate authored media. See frontend Type Safety
  for the snapshot media contract.

### 3. Contracts

- Read fixture bytes from a committed raster asset relative to
  `import.meta.url`; do not embed opaque Base64 raster bytes in the seed.
- Include the first 12 lowercase hexadecimal characters of SHA-256 in the
  Directus title. Identical bytes reuse one file identity; changed bytes create
  a new identity.
- After a byte change, update settings and post relations to the new file. Keep
  the old original unmodified and unreferenced; hard deletion is an explicit
  administrator maintenance action.
- The offline test imports the same fixture helper as the seed. A separately
  generated lookalike does not cover a missing or changed committed asset.
- Neither Next builds nor CMS seed runs regenerate authored raster bytes.
  Restoring a deleted fixture must preserve its original digest rather than
  silently uploading a newly rendered replacement.

### 4. Validation & Error Matrix

| Input/state                                            | Required result                              |
| ------------------------------------------------------ | -------------------------------------------- |
| Identical bytes seeded twice                           | One digest-addressed file; stable references |
| Fixture bytes change                                   | New title and Directus file identity         |
| Fresh database has no legacy original                  | Pass without manufacturing an orphan         |
| Old invalid original exists                            | Leave bytes intact; move references away     |
| Committed seed asset is missing or altered             | Offline fixture regression fails             |
| MIME, byte length, dimensions, or folder disagree      | Directus schema/media check fails            |
| Fixture build succeeds without CMS downloads           | Do not treat this as CMS image-byte validation |

### 5. Good/Base/Bad Cases

- Good: the exact committed WebP is digest-addressed, seeded twice idempotently,
  and exposed through the publishable Directus asset boundary.
- Base: the current bytes reuse the existing file and refresh only safe
  metadata such as title/folder plus content references.
- Bad: an inline Base64 image, a stable human-only title across byte changes,
  overwriting an existing Directus original, deleting the orphan automatically,
  or testing a separately generated image.

### 6. Tests Required

- Import the seed fixture helper and assert its full digest, MIME, filename,
  byte length, and intrinsic dimensions.
- Run the offline fixture regression as part of `pnpm verify`.
- Run `tests/directus.mjs schema` against a disposable or backed-up instance;
  assert one digest-addressed cover with the expected 960x540 dimensions,
  publishable folder, MIME, filename, and byte length.
- Seed a real local Directus twice, query uniqueness and references, then run a
  Directus-backed Next static build.
- Make the schema check accept a clean install with no legacy original. When a
  legacy fixture is present, assert that it remains unchanged and unreferenced.
- When testing remote media integrity, download the original and compare its
  digest with the helper bytes; do not rely on Next's URL mapping alone.

### 7. Wrong vs Correct

#### Wrong

```javascript
const bytes = Buffer.from("opaque-raster-base64", "base64");
await ensureFile("fixture-cover", folder, "image/png", bytes, "cover.png");
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
```

## Scenario: Idempotent Editorial Timestamps

### 1. Scope / Trigger

Apply this contract when seed data is upserted into collections with Directus
`date_created` and `date_updated` system fields, or when public metadata exposes
an editorial update date.

### 2. Signatures

- Seed comparison: `itemMatchesOwned(existing, desired, ownedFields)` compares
  only fields owned by the seed and skips an unchanged `PATCH`.
- Content input: V2 requests `published_at` and nullable `date_updated`.
- Public model: V2 copies a truthy `date_updated` to optional `Post.updatedAt`;
  a null or empty value omits the property.

### 3. Contracts

- Directus system timestamps are operational metadata. V2 currently does not
  distinguish same-day imports from meaningful later-day editorial revisions;
  the removed V1 calendar-day normalization is not a current contract.
- Seed writes omit both system timestamp fields and let Directus own them.
- Exact-ID seed reruns skip unchanged topics, posts, joins, and settings so a
  later maintenance run does not manufacture a new update date.

### 4. Validation & Error Matrix

| State                           | Public result                                            |
| ------------------------------- | -------------------------------------------------------- |
| `date_updated` null or empty    | Omit `updatedAt`                                         |
| `date_updated` is nonempty      | Preserve exact value, without calendar-day normalization |
| Seeded fields are unchanged     | No PATCH; Directus timestamp remains stable              |
| Seeded content actually changes | PATCH exact known ID; later date may surface             |

### 5. Good/Base/Bad Cases

- Good: an unchanged seed rerun does not manufacture a new Directus update date.
- Base: the mapper preserves the API timestamp without claiming editorial
  normalization that V2 does not implement.
- Bad: every seed rerun patches every post and displays the seed execution time
  as the article's update date.

### 6. Tests Required

- Assert the V2 mapper preserves nonempty `date_updated` and omits null values.
- Seed twice and compare all canonical post timestamps after the first and
  second run; they must be byte-for-byte equal.
- Do not make calendar-day normalization or JSON-LD parity an acceptance gate
  without a separately scoped implementation and regression test.

### 7. Wrong vs Correct

#### Wrong

```javascript
await request(`/items/posts/${id}`, { method: "PATCH", body: desired });
```

#### Correct

```javascript
if (!itemMatchesOwned(existing, desired, POST_OWNED_FIELDS)) {
  await request(`/items/posts/${id}`, { method: "PATCH", body: desired });
}
```

## Scenario: Canonical Editorial Seed Migration

### 1. Scope / Trigger

Apply this contract when checked fixture content is added, replaced, or migrated
through Directus. CMS seed ownership, media, relations, and public-route
behavior must stay in one reviewed boundary. V2's independent offline catalog
is not the canonical CMS seed and is not a source of production content.

### 2. Signatures

- Canonical builder: `buildEditorialFixture({ coverId })` returns Directus-shaped
  `topics`, `posts`, and `postTopics` arrays.
- Install/launch payload: `buildFixturePayloads({ coverId, publishedAtMap? })` adds the current
  `EDITORIAL_SETTINGS` and the same `default_og_image` identity. Preflight and
  writes must use this shared payload shape; optional scheduled timestamps are
  forwarded to the canonical post builder.
- Seed writer: `upsertItem(collection, id, data, ownedFields)` reads and writes
  only the supplied deterministic ID and compares its owned fields.
- Known cleanup: `deleteKnownItem(collection, id)` deletes only an enumerated
  deterministic fixture ID.
- Historical legacy source: `buildLegacyFixtureOriginals({ coverId })` returns
  frozen original payloads backed by `29d5d85^:directus/seed/index.mjs`. A null
  cover ID omits the two media-bearing originals, so missing media cannot be
  used to recognize an old article/tutorial.
- Build boundary: `frontend-v2/lib/fixture.ts` passes independent `FIXTURE_ROWS`
  to the shared V2 snapshot builder. The Directus adapter performs Zod decoding
  before calling that builder.

### 3. Contracts

- PostgreSQL/Directus remains the only live content authority. The checked
  module is CMS seed data, not a runtime Markdown store.
- Define CMS editorial IDs, slugs, topics, joins, settings, and bodies in the
  seed builder. V2 offline fixtures intentionally have a separate catalog;
  validate each source's public article/tutorial projection rather than
  claiming identical counts, bodies, timestamps, or taxonomy.
- Published post slugs are immutable. Legacy fixture posts are enumerated by
  exact ID and archived under their existing slugs.
- Seed upserts resolve only by deterministic ID. Never fall back to a title,
  slug, label, or collection-wide match that could capture owner content.
- Delete or replace only explicitly listed fake fixture records. Unknown posts,
  topics, joins, files, and social links are untouched.
- Junction IDs are deterministic, unique, and overwrite only known fixture
  joins; no public join may reference an archived post.
- Digest-addressed media follows the immutable media fixture scenario above.
- Before ownership classification, resolve the existing cover ID by the exact
  digest-addressed fixture title using a read-only `/files` query. Uploaded
  file UUIDs are generated by Directus, not equal to `EDITORIAL_IDS.cover`.
  Use that UUID consistently in settings, cover relations, and Markdown media
  references; never upload a file to make preflight pass.
- Settings ownership covers the current `author_name`, `biography`,
  `default_og_image`, `default_seo_description`, `footer_text`, `homepage_intro`,
  `locale`, `site_name`, `tagline`, and `timezone` fields. Preserve the owner's
  `avatar` and other nonowned fields. Obsolete V1 field names must not replace
  the actual settings ownership contract.
- Classify every owned record before any mutation. Existing owned data that
  differs, including a changed cover or a missing referenced fixture file,
  fails closed. An exact repeat install exits without writes, preserving
  original `date_created` and `date_updated` values.
- Apply that preflight to all four `LEGACY_FIXTURE_POSTS` IDs as well as the
  canonical catalog. Match `POST_OWNED_FIELDS` against either the immutable
  historical original (using the actual cover UUID) or current archived
  target. Edited bodies, slugs and other owned fields refuse the whole
  operation before any upload, cleanup or write. An enumerated ID alone is
  insufficient proof of ownership.
- Seed's no-write early exit follows legacy classification. Missing legacy
  rows and exact historical rows needing archive migration count as mutations
  even when the entire canonical catalog already matches. Exact archived
  targets remain unchanged on replay.

### 4. Validation & Error Matrix

| Input/state                                                   | Required result                                                                    |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Seed runs twice with unchanged content                        | No writes; stable content, timestamps, IDs, joins, slugs, and media reference      |
| Cover upload has a generated UUID                             | Resolve the existing digest-addressed file read-only and compare against that UUID |
| Owned settings/profile/footer/cover differs                   | Refuse before file uploads, patches, or deletes                                    |
| Existing owned rows lack the expected fixture cover           | Refuse before mutation rather than inventing a matching UUID                       |
| Confirmed partial fixture installation lacks one known record | Create only the absent record; do not patch matching records or file metadata      |
| Known legacy post exactly matches its historical original     | Migrate to its enumerated archived target; preserve its slug                       |
| Known legacy post exactly matches the archived target         | Skip the PATCH and preserve every timestamp                                        |
| Any legacy owned field differs from both known payloads       | Refuse before mutation, even during partial repair or before seed's early exit     |
| Only a known legacy row is missing or needs migration         | Require normal confirmation and repair/migrate that row without patching matches   |
| Known fake social link exists                                 | Delete only its enumerated ID                                                      |
| Unknown owner record exists                                   | Leave every field and relation unchanged                                           |
| Deterministic ID exists with different owned data             | Refuse before mutation; require a separately reviewed migration                    |
| Expected relation points at an archived post                  | Schema/seed check fails                                                            |
| V2 fixture and CMS seed catalogs differ                       | Validate each source independently; no catalog-equality gate                       |
| Cleanup lacks permission                                      | Post-seed check must fail; do not treat the seed log alone as proof                |

### 5. Good/Base/Bad Cases

- Good: one canonical 12-piece fixture seeds twice, preserves legacy slugs,
  replaces known joins by ID, and produces the same Directus-backed public
  catalog without touching an added unknown record.
- Base: a clean database receives deterministic seed records, while an offline
  V2 build constructs its independent catalog through the shared snapshot builder.
- Bad: deleting all non-canonical records, matching an upsert by slug/title,
  rewriting a legacy slug, replacing existing media bytes, or silently
  substituting V2 fixture content after a Directus read fails. Do not treat a
  legacy ID as permission to overwrite a body the owner has edited.

### 6. Tests Required

- Unit tests assert record counts, kind mix, unique IDs/slugs/joins, one featured
  post, used topics, representative related ordering, and normalized settings.
- `node tests/seed-install.mjs` exercises the real seed entrypoint with an
  intercepted offline transport: generated cover IDs, current owned-field
  edits, first-install writes, confirmed partial repair without redundant
  patches, explicit confirmation, dry-run, and zero preflight mutations. Keep
  it in the root `pnpm verify` gate.
- Seed a real local Directus twice and assert idempotent counts, exact archived
  legacy mappings, no archived joins, unchanged original timestamps, and
  absence of only known fake socials.
- Insert or preserve a sentinel record outside the deterministic fixture IDs and
  assert the seed does not mutate or delete it.
- Both offline seed and launch entrypoints must cover exact historical
  migration, archived no-write replay, legacy-only partial repair and edits to
  legacy body/slug/other owned fields. Assert unchanged complete state and
  original timestamps on refusal with canonical-complete and partial states.
- Check immutable historical payloads against the original source, not only a
  test fixture imported from the new builder itself.
- Run fixture and Directus-backed Next builds independently. In each, check
  the canonical archive routes and published article/tutorial projection;
  do not require the independent catalogs to have identical counts or bodies.

### 7. Wrong vs Correct

#### Wrong

```javascript
const [existing] = await request(filterPath("items/posts", "slug", post.slug));
await request(`/items/posts/${existing.id}`, { method: "PATCH", body: post });
await request("/items/posts", {
  method: "DELETE",
  body: { filter: { id: { _nin: canonicalIds } } },
});
```

#### Correct

```javascript
for (const legacy of LEGACY_FIXTURE_POSTS) {
  const existing = await fetchItem("posts", legacy.id);
  const original = originals.find((post) => post.id === legacy.id);
  const state = classifyRecordState(
    existing,
    original,
    legacy,
    POST_OWNED_FIELDS,
  );
  if (state === "owner_modified")
    throw new Error("Legacy ownership preflight refused");
}
// Complete every ownership check before any mutation or early no-op return.
await upsertItem("posts", post.id, post, POST_OWNED_FIELDS);
for (const legacy of LEGACY_FIXTURE_POSTS) {
  await upsertItem("posts", legacy.id, legacy, POST_OWNED_FIELDS);
}
for (const socialId of KNOWN_FAKE_SOCIAL_IDS) {
  await deleteKnownItem("social_links", socialId);
}
```

## Scenario: Launch Target, Media Identity and Replay

### 1. Scope / Trigger

Apply this contract when `directus/launch.mjs apply` schedules canonical
editorial content, both over an installed fixture and into a clean CMS. A
successful seed alone does not verify the launch writer's media references.

### 2. Signatures

- `node directus/launch.mjs plan --base-time=<ISO> --output=<path>` produces the
  existing offline version-1 manifest and digest without CMS requests.
- `node directus/launch.mjs apply --manifest=<path> --confirm=CONFIRM_LAUNCH_<digest>_FOR_<origin>`
  verifies manifest integrity, configured/manifest HTTP(S) origin equality and
  explicit confirmation before authentication.
- `buildFixturePayloads({ coverId, publishedAtMap? })` returns canonical
  settings, posts, topics, and joins for both preflight and writes.
- Preflight resolves `/files` by the exact digest-addressed fixture title with
  `fields=id`; uploading or patching media is not a preflight operation.

### 3. Contracts

- Resolve the actual existing uploaded UUID before classifying settings, posts,
  topics, and joins against fixture/scheduled targets. Missing fixture media
  with existing owned rows fails closed before any mutation.
- A fresh install may upload only after all ownership checks. Rebuild the
  desired payload from the returned file UUID before writing settings, cover
  relations, or `directus://` Markdown references. The offline manifest's
  logical cover placeholder is never an actual uploaded-file identity.
- Compare each upsert with its supplied deterministic `id`. Reuse matching
  file metadata and skip matching record PATCHes; replaying the same manifest
  preserves content and all original system timestamps.
- Preserve avatar/nonowned fields and unknown records. Do not write supplied
  `date_created`/`date_updated`; Directus owns operational timestamps.
- Bind the effective `DIRECTUS_URL` (or the client's `http://127.0.0.1:8055`
  default) to the manifest's normalized HTTP(S) origin before `adminClient()`.
  Scheme, host and effective port must match. Equivalent hostname case,
  default ports and trailing slashes are accepted; paths are outside the
  existing origin confirmation contract. Preserve manifest version/digest and
  confirmation format rather than rewriting a plan to fit the environment.
- Require credential-free HTTP(S) URLs; embedded username/password values are
  unsupported by native fetch and must be refused before authentication.
  Reject malformed/non-HTTP(S) URLs with bounded, value-free errors. Never
  echo a full URL, embedded credentials, a token or the native URL parser's
  input. Origin/confirmation refusal makes zero requests, including login.

### 4. Validation & Error Matrix

| Input/state                                                           | Required result                                                         |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Installed fixture uses a generated cover UUID                         | Accept the owned fixture and preserve that media identity               |
| Clean CMS uploads a new fixture cover                                 | Rebuild every media reference with the returned UUID                    |
| Same manifest is reapplied                                            | Zero writes; unchanged content and timestamps                           |
| Owned profile, post, cover, or join differs                           | Refuse before uploads, patches, or deletes                              |
| Expected cover is missing but owned rows exist                        | Refuse before mutation rather than inventing a matching UUID            |
| Digest is altered or confirmation is absent/incorrect                 | Refuse before authentication or CMS requests                            |
| Configured host, scheme or effective port differs from manifest       | Refuse before authentication or CMS requests                            |
| Configured or manifest URL is malformed/non-HTTP(S)                   | Refuse with a bounded error and zero CMS requests                       |
| Either URL embeds a username/password, including at a matching origin | Refuse before authentication; never expose native fetch's raw URL error |
| Valid URLs have equivalent HTTP(S) origins                            | Accept existing confirmation and continue ownership preflight           |

### 5. Good / Base / Bad Cases

- Good: classify with the current digest-addressed file UUID, then consistently
  use that UUID for settings, featured cover, and body references.
- Base: reapply the same confirmed schedule without manufacturing new update
  dates or mutating unknown owner records.
- Bad: substitute the returned UUID only into settings, keep a placeholder in
  post bodies, upload a cover to make an ownership preflight pass, or confirm
  origin A while sending any authenticated request to configured origin B.

### 6. Tests Required

- `node tests/launch-apply.mjs` executes the real entrypoint with intercepted
  transport: seeded/fresh UUIDs, zero-write replay, owner/media refusal,
  nonowned fields/sentinels, partial repair, digest, confirmation and target
  origin. Exercise token and login authentication, including credential-bearing
  URLs at matching origins; assert zero requests and
  unchanged state on refusal, and prove equivalent origins/default fallback.
  Keep this in root `pnpm verify` alongside seed regressions.
- The shared client captures its endpoint when the module loads. Isolate
  entrypoint invocations in fresh module graphs when testing different URL
  environments; changing only `process.env` with a cached client can validate
  a different endpoint from the one a real CLI process would use.
- Against a disposable database/uploads clone, test installed and fresh apply,
  compare complete snapshots on replay/refusal, and preserve unknown sentinel
  records. Verify the retained source instance's content digest is unchanged
  after setup, tests, and removal of the temporary clone resources.

### 7. Wrong vs Correct

Wrong: construct all written post payloads with `EDITORIAL_IDS.cover` before
uploading, then replace only `settings.default_og_image`.

Correct: perform read-only ownership preflight first, then build the complete
write payload from the resolved or newly returned identity:

```javascript
const cover = await ensureFile(request, title, folder, type, bytes, filename);
const desired = buildFixturePayloads({ coverId: cover.id, publishedAtMap });
```
