# Frontend Type Safety

`frontend-v2/tsconfig.json` is strict and uses `noUncheckedIndexedAccess`.
Pass `pnpm --filter frontend-v2 typecheck` without `any`, unchecked casts, or a
second hand-written copy of a CMS response type.

## Scenario: Build-Time Content Snapshot Boundary

### 1. Scope / Trigger

Apply this contract when changing a build environment key, Directus field,
fixture row, public content type, or static article route. The same snapshot
must predict both offline fixture builds and published Directus builds.

### 2. Signatures

```ts
readBuildEnvironment(input?: NodeJS.ProcessEnv):
  | { source: "fixture" }
  | { source: "directus"; directus: { url: string; token: string } };

loadFromDirectus(credentials: DirectusCredentials): Promise<ContentSnapshot>;
buildSnapshot(rows, baseUrl, media?: PublicMediaMap): ContentSnapshot;
```

`lib/env.ts` is the sole V2 owner of `process.env`. `lib/directus.ts` owns the
Zod response schemas and source-to-view-model mapping. `lib/content.ts` owns
the cached source selection and page-facing selectors.

### 3. Contracts

- An absent or empty `CONTENT_SOURCE` means `fixture`; no CMS value is needed.
- `CONTENT_SOURCE=directus` requires a valid `DIRECTUS_URL` and a
  `DIRECTUS_BUILD_TOKEN` of at least 24 characters. URLs must be HTTP(S) without userinfo, query or fragment; normalize
  trailing slashes. Configuration errors name fields, never supplied values.
- Directus mode fetches only published `article` and `tutorial` rows. Any
  request, decode, or snapshot failure rejects the build; it never switches to
  fixture after directus mode was selected.
- Raw rows are decoded from `unknown`. Article bodies must be non-empty and
  timestamps used for sorting must be offset ISO timestamps.
- The public `ContentSnapshot` exposes posts, categories, tags, series, and a
  profile. CMS notes, topics, `posts_topics`, and RSS links are deliberately
  not V2 view-model fields.
- The standalone runtime receives no source-selection, Directus URL, or
  credential environment variable. It serves the prebuilt snapshot only.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| No source or `CONTENT_SOURCE=fixture` | Offline fixture snapshot builds successfully |
| Unknown `CONTENT_SOURCE` | `readBuildEnvironment` throws before content loading |
| Directus source missing URL or token | Build fails and names invalid fields without values |
| Directus URL/token malformed | Build fails before a fetch |
| Directus request or Zod decode fails | Build fails; do not substitute fixture data |
| Null/empty body or invalid publication timestamp | Row is rejected by the decoder |
| Published note/topic data exists in CMS | It remains in CMS but is absent from V2 snapshot |

### 5. Good / Base / Bad Cases

- Good: a fixture build runs without any Directus variable, while a CI image
  build mounts a Build Reader token only for `CONTENT_SOURCE=directus`.
- Base: a complete Directus response maps into exactly the same ordered public
  shape as an equivalent fixture.
- Bad: catching a Directus fetch error in `content.ts` and silently returning
  fixture data, or reading `process.env` from a page/component.

### 6. Tests Required

- `lib/fixture.selfcheck.mts` proves fixture ordering, decoded fields, rejected
  invalid rows, and build-environment error cases.
- `lib/snapshot.check.mts` proves page-facing projections contain posts and
  surviving taxonomy/profile fields only.
- `pnpm --filter frontend-v2 build` proves routes can render from the actual
  snapshot path. A directus-mode smoke test must assert missing credentials and
  a failed endpoint both fail the build.
- Route verification must assert a known archive page is 200, a known writing
  page is a 308 redirect, and unknown writing/note paths are 404.

### 7. Wrong vs Correct

#### Wrong

```ts
const snapshot = await loadFromDirectus().catch(() => buildSnapshot(FIXTURE_ROWS, ""));
```

#### Correct

```ts
const environment = readBuildEnvironment();
const snapshot = environment.source === "fixture"
  ? buildSnapshot(FIXTURE_ROWS, "")
  : await loadFromDirectus(environment.directus);
```

The correct form makes a typo or outage observable during the published build
instead of shipping the wrong content silently.

## Static Route Types

Use `params: Promise<{ slug: string }>` in current App Router dynamic pages.
Generate params from `getAllPosts()` and set `dynamicParams = false` when a
route must reject unknown values. A legacy redirect resolves the post first and
uses `permanentRedirect`; it must not interpolate an unvalidated pathname.


## Scenario: Build-Time Public Raster Images

### 1. Scope / Trigger

Apply when changing CMS image references, Markdown image rendering, snapshot
materialization or frontend build/dev lifecycle. Browser-facing CMS images must
be usable without a runtime token or anonymous CMS permission.

