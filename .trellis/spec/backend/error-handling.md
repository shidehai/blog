# Error Handling

## Fail at the Boundary

Configuration is validated before a build reaches content loading. V2 owns
build-time parsing in `frontend-v2/lib/env.ts`; Docker validates the requested
source/secret before invoking Next; operations scripts validate their own
required infrastructure values.

| Condition | Required behavior |
| --- | --- |
| Fixture build with no CMS secret | Continue using the checked fixture |
| Directus build with missing/invalid URL or token | Fail before or during build; never use fixture fallback |
| Directus request or decoder failure | Abort the Next build with field/operation context, never the token |
| Runtime image receives CMS source/credential env | Configuration/image validation fails |
| `/healthz` is requested | Return non-cacheable success without CMS I/O |
| Backup variable absent | Exit before `pg_dump` |
| Dump cannot be listed by `pg_restore` | Exit without creating a Restic snapshot |
| Any backup exit path | Remove the mode-0600 temporary dump |

Errors may name a missing field, service, or failed operation. They must not
print tokens, passwords, request headers, Markdown bodies, private URLs, or a
complete environment object.

## Propagation

Prefer process exit status and stderr for small build/operations entrypoints.
Let Next, Docker, Compose, Caddy, and Directus retain native diagnostics; wrap
an error only to add safe record/field context. Do not add a fallback that
changes a requested Directus build into a fixture build.
