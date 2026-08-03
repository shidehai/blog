# Personal Blog System

## Goal

Build a highly crafted, Chinese-first personal publication for one author. It
must make technical articles and tutorials excellent to read while giving
short notes and informal observations a natural home in the same identity.

PostgreSQL is the authoritative store for content and site configuration. The
owner writes, previews, revises, and publishes through a private browser CMS;
readers use a fast public site without an account or access to the CMS.

## User Value

- Readers can understand long technical material, keep their place, inspect
  code and diagrams, and find related writing without interface clutter.
- Casual visitors can distinguish substantial writing from lightweight notes
  and browse either stream quickly.
- The owner has one mature authoring workflow with drafts, preview, revision
  history, media management, and recoverable backups.
- Content remains portable Markdown text even though PostgreSQL, rather than
  Git, is its live source of truth.

## Confirmed Facts

- This is a single-author personal publication.
- Public content includes technical articles, tutorials, notes, and informal
  observations.
- All published entries are public. Unpublished entries are private drafts;
  there is no reader-facing private area.
- Readers never register or sign in.
- PostgreSQL stores article bodies, metadata, taxonomy, publication state, and
  site configuration.
- Article bodies are stored as Markdown text, not proprietary rich-text JSON.
- The browser CMS is the only live authoring surface. Git stores application
  code, database schema snapshots, and optional recovery exports, not a second
  editable content source.
- Production runs as Docker containers on the owner's VPS. It does not depend
  on Cloudflare Workers or a managed application platform.
- Media binaries live in a persistent Directus upload volume on the VPS;
  PostgreSQL remains authoritative for their metadata and relationships.
- Secrets and environment-specific infrastructure values are deployment
  configuration, not editable site settings.
- The public reading experience receives the primary design effort. The CMS
  uses its mature native interface rather than a custom-branded admin app.
- The public frontend uses <https://aiayy.cn> as its primary visual and motion
  reference: floating capsule navigation, single-surface neumorphism,
  asymmetric Bento composition, blue signal color, clipped featured media, and
  responsive light/dark themes. The implementation adapts these characteristics
  without copying that site's identity, assets, content, route set, or code.
- The frontend may use a framework, but it must remain completely custom: no
  purchased theme, generic blog template, page builder, or UI kit determines
  routes, components, content rendering, or visual identity.
- The default language is Simplified Chinese, with normal support for English
  technical terms, code, and mixed-script titles.

## Requirements

### R1. Public Information Architecture

- The first viewport identifies the author/site and presents real current
  writing, with the next content section already visible.
- Primary destinations are Home, Writing, Notes, Topics, Search, and About.
- Writing contains technical articles and tutorials. Notes contains concise
  notes and informal observations in reverse chronological order.
- Each topic has an archive page. A complete chronological archive is
  available without infinite scroll.
- Stable, human-readable URLs use an explicit slug that does not change when a
  display title changes.

### R2. Database Content Model

- One `posts` collection supports `article`, `tutorial`, and `note` kinds
  instead of separate content stores.
- Every post has a title, slug, kind, publication visibility, publication date,
  Markdown body, and zero or more topics. Summary is required for articles and
  tutorials and optional for notes. Updated date, featured state, cover media,
  cover alternative text, and SEO overrides are optional where valid.
- Published slugs are unique and stable. A published post cannot have an empty
  title, body, slug, or publication date; articles and tutorials additionally
  require a summary, while notes may use a derived excerpt.
- A cover image cannot be published without useful alternative text unless it
  is explicitly marked decorative.
- A `topics` collection owns topic names, stable slugs, and optional
  descriptions. Post/topic relationships are many-to-many.
- A singleton `site_settings` record owns public identity and presentation
  content such as site name, author name, introduction, biography, default SEO
  description, default sharing image, avatar, social links, footer text,
  `zh-CN` locale, and an IANA display timezone (default `Asia/Shanghai`).
- Media metadata and relationships are stored in PostgreSQL. Original file
  bytes are stored through the CMS media library on a durable VPS volume.
- CMS media uses separate publishable and private-draft scopes. The build
  credential can read only the publishable scope, preview may read both, and a
  public build fails if any referenced asset has not been promoted to the
  publishable scope.
- Uploaded originals are immutable: replacing media creates a new file identity,
  and files referenced by published content are never hard-deleted. SVG is
  sanitized before publication; unsupported or unsafe media fails validation.