### 2. Signatures

```ts
loadFromDirectus(credentials: DirectusCredentials, mediaOptions?: MediaOptions): Promise<ContentSnapshot>;
mapMarkdownImages(markdown: string, replace: (image: MarkdownImage) => string): string;
withMarkdownImageSource(image: MarkdownImage, source: string): string;
```

`MarkdownImage` includes raw token, source, alt, optional title and source
indices within the raw token. `pnpm --filter frontend-v2 build` / `dev` invoke
the one-time lifecycle wrapper; do not call Next directly.

### 3. Contracts

- Reject unexpectedly unpublished/non-article rows returned by the server
  before collecting media; the API filter alone is insufficient validation.
- Only cover/avatar and supported body image references enter the media set.
  Deduplicate IDs, never enumerate all files. Keep authored local assets and
  external HTTP(S) images; never send credentials to external images.
- Accept inline `![alt](directus://<uuid> "title")`, configured-CMS absolute
  `/assets/<uuid>` and relative `/assets/<uuid>`. Reject token/query/transform
  CMS URLs and unsupported CMS HTML/reference images. Protect fenced/inline
  code and escaped examples. Renderer and exporter share the same scanner.
- With the actual build token, validate `/files/<id>` metadata for every
  reference before any bytes: exact ID and publishable folder, raster MIME,
  positive integral size (string or number). Recheck after downloads before
  emission. No public inference from a relation, filename or successful GET.
- GET canonical originals with Authorization header, redirects disabled,
  15-second timeout covering body reads, 20 MiB per file and 100 MiB per unique
  set. Validate streamed length, metadata length, Content-Type and raster magic.
  JPEG/PNG/WebP/GIF/AVIF only; refuse active SVG/HTML/XML from CMS.
- Use full lowercase SHA-256 plus MIME-selected extension for `/_cms/` names.
  Never use editorial filenames as filesystem paths. Publish verified bytes
  atomically from staging outside public; concurrent workers do not reset output.
- Only the wrapper resets the exact owned namespace before build/dev and after
  failure, fixture included. Refuse symlinked owned paths and simultaneous
  wrappers in one checkout; never remove authored assets.
- Preserve summary/word count/reading minutes derived from the original body;
  substitute local URLs in the public content only. Escape image attributes
  and restore rendered images after other Markdown transformations.
- Errors stay bounded and secret-free. No fixture fallback, runtime token,
  public policy weakening, or automatic private-file promotion. Static image
  revocation requires rebuilding and deploying, as for article text.

### 4. Validation & Error Matrix

| Input/state | Result |
| --- | --- |
| Same image in cover/avatar/body | One ID download per loader, same digest path |
| Private/null/wrong-folder/missing metadata | Build fails before byte downloads |
| Redirect, timeout, oversized bytes or MIME/signature/size mismatch | Build fails, no final asset for rejected batch |
| Fenced/inline/escaped image example | Literal code; no CMS image fetch |
| CMS raw HTML/reference/transformation image | Safe build failure requiring supported syntax |
| Fixture build after Directus build | Generated namespace empty; authored assets retained |
| Two workers export same valid image | Atomic exact immutable file; no temporary public output |
| Two wrappers in one checkout | Second wrapper refuses without deleting first output |

### 5. Good/Base/Bad Cases

- Good: a referenced publishable WebP becomes a same-site image served from an
  offline read-only image with exact original bytes.
- Base: fixture/local avatar assets render without CMS requests.
- Bad: mapping every CMS file to a public path, downloading a private upload
  because its post is published, or resetting output from each static worker.

### 6. Tests Required

- Real loader mapping: cover/avatar/body, exact byte digest, dedup, preserved
  reading metadata, unpublished row refusal and no unreferenced queries.
- Broad synthetic reader still cannot export private metadata; all metadata
  preflight precedes bytes. Test malformed type/size/redirect/timeout/stream.
- Shared scanner and real React renderer: optional titles, escaped attributes,
  safe schemes, code literals and unchanged local/external references.
- Lifecycle and concurrent publication: stale cleanup, fixture reset, failure
  cleanup, lock refusal, symlink refusal and unchanged authored assets.
- Actual Directus-token Docker build: exact secret absent from layers/config/
  history/runtime; network-none readonly site image 200 + original digest/MIME,
  private/unreferenced absence404 and CMS originals still anonymously denied.

### 7. Wrong vs Correct

Wrong: expose `<CMS>/assets/<id>` to anonymous browsers or copy bytes before
checking file publicness.

Correct: `loadFromDirectus` validates referenced metadata with its build token,
materializes original public bytes and returns `/_cms/<sha256>.webp`; the
runtime serves static files without contacting CMS.
