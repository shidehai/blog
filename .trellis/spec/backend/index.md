# Backend and Infrastructure Guidelines

There is no custom application backend. Directus 12 supplies the private CMS
and API, PostgreSQL 17 stores state, and the Astro Node process serves static
public output plus the future protected preview route.

## Pre-Development Checklist

- Read [Directory Structure](./directory-structure.md) before adding services or
  operational scripts.
- Read [Database Guidelines](./database-guidelines.md) before changing Directus
  schema or storage.
- Read [Error Handling](./error-handling.md) before adding a trust boundary.
- Read [Logging Guidelines](./logging-guidelines.md) before emitting operational
  data.
- Read [Quality Guidelines](./quality-guidelines.md) for the infrastructure
  contract and validation matrix.
- Trace publication state across Directus, generated routes, Pagefind, feeds,
  metadata, preview, and deployment before changing it.

## Guidelines

| Guide | Owns |
| --- | --- |
| [Directory Structure](./directory-structure.md) | Service and file ownership |
| [Database Guidelines](./database-guidelines.md) | PostgreSQL/Directus source-of-truth rules |
| [Error Handling](./error-handling.md) | Fail-closed environment and script behavior |
| [Logging Guidelines](./logging-guidelines.md) | Structured, bounded, secret-free logs |
| [Quality Guidelines](./quality-guidelines.md) | Compose/container contracts and checks |

## Quality Check

Run `pnpm verify`, Compose configuration validation with the explicit root env
file, the runtime image build, Caddy validation, and service health checks.