- Reading time, heading outline, canonical URL, and related entries are derived
  by the frontend rather than duplicated as editable database fields.
- Directus content versions represent editorial drafts; the published row's
  visibility distinguishes public content from archived/unpublished content.
- Database constraints and CMS validation reject invalid enum values, duplicate
  slugs, and incomplete publish attempts before they reach production.

### R3. Private Authoring and Publication

- The owner signs in to Directus Studio using a least-privilege author account
  with multi-factor authentication. A separate break-glass administrator is
  reserved for schema, policy, and account recovery operations.
- The CMS provides Markdown editing and preview, structured metadata fields,
  media upload and selection, topic management, draft/publish content versions,
  archive/unpublish state, and revision restoration.
- Editing a draft never changes the public site. Publishing or updating a
  published post triggers a validated site build automatically.
- The public site changes only after that build and deployment succeed. A
  failed build leaves the previous production deployment intact and exposes a
  diagnosable failure to the owner.
- A protected full-page preview renders draft content with the real article
  layout. Preview credentials and CMS service tokens never reach public browser
  JavaScript, logs, or generated HTML.
- The Directus public role has no content or configuration read access. Build
  and preview access use separate least-privilege, server-side credentials.
- Content revisions and database backups are both retained: revisions recover
  editorial mistakes, while backups recover infrastructure loss.

### R4. Long-Form Reading

- Article and tutorial pages provide a clear title hierarchy, metadata, reading
  progress, generated table of contents, anchored headings, styled tables,
  footnotes, responsive media, and syntax-highlighted code.
- The Markdown contract supports CommonMark, GitHub-flavored tables and task
  lists, fenced code, footnotes, callouts, and images without arbitrary MDX or
  executable author-supplied JavaScript.
- Code blocks expose a keyboard-accessible copy command with success feedback
  and stable dimensions. Fenced code may declare a filename, highlighted lines,
  and diff state through one documented, build-validated metadata syntax.
- Desktop layouts may use a sticky secondary rail; mobile layouts keep the
  reading column primary and expose the outline through a native disclosure.
- The prose measure, Chinese line height, heading wrapping, and media sizing
  remain comfortable from 320px mobile widths through wide desktop screens.
- A print stylesheet removes navigation and interactive chrome while preserving
  headings, code, URLs, footnotes, and meaningful media for tutorials.
- Build validation rejects unresolved internal routes, heading anchors, and
  CMS media references. External URL reachability is not a publication gate, so
  a third-party outage cannot block an otherwise valid release.

### R5. Visual System

- The visual direction follows `PRODUCT.md` and `DESIGN.md`: "The Sculpted
  Workbench," a reading-first adaptation of `aiayy.cn` using a cool neutral or
  graphite single-surface theme, restrained blue signals, soft raised/inset
  relief, asymmetric Bento composition, strong mixed-script typography, and
  real content artifacts.
- Astro provides routing, rendering, and selective interactive islands, but
  all public layouts, components, styles, and Markdown presentation are
  project-owned and can be replaced or extended without a theme boundary.
- Desktop Home pairs a compact identity module with a larger featured-writing
  module, then uses varied Bento cells for latest writing, recent notes, topics,
  and Search/Archive/RSS shortcuts. Mobile puts featured/current writing before
  the expanded profile so content is not pushed several screens down.
- The capsule header remains visually floating and may compress after scroll;
  navigation position, keyboard order, and page content never jump when it does.
- Relief has semantic states (`flat`, `raised`, `inset`, `floating`) shared by
  both themes. Long-form prose remains substantially flatter and higher contrast
  than the homepage shell; shadows do not carry meaning on their own.
- Light and dark themes are both intentional. System preference is respected,
  and a reader's explicit choice persists locally.
- Motion includes restrained press/lift feedback, one coordinated first-row
  reveal, optional hero phrase typing, and header compression. It never gates
  content and has a reduced-motion/static equivalent.
- The reference's avatar, copy, stock image, visitor counters, binary clock, 3D
  space, guestbook, résumé, category icon grid, exact palette, and source code
  are not copied. The interface also avoids nested raised cards, purple
  gradients, glassmorphism, terminal cosplay, and decorative grids/orbs/bokeh.

### R6. Discovery and Syndication

- Static full-text search supports Chinese segmentation and loads only when a
  reader opens Search.
