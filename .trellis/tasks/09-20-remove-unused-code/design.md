# 技术设计：V2 残留清理与运行时收敛

## 1. Scope and boundaries

This is one integrated cleanup rather than separate feature work: the missing
article route is the consumer that makes the retained content/Markdown code
valid again; removing preview changes the Docker, Compose, Caddy, Directus and
test contracts together.

The live boundaries after this work are:

~~~text
Directus published records
  -> build-only V2 Directus decoder
  -> ContentSnapshot / static App Router routes
  -> Next standalone image
  -> Caddy public proxy

Fixture rows
  -> same decoder and ContentSnapshot
  -> local/CI fixture build only
~~~

Directus remains the authority for articles, notes, topics, taxonomy, media,
revisions and authoring. V2 consumes only the public article projection it
renders. Removing a V2 projection does not alter the CMS collection, seed,
data, database constraint or author permission.

## 2. V2 content and route contract

### 2.1 Build source selection

frontend-v2/lib/env.ts remains the sole V2 owner of environment parsing. It
will distinguish two build-time modes:

| Mode | Required values | Result |
| --- | --- | --- |
| fixture (default) | none | Build from the checked offline fixture |
| directus | DIRECTUS_URL and a 24+ character DIRECTUS_BUILD_TOKEN | Fetch and validate published CMS content; any invalid credential or request failure aborts the build |

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

~~~text
app/archives/[slug]/page.tsx
  generateStaticParams() -> current published posts
  generateMetadata() -> post title/summary
  page() -> notFound() for an absent post
          -> ArticleClient for a present post

app/writing/[slug]/page.tsx
  generateStaticParams() -> same current published posts
  page() -> permanentRedirect(/archives/[slug])
~~~

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

~~~text
CI Directus URL + BuildKit secret
  -> Docker build stage, DIRECTUS mode
  -> Next static output
  -> standalone runtime image (no Directus credential)
  -> node user on port 4321
  -> /healthz and public pages
~~~

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
explicitly requested and starts the restored development target on localhost
4321.

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
