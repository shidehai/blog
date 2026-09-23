# Frontend Development Guidelines

`frontend-v2/` is the only public application in this repository. It is a
Next.js 15 App Router site on port 4321. Public content is decoded once at
build time into a static snapshot; the standalone runtime serves that output
without Directus credentials.

The root package owns workspace, image, and operations configuration. Directus
and PostgreSQL remain the source of editorial content; the checked fixture is
only an offline input for the same validated V2 snapshot path.

## Pre-Development Checklist

- Read [Directory Structure](./directory-structure.md) before adding or moving
  a route, component, or content helper.
- Read [Component Guidelines](./component-guidelines.md) before changing UI or
  client-side behavior.
- Read [Type Safety](./type-safety.md) before changing environment parsing,
  Directus decoding, or a public snapshot type.
- Read [Quality Guidelines](./quality-guidelines.md) before changing scripts,
  routes, CSS ownership, or tests.
- Search the repository before adding a helper, dependency, client component,
  or CSS system.
- Keep Directus/PostgreSQL as the live content authority. Do not add a second
  Markdown store or make the fixture a production authoring source.

## Guidelines

| Guide | Owns |
| --- | --- |
| [Directory Structure](./directory-structure.md) | App Router placement, route contracts, and content boundaries |
| [Component Guidelines](./component-guidelines.md) | Server/client component split, semantics, accessibility, and CSS ownership |
| [Type Safety](./type-safety.md) | Strict TypeScript, build environment parsing, Directus decoding, and snapshots |
| [Quality Guidelines](./quality-guidelines.md) | V2 checks, static-route verification, and styling/dependency regression checks |

## Quality Check

Run the narrow V2 gate for frontend-only work:

```sh
pnpm --filter frontend-v2 verify
```

It runs TypeScript, ESLint, the real fixture/snapshot selfchecks, and a
production Next build. Run the root gate when a change also touches Directus,
Docker, deployment, or operations scripts:

```sh
pnpm verify
sh scripts/validate-operations.sh
```

The infrastructure-specific image and proxy contract is owned by the backend
spec layer; do not infer its correctness from a frontend build alone.
