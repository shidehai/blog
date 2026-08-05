# Technical Design: Blog Production Readiness

## 1. Scope And Boundaries

This task repairs a real Directus fixture failure and strengthens evidence for
the existing publication architecture. It does not change the content model,
public routes, permission target, or production topology established by the
archived blog task.

```text
Committed fixture asset
  -> seed fixture loader (bytes + digest identity)
  -> Directus immutable file
  -> published post/settings references
  -> Directus snapshot fetch
  -> media validation + responsive variants
  -> Astro prerender
  -> Pagefind zh-cn index
```

## 2. Fixture Contract

Add a side-effect-free seed helper that reads
`public/images/publishing-workbench-960.webp` relative to `import.meta.url`.
It returns:

- bytes;
- MIME type `image/webp`;
- filename `fixture-cover.webp`;
- a title containing the first 12 hexadecimal characters of SHA-256.

`directus/seed/index.mjs` passes that result to the existing `ensureFile`.
The title is the idempotency key. Identical bytes find the existing file;
changed bytes create a new file ID. The seed then updates settings and post
relations to that ID without changing the old file's bytes.

The helper is imported by the unit test, so the test cannot silently validate a
different image than the seed uploads.

## 3. Regression Test

The media unit test reads the helper result, declares its real 960x540
dimensions and publishable folder, and calls `emitPublicMediaAsset` in a
temporary output directory. It asserts:

- 640px and 960px WebP variants;
- a deterministic hashed path and srcset;
- emitted files are decodable with the expected dimensions;
- the source MIME and byte length agree with the Directus record.

This covers the failed transform operation rather than only Sharp metadata.

## 4. Directus-Backed Verification

Run the idempotent seed twice. Obtain a short-lived administrator token in
memory, then spawn the build with:

```text
CONTENT_SOURCE=directus
DIRECTUS_URL=http://127.0.0.1:8055
DIRECTUS_BUILD_TOKEN=<ephemeral admin access token>
```

The token is diagnostic-only because Core cannot provision the scoped Build
Reader. It is never written to an env file or artifact. After the build, inspect
generated routes/media and search output, then scan generated files for the
known token without printing it.

## 5. OCI And Workflow Verification

First retry the checked-in Dockerfile unchanged. If Docker Hub metadata remains
unreachable, preserve that failure verbatim. A diagnostic build may substitute
an official mirrored Node base in an in-memory Dockerfile stream, but it cannot
replace the committed source or count as registry publication evidence.

Any built current image must pass `scripts/test-runtime-image.sh` and
`scripts/assert-image-secret-free.sh`. Workflow validation uses existing static
contracts plus `actionlint` when available. Vulnerability scanning is attempted
only with a pinned scanner and records registry availability separately from
scan findings.

## 6. Compatibility And Rollback

- No database schema changes are required.
- Re-seeding changes only fake fixture references. The former bad file remains
  orphaned and recoverable; it is not hard-deleted automatically.
- If the helper or test fails, revert the code and re-point fake fixture
  references by re-running the prior seed. Real user media is untouched.
- Production credentials, deployments, and backups are not mutated by this
  task.

## 7. External Gates

Completion of the local task does not satisfy:

- Author/Build/Preview fine-grained policies and MFA workflow under an
  applicable Directus license;
- real Directus Flow event matrix and GitHub dispatch;
- GHCR digest publication, forced SSH, VPS candidate switch, rollback, and
  public-domain headers;
- encrypted off-VPS snapshot plus measured clean-room RPO/RTO;
- replacement of fake identity and content with owner inputs.
