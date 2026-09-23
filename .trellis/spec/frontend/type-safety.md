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
buildSnapshot(rows, baseUrl): ContentSnapshot;
```

`lib/env.ts` is the sole V2 owner of `process.env`. `lib/directus.ts` owns the
Zod response schemas and source-to-view-model mapping. `lib/content.ts` owns
the cached source selection and page-facing selectors.

### 3. Contracts

- An absent or empty `CONTENT_SOURCE` means `fixture`; no CMS value is needed.
- `CONTENT_SOURCE=directus` requires a valid `DIRECTUS_URL` and a
  `DIRECTUS_BUILD_TOKEN` of at least 24 characters. URLs are normalized by
  removing one trailing slash. Configuration errors name fields, never tokens.
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
