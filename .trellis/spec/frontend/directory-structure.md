# Frontend Directory Structure

## Current Layout

```text
frontend-v2/
  app/                         # Next App Router routes and global stylesheet
    archives/[slug]/            # Canonical static article page
    writing/[slug]/             # Static, known-slug compatibility redirect
    healthz/                    # Non-cacheable container health route
  components/                  # Reusable React presentation/client behavior
  lib/                          # Env, Directus decoder, snapshot, fixture, types
  public/                       # Public assets copied into the standalone output
deploy/                         # Compose and Caddy topology
directus/                       # Schema, bootstrap, seed and CMS contracts
scripts/                        # Build, image and operational validation helpers
tests/                          # Directus and operations checks
```

Root files own workspace and image configuration. `frontend-v2` owns its own
dependencies, quality commands, App Router tree, and project-owned CSS.

## Route Rules

- App Router pages are server components by default. Add `"use client"` only
  for a named browser interaction.
- `/archives/[slug]` is the canonical published article route. It exports
  static params from `getAllPosts()`, uses `dynamicParams = false`, and returns
  `notFound()` for a slug outside the current snapshot.
- `/writing/[slug]` generates the same known static params and permanently
  redirects only a confirmed published slug to `/archives/[slug]`. Do not add
  `/writing/page.tsx`, a catch-all redirect, or guessed mappings for unknown
  slugs.
- `/notes/*` deliberately has no V2 route. Notes and topics can remain CMS
  records without becoming public URLs.
- `app/healthz/route.ts` is a lightweight, non-cacheable runtime health
  endpoint; it must not read the CMS.

## Content Boundary

`lib/env.ts` owns build environment parsing. `lib/directus.ts` decodes external
responses and constructs `ContentSnapshot`; `lib/content.ts` is the only page
facing accessor layer. Pages and components consume view models, never raw CMS
records or `process.env`.

The checked fixture and a Directus response enter the same snapshot builder.
Fixture mode is offline/default; an explicit Directus build must fail rather
than silently substituting fixture data. The public projection currently
contains published article/tutorial records, categories, tags, series, and the
site profile. It intentionally does not expose CMS notes, topics, junctions, or
RSS links.

## Naming and Placement

- App Router routes use Next file conventions (`page.tsx`, `route.ts`) and
  lowercase URL segments. Route-local client UI stays adjacent to its route
  when it has one consumer; shared UI belongs in `components/` after a second
  real consumer exists.
- Components use PascalCase filenames. Content boundary modules use concise
  lowercase filenames in `lib/`.
- Global tokens and semantic component classes live in `app/globals.css`.
  Do not reintroduce Tailwind configuration or utility-only styling without a
  deliberate, separately reviewed styling-system decision.
- Tests and executable selfchecks name the behavior they prove. Keep fixture
  assertions in `lib/*.selfcheck.mts` when they exercise the real decoder and
  snapshot path.