- Readers can browse by kind, topic, date, and related-entry links.
- A valid RSS feed contains all published content kinds and absolute URLs.
- Search, feed, topic, empty, and 404 states use useful content rather than
  promotional or instructional feature copy.

### R7. Metadata and Sharing

- Every public page has a unique title, description, canonical URL, Open Graph,
  and social metadata.
- Public documents declare `lang="zh-CN"`; isolated passages may override
  language when needed. Dates are stored/transmitted in UTC and formatted using
  the database-configured IANA timezone.
- Post pages emit appropriate `BlogPosting` structured data; the site emits
  `WebSite` and `Person` identity data.
- Sitemap, robots directives, favicons, web manifest metadata, and a branded
  default sharing image are present.
- A post cover image becomes its sharing image when available; otherwise the
  database-configured default image is used.

### R8. Accessibility, Privacy, and Performance

- Meet WCAG 2.2 AA for keyboard access, focus visibility, semantics, contrast,
  zoom/reflow, alternative text, and reduced motion. Standalone controls use a
  comfortable 44 CSS-pixel target where layout permits; inline text links keep
  their native text affordance.
- No reader authentication, comments, tracking cookies, or cookie banner are
  introduced.
- Public pages are statically generated and usable without client JavaScript;
  JavaScript is limited to progressive search, theme, copy, navigation, and
  reading-progress enhancements.
- The initial theme is applied before first paint so system or persisted dark
  mode does not flash the wrong reading surface.
- Raw HTML in Markdown is disabled or sanitized. External links and embedded
  media cannot introduce executable content into generated pages.
- Images have explicit dimensions, responsive formats, and lazy loading when
  they are below the fold.
- Representative production pages target Lighthouse scores of at least 95 for
  Performance, Accessibility, Best Practices, and SEO on mobile runs.

### R9. Delivery and Operations

- PostgreSQL is the single live source for content and editable site settings.
  No file/database synchronization or bidirectional import loop exists.
- A code push and a relevant CMS publication or configuration change both run
  validation, generate the public site and search index, and deploy immutable
  assets.
- Production Docker Compose runs Caddy, the Astro Node application, Directus,
  and PostgreSQL on the VPS. Only Caddy publishes HTTP/HTTPS ports; PostgreSQL
  stays on a private Docker network.
- Each successful release is an immutable site image addressed by its OCI
  digest. The deploy process
  preflights it as a traffic-free candidate container, replaces the single site
  service only after that check, and automatically redeploys the recorded prior
  digest if the external smoke check fails. A brief container restart is
  acceptable; two permanent blue/green site services are unnecessary.
- Production uses HTTPS, a custom 404, restrictive security headers, immutable
  caching for hashed assets, and revalidation for HTML.
- Database schema changes are reviewed as versioned Directus schema snapshots
  and use an expand/deploy/contract sequence; destructive contractions never
  ship in the same release that stops reading the old field.
- Routine code/content releases may replace only the site image. Compose,
  Caddy, deploy scripts, Directus/PostgreSQL versions, and schema snapshots use
  a separate owner-run maintenance release with a verified backup, reviewed
  diff, health checks, and explicit rollback.
- Automated PostgreSQL and upload-volume backups leave the VPS, with documented
  retention, encryption, monitoring, and a tested restore procedure. The
  recovery targets are at most 24 hours of data loss and four hours to restore
  a clean VPS under normal network conditions.
- Image cleanup preserves the deployed and rollback digests and removes only
  repository-scoped, unreferenced old site images; generic Docker pruning is not
  part of deployment.
- Production credentials are environment-managed, rotated independently, and
  absent from Git, database-export fixtures, client bundles, and build logs.
- Directus, PostgreSQL, and the frontend expose health/build signals sufficient
  to distinguish CMS, database, content-validation, and deployment failures.

## Acceptance Criteria

- [ ] AC1: At 320px, 768px, 1440px, and 1920px widths, Home identifies the
      author/site, visibly follows the approved `aiayy.cn`-inspired capsule,
      neumorphic, blue-signal, and Bento direction, exposes current writing in
      the first viewport, and has no incoherent overlap, overflow, or avoidable
      layout shift.
- [ ] AC2: A reader can reach Writing, Notes, a topic archive, Search, About,
      the chronological archive, and RSS without signing in.
