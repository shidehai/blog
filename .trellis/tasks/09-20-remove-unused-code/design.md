# 技术设计：V2 残留清理与运行时收敛

## 1. Scope and boundaries

This is one integrated cleanup rather than separate feature work: the missing
article route is the consumer that makes the retained content/Markdown code
valid again; removing preview changes the Docker, Compose, Caddy, Directus and
test contracts together.

The live boundaries after this work are:

```text
Directus published records
  -> build-only V2 Directus decoder
  -> ContentSnapshot / static App Router routes
  -> Next standalone image
  -> Caddy public proxy

Fixture rows
  -> same decoder and ContentSnapshot
  -> local/CI fixture build only
```

Directus remains the authority for articles, notes, topics, taxonomy, media,
revisions and authoring. V2 consumes only the public article projection it
renders. Removing a V2 projection does not alter the CMS collection, seed,
data, database constraint or author permission.

## 2. V2 content and route contract

### 2.1 Build source selection

frontend-v2/lib/env.ts remains the sole V2 owner of environment parsing. It
will distinguish two build-time modes:

| Mode              | Required values                                       | Result                                                                                               |
| ----------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| fixture (default) | none                                                  | Build from the checked offline fixture                                                               |
| directus          | DIRECTUS_URL and a 24+ character DIRECTUS_BUILD_TOKEN | Fetch and validate published CMS content; any invalid credential or request failure aborts the build |

CONTENT_SOURCE is available to the build stage only. The runtime standalone
server receives neither source-selection nor Directus credentials because all
public pages are built from the snapshot. This removes the former accidental
runtime-preview interpretation of those variables.

The Directus decoder will retain only the CMS fields V2 maps into Post,
Category, Tag, Series and SiteProfile. It will no longer request, decode or
return topics/posts_topics. The Build Reader policy will be narrowed to that
same query surface. Author-facing topics, notes and their joins remain intact.

The local V2 fixture will retain only entries which can enter the public
snapshot. Its existing user avatar modification stays unchanged. The selfchecks
will assert post/taxonomy/profile invariants rather than removed note/topic
indexes, and will cover fixture-versus-Directus mode failure behavior.

RSS has no V2 route, so rss is removed from the frontend SiteProfile projection,
the fixture/mock mapping, Footer and the article action. Existing Directus
social-link data is not deleted.

### 2.2 Article route and compatibility

The restored canonical page lives at:

```text
app/archives/[slug]/page.tsx
  generateStaticParams() -> current published posts
  generateMetadata() -> post title/summary
  page() -> notFound() for an absent post
          -> ArticleClient for a present post

app/writing/[slug]/page.tsx
  generateStaticParams() -> same current published posts
  page() -> permanentRedirect(/archives/[slug])
```

Both routes use static params and disallow unmatched params, so the redirect is
never an open catch-all. There is intentionally no app/writing/page.tsx and no
notes route. Therefore /writing, an unknown legacy slug and any /notes path
remain Next 404s.

ArticleClient will be restored under the canonical archives route and adapted
instead of copied unchanged:

- canonical links for related and adjacent posts use /archives;
- its table-of-contents scroll spy reuses extractHeadings;
- MarkdownContent remains the sole owner of code-copy button injection, so the
  duplicate client-side code-button effect is not restored;
- stale RSS action is removed;
- page data uses the existing getPostBySlug, getNavigationPosts and
  getAllPosts helpers.

This gives MarkdownContent, getPostBySlug, getNavigationPosts and
extractHeadings real route consumers without reintroducing writing, notes or
topics as separate content types.

### 2.3 Client styling cleanup

Tailwind has no root directive and currently emits none of the utility classes
found in JSX. Removing Tailwind safely requires replacing only those inert
utility strings with semantic project class names and implementing their
equivalent rules in globals.css:

- CommandMenu keeps its overlay, keyboard-search, selection and responsive
  layout through command-menu-* classes.
- ProjectCard and /projects keep their grid/card/metadata presentation through
  project-* classes.
- Root layout drops the inert font/anti-alias utility names because the global
  stylesheet already owns those rules.
- The unreferenced CategoriesClient is deleted, along with its active-only
  selector. The current server categories page and its [slug] page remain.

tailwind.config.ts, postcss.config.mjs, Tailwind/typography/autoprefixer/PostCSS
development dependencies and their lockfile entries are removed after no
remaining source relies on them. Navbar stops toggling the .dark class solely
for Tailwind; data-theme remains the actual theme contract. next.config.ts
keeps the standalone/react-strict settings but drops unused next/image remote
patterns.

## 3. Container and proxy contract

### 3.1 Image lifecycle

```text
CI Directus URL + BuildKit secret
  -> Docker build stage, DIRECTUS mode
  -> Next static output
  -> standalone runtime image (no Directus credential)
  -> node user on port 4321
  -> /healthz and public pages
```

