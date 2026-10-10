# Research: Public image delivery without anonymous CMS access

- Query: What is the smallest safe change that resolves public image 403s while Directus custom-permission licensing is explicitly deferred?
- Scope: internal source research; checked dependency source for Next worker/runtime behavior; no live CMS writes or network research.
- Date: 2026-10-10

## Findings

### Recommendation

Materialize only images referenced by the validated public snapshot into a dedicated generated namespace such as `frontend-v2/public/_cms/`, and replace the snapshot's CMS image references with same-origin content-addressed paths. Use the same actual build token for metadata and original-byte requests. Keep Directus Public permissions empty, preserve production Build Reader policy and licensing gates, and keep the runtime credential-free.

The narrow change can stay within the current `loadFromDirectus` boundary: preflight all referenced file metadata, download approved originals with bounds, publish each verified file atomically, then construct/return the public snapshot. A single build entrypoint resets the generated namespace **before** Next starts its workers; workers must never reset that directory. This avoids introducing a second authoring store, a runtime proxy, a global anonymous-file grant, or a media conversion service.

This fixes **site image delivery**, not CMS anonymous access: `https://site/_cms/<digest>.webp` becomes anonymously readable, while `https://cms/assets/<id>` may correctly remain 403 for both public and private originals. AC8's licensed CMS ACL validation remains open.

### Files found

| File | Description / relevance |
| --- | --- |
| `frontend-v2/lib/directus.ts` | Zod decoders, CMS pagination, remote asset URL mapping and snapshot construction; primary integration point. |
| `frontend-v2/lib/content.ts` | Build source selection and process-local snapshot cache; cannot coordinate filesystem cleanup across worker processes. |
| `frontend-v2/lib/env.ts` | Sole V2 environment parser and build credentials; use it for any build wrapper configuration. |
| `frontend-v2/lib/markdown.ts` | Pure client-compatible Markdown utilities; appropriate owner for a shared image-token scanner/rewriter. |
| `frontend-v2/components/MarkdownContent.tsx` | Handwritten Markdown renderer; currently does not convert Markdown images at all. |
| `frontend-v2/lib/types.ts` | Public Post.cover, Post.content, SiteProfile.avatar string fields already support local asset URLs without API changes. |
| `frontend-v2/lib/fixture.selfcheck.mts` | Existing real decoder/snapshot and secret-free failure regression. |
| `frontend-v2/lib/snapshot.check.mts` | Existing fixture path page-facing projection assertions. |
| `frontend-v2/package.json` | `build` currently invokes `next build` directly; place one-time generated-media lifecycle here via a wrapper. |
| `Dockerfile` | BuildKit-only token use and explicit public directory copy into standalone runtime. |
| `.gitignore`, `.dockerignore` | Need an explicit V2 generated-media path exclusion; current `public/_media/` rule is root-relative. |
| `directus/constants.mjs` | Authoritative exact publishable/private folder IDs; reuse publishable ID rather than discovering by name. |
| `directus/bootstrap.mjs` | Existing custom-permission gate, Build Reader file permissions and empty Public policy; do not weaken. |
| `directus/schema.yaml` | Markdown body editor defaults uploads to the private-draft-assets folder. |
| `directus/seed/content.mjs`, `directus/seed/fixtures.mjs` | Real body `directus://` references, optional Markdown titles, and exact committed seed image bytes. |
| `tests/directus.mjs` | Existing metadata type/size/folder assertions; access suite deliberately requires custom permissions. |
| `scripts/test-runtime-image.sh`, `scripts/assert-image-secret-free.sh` | Runtime non-root/readonly and actual build-token image inspection contracts. |
| `deploy/Caddyfile` | Same-origin images already allowed by CSP; no proxy change needed for generated media to work. |

### Current code patterns and defects

