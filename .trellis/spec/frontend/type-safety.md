# Type Safety

## Compile-Time Contract

`tsconfig.json` extends `astro/tsconfigs/strictest`. New TypeScript must pass
`pnpm typecheck` without errors, warnings, or hints. Do not use `any`, unchecked
casts, or duplicated local definitions of external data.

## Runtime Boundaries

External configuration and future Directus responses are untrusted until
validated. `scripts/env.mjs` is the current boundary owner:

- `readBuildEnv()` defaults to fixture content and requires
  `DIRECTUS_URL` plus `DIRECTUS_BUILD_TOKEN` when
  `CONTENT_SOURCE=directus`.
- `readRuntimeEnv()` requires `SITE_URL`, `DIRECTUS_URL`,
  `DIRECTUS_PREVIEW_TOKEN`, and `PREVIEW_TRUSTED_HEADER`; it validates the
  host/port defaults as well.
- Errors name invalid fields but never print secret values.

`astro.config.ts`, the container entrypoint, and `tests/unit/env.test.ts` reuse
that one schema. Do not parse the same environment keys again in route code.

The Directus boundary added in Phase 3 must follow the same shape: decode one
API response schema from `unknown`, normalize it once, and expose frontend
models rather than database records to pages.

## Required Cases

- Base: fixture builds work without CMS credentials.
- Good: Directus builds and production runtime accept complete valid values.
- Bad: incomplete Directus or runtime configuration fails before build/start.
