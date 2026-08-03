# Directus project state

Phase 2 adds the reviewed `schema.yaml` snapshot and visibly fake development
fixtures here. Directus uploads are never stored in this directory or Git; the
Compose files mount them from `.data/directus/uploads` in development and an
explicit host path in production.
