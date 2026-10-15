# Typed runtime content boundary

## 1. Scope / Trigger

Shared field, response, env or route-data changes. Both apps use strict TypeScript
and noUncheckedIndexedAccess. Parse unknown; avoid casts/duplicate response types.

## 2. Signatures

- readRuntimeEnvironment: fixture with siteUrl OR cms with url/token/siteUrl.
- readPublished<T>(path, schema): Promise<T>.
- snapshot(): Promise<PublicCatalog>; getPostDetail(slug): detail OR null.
- @blog/content-contracts owns draft/admin/post/summary/catalog/profile/media/publication schemas and inferred types.

## 3. Contracts

Production defaults to cms; development to fixture. CMS mode requires root-path,
credential-free HTTP(S) CMS_INTERNAL_URL and CMS_READ_TOKEN >=32 chars. Unknown
modes fail, errors name keys not values. Build needs no CMS env. Retired build-time environment parsers and SDK adapters are removed. Explicit
fixture mode remains offline; the projector has no remote asset/download dependency.

Production CMS also requires SITE_URL: a credential-free root HTTP(S) origin,
without path/query/fragment. Normalize origins once at this boundary; development
and explicit fixture mode default to http://localhost:4321. Never derive metadata
origins from Host/forwarded headers. Compose production uses https://${SITE_DOMAIN},
local/dev overlays explicitly use localhost. Errors reveal keys only.

Catalog includes generation/profile/published article+ tutorial summaries/used
taxonomy. PostSummary excludes body. Detail contains generation/canonicalSlug/post.
Admin responses carry exact draftRevisionId/version. Parse server/client/browser
generation boundaries with shared schemas. No token in browser props.

Summaries drive list/nav/search/related content; detail/metadata share request-local
load. No full bodies in site root or search, no mixing draft fields into public
posts, no note/topic projection. Shared-field changes must agree across revision,
editor/preview, export/import and public consumers.
Save: {version, draft}; publish: {version, revisionId, key}.

## 4. Validation & Error Matrix

| Input | Result |
| --- | --- |
| Invalid runtime config | Bounded failure, no fallback |
| Public detail404 | null → notFound |
| Other failure/timeout/malformed payload | ContentUnavailable →503 |
| Invalid draft/profile/taxonomy | API422, local text retained |
| Stale save/publish | 409 |
| Unpublished draft edit | Published snapshot unchanged |

## 5. Good / Base / Bad Cases

- Good: infer new fields from Zod, trace their full data path.
- Base: deliberately selected fixtures validate through shared public schemas.
- Bad: raw rows in JSX, credentials in props, body in summary, unchecked as Post.

## 6. Tests Required

Typecheck both apps/shared modules. Exercise real catalog/detail and DB projection;
assert no bodies/drafts/private media. Test runtime config,404 vs503, Markdown
sanitization/anchors and production-process new-slug publication.

## 7. Wrong vs Correct

Wrong: `await response.json() as Post`.
Correct: `publicDetailSchema.parse(await response.json())`, pass only needed view models.