- [ ] AC3: Articles, tutorials, and notes come from one PostgreSQL collection
      but render with visibly appropriate density and hierarchy.
- [ ] AC4: A long tutorial demonstrates headings, outline navigation, code copy,
      tables, footnotes, callouts, responsive media, topics, related entries,
      and readable light/dark themes on desktop and mobile. Its prose surface is
      flatter and higher-contrast than Home while visibly belonging to the same
      relief system.
- [ ] AC5: The owner can create a Markdown draft, upload media, preview it in the
      final page layout, publish it, edit it, inspect revisions, and restore an
      earlier revision entirely through the author account; the break-glass
      administrator is not required for routine publishing.
- [ ] AC6: Draft and archived entries are absent from generated routes, lists,
      search, RSS, sitemap, metadata, related results, and unauthenticated
      Directus API responses.
- [ ] AC7: Changing published content or an editable `site_settings` value
      triggers one validated Docker image deployment to the VPS; a failed
      candidate never receives traffic, and a failed post-replacement smoke
      check automatically restores the recorded prior digest.
- [ ] AC8: Chinese queries find matching Chinese content in the production
      Pagefind index, and search code is absent from the initial page JavaScript
      path until Search is opened.
- [ ] AC9: Automated accessibility checks find no serious or critical issues on
      Home, a long post, Notes, Search, About, Preview, and 404; all public flows
      pass manual keyboard and reduced-motion checks. Muted text reaches AA,
      standalone controls meet the planned touch target, forced colors do not
      depend on shadows, and essential content is visible before motion runs.
- [ ] AC10: Metadata validation confirms canonical, Open Graph, structured data,
      RSS, sitemap, robots, `zh-CN` language, configured-timezone dates, and
      sharing-image behavior for representative pages.
- [ ] AC11: Runtime schema validation, internal route/anchor/media validation,
      focused unit tests, production build, Pagefind indexing, browser tests,
      container health checks, candidate-image preflight, and automatic
      prior-digest rollback all pass.
- [ ] AC12: A read-only build credential can fetch only published content and
      the dedicated publishable-media scope, and the build fetches only current
      references; preview access is server-side; the unauthenticated Directus
      role cannot read content, settings, users, revisions, or private-draft
      assets; the routine Author cannot overwrite or hard-delete published
      originals, and unsafe SVG is rejected.
- [ ] AC13: An encrypted off-VPS backup can restore PostgreSQL, Directus
      metadata, and the upload volume into a clean Docker environment, after
      which representative content builds with the same stable URLs within the
      four-hour recovery target; the restored recovery point is no older than
      the documented 24-hour target.
- [ ] AC14: Public routes use the planned security and caching headers and have
      no reader-login, comment, reaction, or tracking-cookie surface.

## Out of Scope

- Reader accounts, private reader areas, comments, reactions, likes, follows,
  direct messages, or social feeds
- Multi-author roles, tenants, editorial approval workflows, or a custom CMS
  administration interface
- Direct Git authoring, Git-backed content, or bidirectional Git/database sync
- Newsletter delivery, paid membership, subscriptions, or commerce
- Full multilingual routing and translation management
- Arbitrary page-builder blocks, MDX/JSX, or executable scripts in content
- Runtime database queries for normal public pages; public output is generated
  at publish time
- Cloudflare Workers, Railway, a managed CMS runtime, Kubernetes, or a CDN as a
  launch dependency; the production target is one Docker Compose VPS
- A separate search server, Redis, Elasticsearch, or PostgreSQL full-text search
  while static Pagefind satisfies the public search requirement
- Scheduled publication, content series, redirects management, and analytics
  until a concrete need justifies them
- Visitor/view counters, popularity ranking, decorative clocks, 3D rooms,
  projects portfolio, guestbook, résumé, and friend-link exchange copied from
  the visual reference
- An always-on staging stack; protected preview, CI fixtures, and candidate
  preflight cover the launch workflow for one author
- PWA installation, offline article caching, or native applications

## Deferred Launch Inputs

The owner's public name/site name, domain, final biography, social links,
portrait, and initial real articles/media are required before launch. Production
also requires the VPS address/SSH account, DNS access, GitHub/GHCR destination,
offsite Restic repository, and one alert destination. These are collected once
before production setup; they do not reopen architecture decisions. Development
fixtures must be visibly marked and replaced before production acceptance.
