# Follow-up: Launch cover UUID consistency

Date: 2026-10-10. The user explicitly approved fixing the inherited
`launch apply` cover UUID issue within the active cleanup task (R12 / AC12).

## Root behavior gap

- `launch apply` constructs fixture and scheduled targets with
  `EDITORIAL_IDS.cover`, while digest-addressed media uploads receive generated
  Directus UUIDs. The settings fixture target also lacks `default_og_image`.
- The actual upload identity is substituted only into settings, leaving the
  prebuilt post cover relation and Markdown media references inconsistent.
- Reapplying a matching launch must also skip unchanged file metadata and
  record PATCHes; otherwise a scheduling maintenance action manufactures
  unrelated update timestamps.

## Implementation boundary

- Read-only lookup by the exact fixture digest title before ownership checks.
- Classify against fixture and scheduled payloads using that same existing
  UUID. Missing expected media with existing owned rows must fail closed.
- For a fresh install, upload only after confirmation and all ownership checks;
  rebuild every desired media reference from the returned UUID before writes.
- Keep the offline plan format/digest, explicit confirmation, owner profile and
  article refusal, avatar/nonowned data preservation, and unknown-record
  boundaries. Do not change production licensing or permissions.
- Product changes are limited to the launch entrypoint, its canonical payload
  helper if needed, its offline regression, and root verify wiring. No general
  launch/manifest redesign or frontend changes.

## Live verification isolation

- The retained `blog-cleanup-test` instance on loopback port 18055 stays intact.
- Create a separate database cloned from its synthetic fixtures, a copied
  uploads volume, and a temporary Directus 12.2.0 container on port 18056.
- Verify seeded apply, same-manifest no-op, genuine owner/missing-media refusal,
  fresh generated-media upload, and unknown-owner sentinels in the clone only.
- Compare a digest of original posts/topics/joins/settings/socials/files before
  setup and after tests/cleanup. Never print bodies or credentials.
- Remove only the temporary clone container/database/uploads after testing;
  preserve the original instance and private evidence.

## Final evidence

- Implementation and focused check passed. Product paths changed:
  `directus/launch.mjs`, `directus/seed/editorial.mjs`, `tests/launch-apply.mjs`,
  and root `package.json` test wiring. No new dependencies or commits.
- Live installed/fresh UUID cases passed, with two full-snapshot no-op replay
  checks and three genuine profile/body/missing-media refusal cases. Unknown
  post/topic/join sentinels were preserved.
- Temporary container/database/uploads were removed. Original content digest,
  schema and health checks passed. The retained port-18055 stack stays running.
- Full root verify/lint/unused-typecheck and scoped formatting checks passed.
- Separate inherited finding: confirmation is bound to the manifest origin,
  not the independently configured endpoint origin. Record this without
  claiming full endpoint-binding safety or expanding the UUID patch.
