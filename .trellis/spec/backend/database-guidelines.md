# Database Guidelines

## Source of Truth

PostgreSQL is the only live authority for content, settings, taxonomy, media
metadata, users, and revisions. Directus owns access and schema configuration.
The Astro application consumes validated API snapshots; it does not connect to
PostgreSQL or introduce an ORM.

## Current Contract

`deploy/compose.yaml` pins PostgreSQL 17.9 and Directus 12.2.0. Required database
configuration is `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`.
Directus receives those values over the internal `data` network.

- Production publishes no PostgreSQL port.
- Development may publish `127.0.0.1:5432` only.
- Data lives at `${BLOG_DATA_ROOT}/postgres`; uploads live separately at
  `${BLOG_DATA_ROOT}/directus/uploads`.
- The Directus schema snapshot belongs at `directus/schema.yaml` once Phase 2
  creates real collections.

## Schema Changes

Use reviewed Directus snapshots and expand/deploy/contract ordering. Never
apply a destructive contraction in the release that first stops reading the
old field. A full database restore already includes the Directus schema and
must not be followed by a blind schema apply.

Do not add speculative SQL migrations before a real Directus snapshot exists.
Database constraints and CMS validation added in Phase 2 must agree on slug,
status, required-field, and relationship rules.