- `frontend-v2/lib/directus.ts:150-171` maps cover IDs to `${base}/assets/${id}`. `:263-265` maps non-local avatar IDs the same way. Those anonymous browser reads explain the 403 even when authenticated content loading succeeds.
- `frontend-v2/components/PostCard.tsx:19`, `components/FeaturedPost.tsx:22`, `components/SideLeft.tsx:22`, and `app/archives/[slug]/ArticleClient.tsx:93` / `:203` consume normal `img` URLs. Replacing model strings with same-origin output covers these consumers without changes to each component.
- `frontend-v2/lib/directus.ts:164` currently passes raw Markdown straight through. Seed bodies at `directus/seed/content.mjs:137`, `:240`, and `:532` already contain `![alt](directus://<actual-cover-uuid>)`, including a quoted optional title. Merely fixing cover mapping leaves body images unresolved.
- `frontend-v2/components/MarkdownContent.tsx:92-207` handles code, headings, emphasis, tables and paragraphs, but has **no Markdown image conversion**. The fix must also render supported image syntax. This is a specific existing gap, not evidence that a full Markdown-library migration is necessary.
- `frontend-v2/lib/directus.ts:311-315` requests published article/tutorial rows, but `rawPostSchema` permits draft/archived statuses at `:43` and `buildSnapshot` maps every supplied row at `:213`. Before public-media collection, validate that fetched rows really satisfy the public status/kind contract (reject unexpected rows); do not collect media from all CMS content or the files collection.
- `frontend-v2/lib/content.ts:23-34` caches once **per process**. Checked Next 15.5.23 source `frontend-v2/node_modules/next/dist/build/index.js:303-328` creates multiple isolated static workers (default four). A module promise does not make directory deletion a once-per-build operation.
- `Dockerfile:29-39` already provides the token only inside the build RUN with a BuildKit secret; `:53` copies `frontend-v2/public` explicitly into the runtime. Generated public files need no new runtime service or credential.
- Checked Next 15.5.23 source `frontend-v2/node_modules/next/dist/server/lib/router-utils/filesystem.js:165-169` inventories public files at production startup. Files emitted during the build and copied before runtime startup are served normally.
- `directus/bootstrap.mjs:185-191` refuses unavailable custom rules. `:423-425` already grants production Build Reader access to publishable files only; `:475-478` clears Public permissions. Preserve all three contracts.
- Publishable folder is exactly `11111111-1111-4111-8111-111111111111` (`directus/constants.mjs:3`). Do not accept descendants, a folder named similarly, null folder, or arbitrary folder IDs unless the contract is deliberately changed.
- `directus/schema.yaml:883-896` makes the Markdown editor upload into private folder `22222222-2222-4222-8222-222222222222` by default. A published body can therefore refer to private media by mistake. Refuse the build and require intentional author promotion; never auto-move media.
- Article metadata (`frontend-v2/app/archives/[slug]/page.tsx:25-32`) and root metadata (`app/layout.tsx:19-27`) currently expose title/description only. `site_settings.default_og_image` exists in CMS seed, but V2 does not query or use it. Do not expand unused OG metadata as part of this fix. If metadata gains an image later, it must use the same resolved public-media path.

### Concrete contracts for implementation

#### 1. Reference collection and rewriting

- Collect from public post cover IDs, CMS avatar IDs, and supported rendered Markdown image nodes in public post bodies. Deduplicate file IDs before metadata reads/downloads. Never enumerate and copy all publishable files: unreferenced files remain absent.
- Recognize the existing `directus://<uuid>` form, exact configured-CMS `/assets/<uuid>` absolute URLs, and CMS-relative `/assets/<uuid>` references. Accept an optional cosmetic filename segment only through a deliberate parser; always fetch the canonical original `/assets/<uuid>` endpoint constructed from configured credentials.
- Parse URL origins and path segments, not string prefixes. Reject malformed IDs, path traversal, protocol-relative lookalikes, embedded credentials, and CMS media URLs with token-bearing query parameters. Do not send build credentials to another origin.
- Keep ordinary local source assets such as `/avatar.svg` untouched; do not rehash, rewrite, delete or regenerate the author's source assets. For same-origin local generated paths, permit only the materializer-owned output mapping.
- External non-CMS image URLs are outside this copying scope: do not fetch them with the token. A broader external-image/CSP policy is a separate decision. For unsupported CMS transformation queries or raw-HTML/reference-image syntax, fail with a safe field-level error if it would otherwise leave a broken CMS image; do not silently claim those forms work.
- Use one pure scanner for build-time image collection/rewrite and renderer handling so supported syntax cannot drift. Handle the existing quoted titles. Protect fenced/inline code and escaped syntax: literal `directus://` examples in code are not image requests.
- The renderer must escape generated `src`, `alt`, and `title` attributes and restrict URL schemes; it must not turn an image token into executable markup. Avoid later emphasis/heading transformations corrupting inserted image attributes: placeholders restored after those transformations are one small approach. No browser-side Directus ID resolution or token handling.
- Preserve original editorial fields and derive word count/excerpt from original Markdown, rather than letting a replacement digest length change the article's reading metadata.

