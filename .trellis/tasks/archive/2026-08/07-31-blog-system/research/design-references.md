# Design and Product References

Checked against the public sites and official project documentation on
2026-07-31. These are references for specific behaviors, not templates to clone.

## Reading and Personal-Site References

### aiayy.cn — Primary Visual Reference

Source: <https://aiayy.cn>

- Use as the primary frontend material/composition reference: floating capsule
  navigation, single-surface light/dark neumorphism, blue signals, asymmetric
  Bento Home, clipped feature media, raised/inset states, and restrained motion.
- Adapt for this product: replace statistics, clock, technology grid, 3D room,
  and portfolio content with featured writing, latest articles, notes, topics,
  Search, Archive, and RSS.
- Improve rather than copy: AA contrast, 44px targets, reading-first mobile order,
  visible-by-default motion, a flatter article plane, and forced-color behavior.
- Do not reuse its avatar, wording, stock image, exact palette, data, route set,
  category icons, or code. Full evidence and mapping live in
  `aiayy-frontend-direction.md`.

### Josh W. Comeau

Source: <https://www.joshwcomeau.com/>

- Study: tutorial hierarchy, explanatory examples, category discovery, search,
  theme controls, and the way interaction supports teaching.
- Do not copy: the volume of playful effects or course/newsletter promotion;
  this project needs a calmer personal voice.

### Steph Ango

Source: <https://stephango.com/>

- Study: one archive that comfortably mixes short notes and longer essays,
  visible topics, dates, and extremely direct navigation.
- Do not copy: the nearly monochrome, text-only treatment as the complete visual
  direction; technical tutorials here also need diagrams, code, and media.

### Emil Kowalski

Source: <https://emilkowal.ski/>

- Study: compact personal positioning, disciplined motion, and a clear split
  between authored work and writing.
- Do not copy: portfolio and course promotion as the homepage's primary job.

### Rauno Freiberg

Source: <https://rauno.me/>

- Study: craft at the level of hover, timing, focus, and spatial detail.
- Do not copy: opaque experimental navigation that makes reading secondary.

## Publishing-System References

### Directus

Sources:

- <https://directus.com/docs/raw/guides/data-model/interfaces.md>
- <https://directus.com/docs/raw/guides/content/content-versioning.md>
- <https://directus.com/docs/raw/guides/content/live-preview.md>
- <https://directus.com/docs/raw/guides/auth/access-control.md>
- <https://directus.com/docs/raw/tutorials/migration/promoting-changes-between-environments-in-directus.md>

- Study and use: PostgreSQL-first schema management, Markdown text interface,
  draft content versions, revisions, live preview, singleton settings, media,
  least-privilege APIs, event flows, and schema snapshots.
- Do not extend into: a generic page builder, plugin ecosystem, public API, or
  custom admin design. The native Studio is enough for one author.
- License note: Directus 12.2.0 uses MSCL rather than MIT. Pin the version,
  confirm the personal deployment's core/OIG terms, and revisit licensing if
  the system becomes a commercial or competing hosted service.

### Payload

Sources:

- <https://raw.githubusercontent.com/payloadcms/payload/3.x/docs/database/postgres.mdx>
- <https://raw.githubusercontent.com/payloadcms/payload/3.x/docs/versions/drafts.mdx>
- <https://raw.githubusercontent.com/payloadcms/payload/3.x/docs/rich-text/converting-markdown.mdx>

- Study: permissive MIT licensing, PostgreSQL/Drizzle integration, draft access
  control, preview, and autosave.
- Do not select initially: Payload's standard editor stores Lexical JSON. Making
  Markdown the canonical stored body requires a plain/code field or a custom
  admin editor, adding work that Directus already covers.

### Ghost

Sources:

- <https://docs.ghost.org/faq/supported-databases.md>
- <https://docs.ghost.org/themes/content.md>

- Study: polished professional publishing, metadata, and editorial ergonomics.
- Do not select: official production support requires MySQL 8, its Koenig
  content is not the requested canonical Markdown body, and membership/newsletter
  scope is irrelevant here.

### Halo and Typecho

Sources:

- <https://github.com/halo-dev/halo>
- <https://github.com/typecho/typecho>

- Study: approachable Chinese-language administration and the durable core of
  posts, pages, tags, and themes.
- Do not copy: plugin/theme marketplace scope or a PHP/theme runtime that would
  own the public design.

## Selected Foundations

### PostgreSQL and Directus 12.2.0

Sources:

- <https://directus.com/docs/raw/configuration/database.md>
- <https://directus.com/docs/raw/configuration/files.md>
- <https://directus.com/docs/raw/self-hosting/deploying.md>

PostgreSQL is the only live authority for posts, settings, taxonomy, media
metadata, publication state, users, and revisions. Directus supplies the private
Studio and API. Markdown remains text in PostgreSQL. Git stores code, reviewed
schema snapshots, and optional one-way recovery exports; there is no
bidirectional database/file synchronization.

Media bytes use Directus local storage on an explicit persistent VPS bind mount
while metadata and relationships stay in PostgreSQL. PostgreSQL dumps and the
upload volume are encrypted to an off-VPS backup repository. Secrets remain
environment-managed.

### Astro 7.1.6

Sources:

- <https://docs.astro.build/en/guides/on-demand-rendering/>
- <https://docs.astro.build/en/guides/integrations-guide/node/>

Astro prerenders every normal public route from a validated Directus snapshot.
One Astro Node `/preview/[id]` route reads draft/version data on demand behind
Caddy authentication. Astro supplies framework primitives but no theme or UI
boundary: every route, layout, component, style, and Markdown transform remains
custom, with React/Vue/Svelte islands available only if a future interaction
needs one.

### Pagefind

Source: <https://pagefind.app/docs/multilingual/>

Pagefind generates a static search index after the Astro build. Its extended
release, used by the default Node wrapper, supports Chinese word segmentation
and localized UI without a search server. Search code loads only on Search.

### Docker Compose and Caddy on the Owner's VPS

Sources:

- <https://docs.docker.com/compose/>
- <https://caddyserver.com/docs/automatic-https>
- <https://caddyserver.com/docs/caddyfile/directives/reverse_proxy>
- <https://restic.readthedocs.io/en/stable/>

Production Compose runs Caddy, one Astro Node site service, Directus, and
PostgreSQL. Caddy is the only public container and owns TLS, routing, protected
preview access, and compression. A traffic-free candidate container preflights
each digest-addressed image before the single site service is replaced; the
prior digest is retained for automatic rollback. Directus uploads and PostgreSQL use explicit
persistent paths. Encrypted Restic snapshots leave the VPS so Docker
portability is backed by an actual recovery path.

### GitHub Actions

Source: <https://docs.github.com/en/actions>

Code pushes and authenticated Directus publication events converge on one
validation/build/index/image/deploy workflow. Concurrency cancels stale content
builds; a new digest-addressed image must pass candidate health checks before
the Compose site service replaces the prior image, and a failed
post-replacement smoke check redeploys that recorded digest.
