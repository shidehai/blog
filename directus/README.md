# Directus project state

- `schema.yaml` owns collections, fields, interfaces, validation metadata, and
  relations supported by Directus schema snapshots.
- `database.sql` owns PostgreSQL checks, composite indexes, junction uniqueness,
  and published-slug immutability that snapshots cannot represent.
- `bootstrap.mjs` reconciles folders, roles, policies, permissions, service
  users, tokens, and flows that snapshots do not contain.
- `seed/index.mjs` installs visibly fake development content and media.

Directus uploads are never stored here or in Git. Compose mounts them from
`.data/directus/uploads` in development and an explicit host path in
production.

## License gate

Directus Core permits the instance to start but does not enable custom
permission rules. This project requires those rules for published-only posts,
folder-scoped media, and field allowlists. `bootstrap.mjs` reads `/license` and
refuses to install scoped permissions unless
`custom_permission_rules_enabled` is active; the access test enforces the same
contract. It intentionally never falls back to public or all-field access.

Eligible owners can apply for an Open Innovation Grant at
<https://directus.com/oig>. Put the issued key only in the untracked `.env` as
`DIRECTUS_LICENSE_KEY`. The Compose service exposes it to Directus as
`LICENSE_KEY`. Development may set one stable absolute `DIRECTUS_PUBLIC_URL`;
production ignores that override and uses `https://${CMS_DOMAIN}`.

The OIG currently allows five activations, lasts one year, and binds an
activation to the project database plus `PUBLIC_URL`. Deactivate it before
destroying or repurposing a licensed environment. Never commit the key or use a
new throwaway database/URL for every licensed CI run.