#### 2. Metadata before bytes or public emission

- With the **same actual build token** used for posts, read `/files/<id>?fields=id,folder,type,filesize` (optionally dimensions if required). Decode `unknown` with Zod. Existing tests define `filesize` as string-or-number (`tests/directus.mjs:36`, `:284`); accept only a finite positive integer within the configured hard bound, without lossy coercions.
- Require returned ID to equal requested UUID and folder to equal the authoritative publishable ID. Missing, forbidden, malformed, null-folder or private metadata rejects the build. A metadata failure must produce **zero byte requests for that file** and no public output for it; preflight all metadata before any download to make whole-batch refusal easy to prove.
- Never substitute an administrator token when the build token cannot read metadata/bytes. Never infer publicness from a URL, published article relation, filename, guessed UUID or successful byte response alone.
- If strict folder revocation during a running build is required, metadata can change between read and download; recheck after byte retrieval/before emission (using a revision marker where available), or use a stable CMS publication window. No HTTP metadata/bytes pair provides a database transaction. Static media revocation still requires a new deployment, matching existing static text semantics.

#### 3. Safe original-byte acquisition

- Use authenticated GET with an Authorization header, never `access_token` in URLs. Construct metadata and byte requests from one validated HTTP(S) CMS base. Reject URL userinfo/query/hash in build configuration and disallow redirects (`redirect: 'error'`) so a configured or returned redirect cannot forward credentials or change the source boundary.
- Bound metadata and original requests with an abort timeout covering response body consumption. Suggested initial defaults for this small site's raster images: 15 seconds per request, 10 MiB per original, 100 MiB total unique-media bytes per build, and low bounded/sequential concurrency. These are proposed constants, not existing project limits; document the chosen values.
- Check response status, normalized Content-Type, declared Content-Length when present, and actual streamed byte count. Stop reading as soon as the hard byte cap is exceeded; `arrayBuffer()` followed by a size check alone is not a memory bound. Require actual bytes to agree with metadata filesize for an unchanged original.
- Use a small raster allowlist matching current assets (JPEG, PNG, WebP, optionally GIF/AVIF with a proper signature check). Refuse SVG/HTML/XML and unknown types rather than publishing active content at the site origin; authored local `/avatar.svg` is unaffected. Check basic raster magic against declared type so a spoofed Content-Type is not enough.
- Compute full SHA-256 from verified bytes. Use only lowercase digest plus a constant extension selected by verified MIME, for example `/_cms/<64-hex>.webp`. Never use `filename_download`, title or URL segments as output filesystem paths. Different CMS IDs with identical bytes may safely share one content path; changed bytes require a new path.
- Errors name operation/record ID/field only. Wrap underlying fetch, parser and SDK errors without `cause` carrying a token, header, full URL, body or raw response. Preserve the existing generic secret-free error boundary (`frontend-v2/lib/directus.ts:352-355`) or add safe operation codes within it.

#### 4. Generated-directory lifecycle and worker safety

