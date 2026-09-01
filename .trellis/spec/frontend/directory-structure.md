# Frontend Directory Structure

## Current Layout

```text
src/             # V1 Frontend: Astro 5 application (port 4321, Neumorphic Bento)
  pages/         # Astro file routes and endpoints
  styles/        # Project-owned CSS
frontend-v2/     # V2 Frontend: Next.js 15 application (port 4322, Modern Kinetic Editorial)
  app/           # App Router pages (/, /writing, /notes, /topics, /about)
  components/    # React 19 UI components (Navbar, CommandMenu, TOC, PostCard, etc.)
  lib/           # Directus integration and fallback fixtures
tests/
  unit/          # Boundary and pure-logic tests
  e2e/           # Browser-visible behavior
scripts/         # Build/runtime utilities shared by configuration and containers
```

Root files own configuration. `pnpm-workspace.yaml` manages workspace projects (`.` for V1 Astro and `frontend-v2` for V2 Next.js).

## Route Rules

- Normal public routes live in `src/pages/` and explicitly export
  `prerender = true`. See `src/pages/index.astro` and
  `src/pages/healthz.ts`.
- Only the `/preview/[id]` route may render on demand. It must not create
  a second rendering or content-normalization path.
- Shared presentation belongs in `src/components/` or `src/layouts/` only after
  a second consumer exists. Do not create empty architecture folders.
- Global tokens, font declarations, and reset styles belong in `src/styles/`.
  `AppLayout.astro` imports `global.css` once for every shared HTML route.

## Naming and Placement

- Astro components and layouts use PascalCase filenames; routes follow Astro's
  lowercase file-routing conventions.
- Pure content/config boundary code belongs in `src/lib/` once introduced.
- Tests name the behavior they prove and stay under `tests/unit` or `tests/e2e`.
- Do not put content records under `src/` or `public/`; PostgreSQL is the only
  live content source.
