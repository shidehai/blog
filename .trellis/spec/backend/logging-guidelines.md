# Logging Guidelines

## Current Pattern

There is no application logging dependency. Small scripts emit concise,
secret-free diagnostics to stdout/stderr; container logs use Docker's
`json-file` driver; Caddy writes structured JSON access logs with its own
retention policy.

## Log

- Build source selection (`fixture` or `directus`) without exposing values.
- Service lifecycle, health, image/runtime validation, and operation success or
  failure.
- A record ID and field name when content validation fails.
- Backup time, size/checksum, duration, and status.

## Never Log

- Directus, database, deployment, dispatch, or Restic secrets.
- Markdown bodies, authentication headers, complete environment dumps, private
  asset URLs, or BuildKit secret contents.
- Details from retired credentials or absent legacy service identities.

Keep platform-native structured output where it already exists. A one-line
boundary diagnostic does not justify a logging library.
