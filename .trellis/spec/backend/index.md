# Backend and Infrastructure Guidelines

`author-cms/` owns the single-owner API, PostgreSQL `author_cms` schema and media.
`frontend-v2/` reads published projections at runtime. Builds need neither content
nor credentials. Publication is a database transaction; no build, webhook or restart.

All AI work runs serially in the main conversation, concurrency 1. No subagents,
workers or delegation, including review and verification.

## Pre-Development Checklist

- Read [Directory Structure](./directory-structure.md) for service, env and storage changes.
- Read [Database Guidelines](./database-guidelines.md) for drafts, publication, migrations and recovery.
- Read [Error Handling](./error-handling.md) and [Logging](./logging-guidelines.md) before boundary changes.
- Read [Quality Guidelines](./quality-guidelines.md) for verification scope.
- Trace shared fields through contracts → store/API → editor/site → proxy → backup.

## Quality Check

Use explicit isolated local `CMS_TEST_DATABASE_URL` ending in `_test`. Run
`pnpm verify` and `sh scripts/validate-operations.sh` for shared/infrastructure
changes. Image/runtime/browser checks prove behavior a build cannot prove.
Never use production as a disposable target.