The Dockerfile gains a development stage, so compose.dev.yaml no longer points
at a non-existent target. It exposes the V2 dev server on 4321. The build stage
declares its source mode and URL as build-only arguments and reads the token
from a BuildKit secret mount. Directus mode explicitly rejects a missing secret
before invoking Next; the V2 boundary rejects invalid/failed CMS reads instead
of silently substituting fixtures.

The runtime stage copies only the standalone output, static assets and public
assets with node ownership; it sets PORT=4321, uses USER node, exposes 4321 and
owns a Docker HTTP healthcheck. A small app/healthz/route.ts returns a
non-cacheable success response. The runtime has no writable application path
and needs no CMS environment.

### 3.2 Compose and Caddy

Production Compose retains Caddy, Directus, PostgreSQL and operational jobs,
but site no longer receives CONTENT_SOURCE, DIRECTUS_URL,
DIRECTUS_PREVIEW_TOKEN, PREVIEW_TRUSTED_HEADER or SITE_URL at runtime.
Development Compose passes only build-time/direct-local CMS values when
explicitly requested and starts the restored development target on localhost 4321.

Caddy removes the /preview handler, Basic Auth variables and trusted-header
injection. Its public cache rules change from Astro paths to /_next/static/*.
The public CSP becomes a Next-compatible allow-list: same-origin external
assets and Next's required inline hydration scripts are allowed, with known CMS
assets explicitly allowed when they are emitted in the static snapshot. Stale
Astro inline hash values and the deleted hash-verification command are removed.

This is a deliberate compatibility trade-off: static Next App Router output
contains per-page inline React Flight bootstrap scripts that cannot be covered
by the old fixed Astro hash set. Keeping the old hashes would leave interactive
V2 UI broken. The policy remains source-scoped and keeps object/base/frame
restrictions.

## 4. Directus preview retirement

The Posts schema metadata changes preview_url from its V1 URL to null. The
bootstrap reconciler removes active preview declarations:

1. clear permissions and access records tied to the known legacy Preview Reader
   policy;
2. remove only the old managed service user, role and policy by their fixed
   bootstrap IDs;
3. treat an absent retired resource as a successful no-op;
4. retain author, administrator, Build Reader, folders, private draft assets,
   revisions and all content records.

The exact-ID tombstone is intentionally kept in bootstrap as a migration
mechanism, not as a live preview feature. It prevents a broad name-based delete
from touching user-owned CMS identities. Tests assert that the schema has no
preview URL and no active preview policy/user remains after bootstrap.

The previous Preview Reader token is deliberately revoked. Rolling back code
alone will not restore preview access; that would require a consciously
recreated service identity from a reviewed backup, which matches the user's
decision to retire the feature.

## 5. Documentation and spec alignment

Documentation will be updated, not blindly deleted:

- root and V2 READMEs describe the Next V2 app, current routes, local fixture
  use and Directus-backed production builds;
- operations guides describe the build-only CMS credential, 4321 health
  contract, Next asset cache/CSP policy and no preview recovery procedure;
- Directus documentation describes Build Reader and keeps its CMS/data
  authority;
- Trellis frontend/backend specs are revised after implementation to describe
  the verified V2 directory, quality and infrastructure contracts.

Seed prose is not mass-rewritten. /writing links are protected by the
compatibility route; /notes links remain deliberately unresolved.

## 6. Rollout and rollback

Local implementation only changes repository state. A production operator must
first retain the normal database backup, then apply the reviewed schema and run
the bootstrap once to revoke the legacy preview identity, and deploy the new
image/Compose/Caddy set. The public content model is not migrated.

Before bootstrap, ordinary code/config changes can be reverted as one commit.
After bootstrap has removed the Preview Reader, rollback of that retired
feature requires an explicit identity recreation rather than an automatic
database/content restore. The canonical article route and writing redirect are
otherwise independently reversible through the image rollback process.

## 7. Launch target confirmation follow-up (2026-10-10)

The user approved closing the recorded gap between the manifest's confirmed
origin and the independently configured Directus endpoint. This change lives
in `directus/launch.mjs` before `adminClient()`, because authentication itself
must never reach an unconfirmed endpoint.

- Preserve the version-1 manifest, digest and `CONFIRM_LAUNCH_<digest>_FOR_<origin>`
  format. Validate the digest, target URL/origin and explicit confirmation before
  authentication or any CMS read/write.
- Derive the effective endpoint from the same `DIRECTUS_URL` and loopback
  default as the existing client. Compare normalized HTTP(S) origins (scheme,
  hostname and effective port); equivalent case/default-port/trailing-slash
  spellings must not create false mismatches. URL paths are outside the existing
  origin confirmation contract.
- Invalid/non-HTTP(S) URLs and mismatched origins fail with a bounded diagnostic
  that does not echo credentials or full configured URLs. Do not add a switch
  that bypasses this check or rewrite the manifest to match the environment.
- Reject embedded URL username/password values before requests; native fetch
  rejects such URLs and would otherwise include their credentials in errors.
- Keep the change to the launch entrypoint and its existing offline entrypoint
  regression. Do not change the shared Directus client, seed ownership, CMS data,
  license gates or production configuration.
- Regression cases must count every intercepted request, including login, and
  assert zero requests and unchanged state on refusal. Valid equivalent origins
  retain existing generated-UUID, replay and owner-preservation behavior.

The retained Core instance cannot complete AC8 without an issued entitlement.
The user confirmed no license is currently available; this follow-up does not
alter that acceptance criterion or its recorded status.

## 8. Legacy fixture ownership follow-up (2026-10-10)

Full-scope review reproduced an overwrite of an owner-edited legacy fixture
body in both launch and confirmed partial seed repair. The user approved
protecting those records while retaining recognizable original migration.

- The four enumerated legacy IDs and current archived targets stay unchanged.
  Record immutable original payloads from `29d5d85^:directus/seed/index.mjs` in
  the existing content owner module. The first three original rows were
  published, the fourth archived; preserve their original titles, slugs,
  summaries, bodies and other owned fields. Resolve the original cover/body
  media reference using the actual digest-addressed uploaded UUID, never by
  guessing an unrelated owner's media.
- Both entrypoints classify each legacy row against its exact historical
  original and exact current archived target using `POST_OWNED_FIELDS`, before
  file operations, canonical writes, cleanup or any other mutation. Absent
  legacy IDs may receive their existing archived fixture target.
- Any edited/unrecognized owned field refuses the entire operation before
  mutation. Do not archive only by ID, loosen ownership to slug/title, preserve
  an arbitrary edited body while changing its publication state, or overwrite
  it as a migration shortcut.
- Seed's mutation-needed decision includes missing legacy rows and exact
  historical rows requiring migration; its no-write early return comes only
  after all legacy ownership checks. Fully matching archived rows stay no-op.
- Keep historical baseline definitions in `directus/seed/content.mjs` and
  reuse them from seed/launch. Add entrypoint regressions to the existing seed
  and launch tests; do not add a second migration framework or modify live CMS
  data to prove the offline refusal cases.
- Tests cover recognized originals, exact archived replay, missing legacy-only
  repair and owner edits both with a complete canonical fixture and a partial
  fixture that would otherwise start mutation. Compare complete state and all
  original timestamps when asserting refusal or no-op.


## 8. Public media build delivery (R15)

The behavior gap lives at the Directus snapshot boundary: browser-facing cover/avatar URLs currently target denied anonymous CMS originals, and Markdown body image syntax is not rendered. Fetch only images referenced by validated published article/tutorial rows and the public profile, validate exact `IDS.folders.publishable` metadata using the actual build token, then materialize original raster bytes into `frontend-v2/public/_cms/<sha256>.<ext>`. Map cover/avatar/body references to those local paths; derive excerpt/reading metadata from the original body. Leave local authored assets and ordinary external images intact. Do not change CMS data, Public policy, production Build Reader, license gates or runtime credentials.

One pure Markdown image scanner/mapper is shared by the renderer and materializer; support inline images with optional quoted titles, protect fenced/inline code and escaped image examples. Render escaped image attributes after other Markdown transformations. CMS references accept UUID IDs via `directus://`, configured-origin `/assets/` URLs and relative `/assets/`; unsupported CMS query/transform/raw HTML/reference-image forms fail safely.

Preflight every unique file before downloading bytes; require returned ID, exact publishable folder, positive integral size and raster MIME. Use authenticated same-base original requests, reject redirects, validate signature, MIME and actual size; cap each original at 20 MiB, total unique bytes at 100 MiB and each request at 15 seconds. SVG uploads are outside the generated raster contract (authored `/avatar.svg` remains intact). Recheck metadata after downloads before emission to catch publication changes; a new deployment is still required to revoke already-deployed static content. Never report raw URLs, credentials or transport/parser errors.

A single frontend build/dev wrapper owns reset of only the fixed `_cms` namespace before Next workers start, plus serialization of builds in one checkout. Workers only write unique staging files outside public and atomically rename verified immutable digest files. Reset output after a failed build; fixture builds clear earlier generated CMS assets. Add explicit Git/Docker context ignores. Existing Docker public copy carries generated files into the offline non-root runtime.

Implementation boundary: media helper + Directus integration/env validation; shared Markdown scanner + minimal image rendering; wrapper/package/ignores; focused regressions and operational documentation. No general renderer rewrite, SVG sanitizer, image transformations, unused OG fields, runtime proxy or permission weakening.
