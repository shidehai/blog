# Runtime freshness and image delivery

## 1. Scope / Trigger

Public fetch/cache/layout/navigation/article/media changes. Publishing must work
in an already-built site.

## 2. Signatures

- CMS GET /api/public/catalog|generation|posts/:slug: server-only bearer token.
- Site GET /api/content-generation: {generation}, no-store, no token exposure.
- ContentFreshness({generation}): pathname/focus/popstate/pageshow/visibility checks.
- CMS/site GET /media/:uuid: only current allowed publication media.
- pageMetadata(input), sitemapEntries(catalog, siteUrl): configured absolute public URLs.

## 3. Contracts

Fetch with no-store and timeout. React cache deduplicates within one request/render
only: no module Promise, cross-request catalog or static slug restriction. Dynamic
content and Caddy no-store exclude /_next/static fingerprinted assets.

On navigation/history/pageshow/focus, validate generation. Changed generation
reloads the document. Soft router.refresh can retain a Next not-found boundary
while updating metadata: verify visible body, not just head/title. Avoid concurrent
checks/reload loops. Failed checks show reconnect; cached state is not confirmed
fresh. No continuous polling/push while readers stay idle.

Proxy media only to configured CMS. Owner preview resolves media through private
authenticated endpoints; public same-origin images need no login. Every public
request checks privacy/references and immutable bytes. No static cache bypasses
revocation. Shared sanitized GFM retains heading IDs and image proportions;
external authored HTTP(S) images never receive CMS credentials.

SEO reads only the published projection. Dynamic sitemap includes canonical article
URLs and used category/series URLs; no private drafts, archived posts, historical
aliases or media paths. Do not use draft updated_at for lastModified. Metadata,
robots and the static 1200x630 share.png use SITE_URL, never the request Host.
CMS robots disallows all; authorization remains the actual privacy boundary.
Native img requires no Next optimizer; keep images.unoptimized=true in both apps.

## 4. Validation & Error Matrix

| State | Result |
| --- | --- |
| Former404 address published | New request/history return shows full article |
| Draft edit/history restore | Public unchanged until publish |
| Generation changed on focus/history | Reload current document/catalog/detail |
| CMS outage | New request503, visible reconnect state |
| Private/unreferenced/revoked image | 404, no-store |
| Allowed public original | Exact bytes200 and correct MIME |

## 5. Good / Base / Bad Cases

- Good: publish without build, history return and search reflect it.
- Base: unchanged generation does not reload.
- Bad: root embeds permanent bodies, soft refresh fixes only metadata, static media survives archive.

## 6. Tests Required

Runtime: formerly404/new slug, update, draft isolation, archive, category/series/
search, exact media and outage503, unchanged build/PIDs. Browser: leave404, publish,
back to visible article; normal back/forward and focus refresh. Check preview/public
image equivalence and no overflow for landscape/portrait images.

Runtime tests can select --site-port/--cms-port; preflight both ports before test
schema reset. Use a separate local _test DB and 4341/4342 while daily apps run on
4321/4322. --browser runs serially in fresh Chromium/profile under xvfb-run.
Connect with public connectOverCDP({noDefaults:true}) to its default context:
Playwright's normal contexts force every page focused/visible, and setting false
on another CDP session does not remove that session's override. Assert trusted
native visibility/focus events, actual body and publication generation; wait for
the focus-triggered document navigation before evaluating its new context.
Trusted CDP file input is browser-level proof, not physical OS file-manager drag.
Link speculative prefetch stays disabled; RSC prefetch returns a dynamic 200 shell
even for an unknown article, while document HTTP404 and no-store remain required.

## 7. Wrong vs Correct

Wrong: module-level `const catalog = loadCms()` or title-only history verification.
Correct: request-local cache around no-store reads and a visible-body assertion
after generation-triggered document reload.
