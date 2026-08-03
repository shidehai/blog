# Error Handling

## Fail at the Boundary

Configuration is rejected before a build or process starts. `scripts/env.mjs`
owns application environment parsing, and `scripts/backup.sh` checks every
required database/Restic variable before creating a dump.

| Condition | Required behavior |
| --- | --- |
| Fixture build, no CMS secret | Continue |
| Directus build, URL or build token absent | Fail before Astro build |
| Runtime preview URL/token/header absent | Fail before Node server start |
| Backup variable absent | Exit before `pg_dump` |
| Dump cannot be listed by `pg_restore` | Exit without creating a Restic snapshot |
| Any backup exit path | Remove the mode-0600 temporary dump |

Errors may name the missing field or failed operation. They must not include
tokens, passwords, Markdown bodies, preview URLs, or complete environment
objects. Tests assert field names, not secret values.

## Propagation

Prefer process exit status and stderr over custom error hierarchies for these
small entrypoints. Let Astro/Vitest/Compose retain their native diagnostics;
wrap an error only when adding record or field context that the source lacks.