- Introduce a single controlled build wrapper, e.g. `frontend-v2/lib/build.mts`, and change package `build` to invoke it. It cleans only its fixed dedicated namespace before spawning Next, including fixture builds; Directus-to-fixture and CMS rebuilds then cannot retain deleted/private/unreferenced files from the previous build. Run the same startup reset for supported dev flows, or explicitly document Directus dev lifecycle limitations.
- Resolve the namespace from the frontend package root, not an arbitrary shell working directory or authored filename. Assert that it is the exact owned path before cleanup. Refuse a symlinked namespace rather than following it outside public. Never clean `public/`, `avatar.*`, or general source assets. Do not create cleanup scope from environment input.
- Each worker writes verified bytes to a unique temporary sibling/outside-public staging path, closes them, then atomically renames to the full digest path. Competing workers can safely publish the same verified immutable bytes. Do not truncate the final path or let temporary downloads become discoverable public files. Clean temporary files in `finally`; clean the generated namespace if the overall build fails.
- No worker deletes/reset directories. Do not rely on a module-local cache for cross-process exclusivity. Concurrent independent builds sharing one checkout should be rejected/serialized by the wrapper or use isolated output roots; they otherwise can delete each other's media.
- Add explicit `frontend-v2/public/_cms/` ignores to Git and Docker context (and any staging path). `.gitignore:12` currently has `public/_media/`, which covers root public rather than nested V2 public. The Docker build generates media inside the build stage; exclude workstation output from its input context to prevent stale ingestion.
- Reuse `Dockerfile:53` public copy. Runtime writes and CMS requests are forbidden. Inspect the exact successful image/token, not a prior image or unused random marker. A generated manifest, if useful, contains only public IDs/digests/paths and no credentials; no new public snapshot JSON is needed for this narrow solution.

### Suggested affected files

1. Add `frontend-v2/lib/media.ts` for typed metadata validation, public-media reference resolution and bounded authenticated materialization; keep Node-only filesystem/crypto code out of client imports.
2. Change `frontend-v2/lib/directus.ts` at the post-fetch/snapshot boundary and replace remote cover/avatar/body mappings with resolved paths. Reuse the authoritative folder ID from `directus/constants.mjs` through a typed import if practical; do not duplicate a name-based folder lookup.
3. Extend pure `frontend-v2/lib/markdown.ts` (or one small pure sibling) with shared supported image syntax and escaping; change `components/MarkdownContent.tsx` to render those resolved image nodes.
4. Add one build lifecycle wrapper and update `frontend-v2/package.json`; use existing `lib/env.ts` for configuration (optional HTTP(S)/userinfo tightening belongs there). Add the explicit generated path to `.gitignore` and `.dockerignore`.
5. Add a focused real-media-path selfcheck with mocked/local HTTP responses and temporary directories; wire into existing selfcheck/verify. Extend existing image smoke checks with generated-file byte/MIME assertions and unknown/private absence if useful.
6. Update `frontend-v2/README.md`, relevant deployment/image documentation and frontend/backend specs to describe same-origin generated image delivery and rebuilt-snapshot revocation. Main session owns task/spec edits; this research agent only writes this note.

`directus/bootstrap.mjs`, production permissions, schema/content writes, and public CMS ACLs need no product change for this solution. Caddy already permits same-origin images at `deploy/Caddyfile:38`; removing the old CMS image CSP allowance can be a separately reviewed tightening, not a prerequisite.

### Test matrix

| Case | Required evidence |
| --- | --- |
| Public cover/avatar/body refer to same file | One ID materialized per loader; local model URLs; Markdown image and optional title render; downloaded digest equals emitted bytes. |
| `directus://`, absolute configured CMS asset URL, relative `/assets/` | All supported forms resolve to canonical authenticated requests and same local file. |
| Private/null/wrong folder metadata | Build fails before that file's byte request; no private bytes or filename emitted. Test a broad synthetic token that *could* download private bytes to prove local refusal. |
| Missing/403 metadata or asset GET | Directus build fails without fixture fallback or credential echo. |
| Spoofed/unsupported MIME or signature; size mismatch | No final public asset; bounded safe failure. |
| Missing Content-Length plus oversized stream | Abort at streaming cap, not after unbounded allocation. |
| Slow header/body; redirect; external lookalike origin | Timeout/refusal; token never sent to external location; error remains secret-free. |
| Code block/inline code containing image-looking text | No metadata/byte request and literal code preserved. |
| Markdown alt/title containing quotes/HTML | Escaped rendered attributes; no injected event handler or active scheme. |
| Unreferenced publishable media | Not queried/downloaded/emitted. |
| Draft/archived/note media | Absent from collection/output, or unexpected returned post fails the public-row boundary. |
| Two Next-like workers request same image | Atomic final digest file, correct bytes, no leftovers; neither worker clears the other's output. |
| Successful build A then CMS removes/moves image for B | B output omits A-only digest; moved-private reference fails and leaves no completed B media artifact. |
| Directus build followed by offline fixture build | Generated namespace empty, authored avatar assets unchanged, fixture needs no token/CMS network. |
| Network-disabled readonly standalone image | Anonymous site cover/body path 200 with correct MIME/digest; private/unreferenced URL 404; all CMS environments absent. |
| Successful actual-token image inspection | Exact consumed token absent in history/config/layers/runtime; no token URL in HTML/Flight/JS/generated media. |
| Anonymous CMS originals remain denied | Confirm no anonymous/global policy changed; do not require CMS public-original 200 after choosing static delivery. |

