# Directus project state

- `schema.yaml` owns collections, fields, interfaces, validation metadata, and
  relations supported by Directus schema snapshots.
- `database.sql` owns PostgreSQL checks, composite indexes, junction uniqueness,
  and published-slug immutability that snapshots cannot represent.
- `bootstrap.mjs` reconciles folders, roles, policies, permissions, the Build
  Reader service user/token, and flows that snapshots do not contain. It also
  retires only the fixed IDs of the legacy service reader created by older
  bootstrap versions.
- `seed/index.mjs` installs visibly fake development content and media.

Directus uploads are never stored here or in Git. Compose mounts them from
`.data/directus/uploads` in development and an explicit host path in
production.

## License gate

Directus Core permits the instance to start but does not enable custom
permission rules. This project requires those rules for published
article/tutorial reads, folder-scoped media, and field allowlists.
`bootstrap.mjs` reads `/license` and refuses to install scoped permissions unless
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

## Build Reader and retired preview access

The public Next application reads Directus only while building its static
snapshot. Supply `DIRECTUS_BUILD_TOKEN` to `pnpm directus:bootstrap` when
provisioning the Build Reader, then pass that token to the image build only via
a BuildKit secret. The runtime site has no Directus credentials.

`posts.meta.preview_url` is intentionally `null` and there is no Preview
Reader, preview proxy, or preview token. When bootstrap runs against an older
deployment it deletes permissions and service-identity objects only by the
known legacy IDs, tolerating already-absent records. It does not delete CMS
content, author identities, private draft assets, topics, notes, or the Build
Reader. Take the normal database backup before applying that retirement to a
deployed instance; recreating preview access is a separate, reviewed operation.
