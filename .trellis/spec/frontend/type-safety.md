# Type Safety

## Compile-Time Contract

V1 `tsconfig.json` extends `astro/tsconfigs/strictest`; V2 `frontend-v2/tsconfig.json`
runs `strict` with `noUncheckedIndexedAccess`. New TypeScript must pass that
package's typecheck (`pnpm typecheck` / `pnpm --filter frontend-v2 typecheck`)
without errors, warnings, or hints. Do not use `any`, unchecked casts, or
duplicated local definitions of external data.

## Runtime Boundaries

External configuration and Directus responses are untrusted until validated.
**Each package parses a given environment key in exactly one owner module.**
V1's owner is `scripts/env.mjs`; V2's is `frontend-v2/lib/env.ts`.

V2 does not import V1's `scripts/env.mjs`. It sits outside V2's `tsconfig`
`include`, and a `paths` alias only satisfies `tsc` — webpack does not read
`paths`, so the build fails at module resolution. Wiring a webpack alias would
pull V1's build scripts into V2's bundle graph to read two variables. V2
therefore re-declares the same rules (URL format, token `min(24)`) locally.

`scripts/env.mjs` is V1's boundary owner:

- `readBuildEnv()` defaults to fixture content and requires
  `DIRECTUS_URL` plus `DIRECTUS_BUILD_TOKEN` when
  `CONTENT_SOURCE=directus`.
- `readRuntimeEnv()` requires an explicit `CONTENT_SOURCE` plus `SITE_URL`,
  `DIRECTUS_URL`, `DIRECTUS_PREVIEW_TOKEN`, and
  `PREVIEW_TRUSTED_HEADER`; it validates the host/port defaults as well.
  Production Compose fixes the source to `directus`, while fixture browser
  and container tests opt into `fixture`.
- Errors name invalid fields but never print secret values.

`astro.config.ts`, the container entrypoint, and `tests/unit/env.test.ts` reuse
that one schema. Do not parse the same environment keys again in route code.

`frontend-v2/lib/env.ts` is V2's boundary owner. `readDirectusCredentials()`
returns `null` for absent or malformed credentials rather than throwing, because
V2 must fall back to fixtures offline. Malformed values log a warning naming the
field before falling back — silent fallback makes a typo'd token look identical
to an unconfigured one. `process.env` must not appear anywhere else in V2.

## Directus Response Boundary

Decode one API response schema from `unknown`, normalize it once, and expose
frontend models rather than database records to pages. A type assertion
(`as Promise<RawPost[]>`) is not a decode: it silences the compiler while
trusting unvalidated network data.

Derive the row types from the schema (`type RawPost = z.infer<typeof rawPostSchema>`)
instead of hand-writing a parallel `interface`. Two declarations of one contract
drift, and editing the interface while forgetting the schema disables validation
with no compiler error.

A nullable column that feeds a comparator must be validated, not assumed.
`posts.published_at` is nullable in `directus/schema.yaml` and reaches
`Date.parse` in the sort comparator; an unvalidated null yields `NaN` and
silently scrambles order. Validate it as an ISO timestamp with a UTC offset, the
same rule V1's `timestamp` applies.

`posts.body` is `is_nullable: false` in the schema, and the decode still rejects
null and empty for it, because `readingMinutes` and `excerpt` read its `length`.
A non-null database column is not a guarantee at the API boundary: the field can
be absent from a sparse field selection or empty after a draft save. Enforce the
requirement the consumer actually depends on, not the one the DDL states.

## Snapshot Contracts

- **Sorting lives in `buildSnapshot`**, shared by the Directus and fixture paths.
  Sorting again in a page or per-source adapter lets the two paths diverge, so a
  fixture build stops predicting production order.
- **`postSlugsByTopic` is the single source for topic to post mapping.** Do not
  re-derive the M2M relation by scanning posts in a route; a second traversal
  drops the decode-time normalization and disagrees on edge cases.

## Required Cases

- Base: fixture builds work without CMS credentials.
- Good: Directus builds and production runtime accept complete valid values.
- Bad: incomplete Directus or runtime configuration fails before build/start.

### V2 Validation Matrix

| Condition | Result |
| --- | --- |
| No `DIRECTUS_URL` / `DIRECTUS_BUILD_TOKEN` | `null`, silent fixture fallback |
| Malformed URL or token shorter than 24 chars | `null` + warning naming the field |
| `DIRECTUS_URL` with a trailing slash | accepted, slash stripped |
| `published_at` null, empty, or without a UTC offset | decode rejects the row |
| `body` null | decode rejects the row |

Assertion points live in `frontend-v2/lib/fixture.selfcheck.mts`, run by
`pnpm --filter frontend-v2 selfcheck`. It asserts each row of the matrix plus
the derived snapshot shape (post/note split, topic count, reading minutes). A
type-level change that disables validation must fail there, not in review.