### Related specs

- `.trellis/spec/frontend/type-safety.md`: one validated build snapshot, no Directus fallback, sole environment owner, no runtime credential.
- `.trellis/spec/frontend/directory-structure.md`: content boundary and explicit public-assets ownership.
- `.trellis/spec/frontend/quality-guidelines.md`: real decoder selfchecks and appropriate full-root gate.
- `.trellis/spec/backend/database-guidelines.md`: immutable seed media and no original-byte regeneration/overwrite. Its current remote URL mapping paragraph must change when implementation changes.
- `.trellis/spec/backend/error-handling.md` and `logging-guidelines.md`: bounded secret-free diagnostics.
- `.trellis/spec/backend/quality-guidelines.md:97-110`: current anonymous-original acceptance is specific to the old remote-URL delivery. Update it to require site-public bytes and CMS/private refusal for the selected static-media architecture; retain the separate custom-ACL gate.
- `.trellis/spec/guides/cross-layer-thinking-guide.md` and `code-reuse-thinking-guide.md`: trace CMS → snapshot → public files → Docker → runtime/browser; shared parser, no duplicated normalization.

### External references and versions

- Project pins Directus 12.2.0 / PostgreSQL 17.9 (`.trellis/spec/backend/database-guidelines.md`); no new external dependency is needed.
- `pnpm-lock.yaml:47-49` resolves Next **15.5.23**, despite package.json's `^15.1.7`; worker/runtime claims above cite installed 15.5.23 source.
- Installed `@directus/sdk` is **24.0.0** (`node_modules/.pnpm/@directus+sdk@24.0.0/node_modules/@directus/sdk/package.json`); keep existing SDK content fetching, use controlled authenticated original fetch for bytes.
- Root package/Docker uses Node **24.15.0** and pnpm **9.15.9**; standard `fetch`, AbortController/AbortSignal, crypto SHA-256 and fs rename are available.
- Useful implementation references (not fetched for this research): Node file-system `rename`/`writeFile` docs <https://nodejs.org/api/fs.html>, AbortSignal docs <https://nodejs.org/api/globals.html#class-abortsignal>, Next public folder docs <https://nextjs.org/docs/app/api-reference/file-conventions/public-folder>. Installed source is the authority for Next details in this note.

## Caveats / Not Found

- Research performed no live API requests, permission mutations, uploads, schema changes, Docker builds or Git operations. Existing instance observations are task-record evidence, not new verification.
- The retained Core test identity currently lacks assets permissions (`validation.md:63-67`). It cannot validate the new positive path without a suitable *separate synthetic read identity* or explicitly suitable existing build credential. Never silently replace it with admin. A narrow isolated Core basic read-only file identity can exercise transport/local folder refusal, but broad Core permissions **do not establish production status/field/folder ACL security**.
- User explicitly deferred licensing. This solution avoids needing anonymous custom file rules for browser delivery; it does not make production Build Reader's scoped permissions available on Core or complete AC8. No code workaround should claim otherwise.
- Existing CMS author image upload defaults private. Publishing an article is not permission to publish all of its private folder content; reject and require deliberate media promotion.
- Full SVG sanitization, image resizing/transform URLs, raw HTML images, reference-style Markdown images, arbitrary remote CDN migration, and Open Graph schema expansion are not required by the checked seed examples. If real content relies on one, identify it before selecting support/refusal behavior.
- Metadata-folder changes during a build and already-deployed static files require explicit publication consistency/rebuild semantics; local filesystem atomic rename alone cannot provide CMS transaction isolation or retroactive removal from an old image.
