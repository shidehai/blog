# Logging Guidelines

## Current Pattern

There is no application logging dependency. Small scripts write concise
diagnostics to stdout/stderr, container logs use Docker's `json-file` driver,
and `deploy/compose.yaml` limits them to three 10 MiB files. Caddy writes JSON
access logs with its own size/time retention in `deploy/Caddyfile`.

## Log

- Service lifecycle, health, build stage, and operation success/failure.
- A record ID and field name when future content validation fails.
- Backup time, size/checksum, duration, and status once Phase 8 adds reporting.

## Never Log

- Directus, database, preview, dispatch, deployment, or Restic secrets.
- Markdown bodies, private media URLs, authentication headers, or environment
  dumps.
- Preview URLs containing draft/version identifiers unless redacted.

Keep platform-native structured output where it already exists. Add a logging
library only when multiple application modules need a shared structured schema;
one `console.error` in a boundary script does not justify one.
