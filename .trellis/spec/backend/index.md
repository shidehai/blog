# Backend and Infrastructure Guidelines

There is no custom application API. Directus 12 supplies the private CMS and
API, PostgreSQL 17 stores state, and the Next.js standalone image serves the
public static snapshot. Directus is read only during the image build; the
runtime site has no CMS credential or content-source setting.

## Pre-Development Checklist

- Read [Directory Structure](./directory-structure.md) before changing a
  service, Dockerfile, Compose topology, Caddy policy, or operations script.
- Read [Database Guidelines](./database-guidelines.md) before changing Directus
  schema, bootstrap permissions, seed data, or storage behavior.
- Read [Error Handling](./error-handling.md) before changing a secret,
  build-time boundary, or operational failure path.
- Read [Logging Guidelines](./logging-guidelines.md) before emitting a
  diagnostic from a script or service boundary.
- Read [Quality Guidelines](./quality-guidelines.md) for the image, proxy,
  Compose, Directus, and secret-leak validation matrix.
- Trace a change across Directus publication state, V2 snapshot construction,
  static routes, image build, standalone runtime, Caddy, and deployment before
  changing a shared field or environment value.

## Guidelines

| Guide | Owns |
| --- | --- |
| [Directory Structure](./directory-structure.md) | Service/file ownership and topology |
| [Database Guidelines](./database-guidelines.md) | CMS/source-of-truth and exact-ID data safety rules |
| [Error Handling](./error-handling.md) | Fail-closed build and operational boundaries |
| [Logging Guidelines](./logging-guidelines.md) | Bounded, secret-free diagnostics |
| [Quality Guidelines](./quality-guidelines.md) | Image, proxy, Compose, Directus and secret checks |

## Quality Check

Run `pnpm verify`, rendered Compose validation, Caddy validation, and the
runtime image/secret checks whenever a change crosses the public image boundary.
Run Directus schema/bootstrap/access checks only against a disposable or
normally backed-up instance because those checks require credentials and can
create temporary CMS test records.
