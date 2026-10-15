# Maintenance and security

## Release boundary

Routine CI/forced SSH changes only site. CMS, SQL migrations, Compose/Caddy, PostgreSQL versions, host units and recovery tooling ship through reviewed maintenance releases. Record current/previous site and CMS digests, installed migration checksums and a verified backup before maintenance. Additive schema expansion precedes removal; old retained images must remain compatible. Never blindly apply an old schema snapshot after restoring a full database.

## HTTP and availability

| Surface | Policy |
| --- | --- |
| Public documents and RSC | private, no-store; current published CMS projection |
| /media/UUID | no-store, only currently public references |
| /api/content-generation | no-store; version number only |
| /sitemap.xml, /robots.txt | configured SITE_URL; current published URLs only |
| /_next/static/* | fingerprinted code assets, immutable |
| CMS pages, APIs and private images | owner session required, private/no-store |
| Internal /api/public/* | separate server reader token, published projection only |
| /healthz | process probe; CMS probe also verifies database access |

Caddy keeps HTTPS, framing denial, nosniff and same-origin script/connect policies. Next hydration needs the current inline script allowance. CMS and site media routes verify current access instead of exposing a static upload directory. The site checks CMS availability before reading content and returns 503 on failure; healthz alone does not prove public content is available. Existing pages check generation on navigation/focus/return and reload the document when it changes, including a previously cached 404.

## Accounts and secrets

There is one owner, no registration or roles UI. Passwords use async scrypt and independent salts; cookies are HttpOnly/SameSite Strict and Secure under HTTPS. Database stores session token hashes. Origin checks protect writes; login attempts are persistently rate limited. Owner reset is a local management command and revokes old sessions. CMS_TRUST_PROXY defaults false; do not enable trust in arbitrary forwarded addresses to evade login limits.

Use a dedicated schema-owning database role with no legacy-table grants. Site has no database connection and its reader token cannot call admin APIs. Keep owner password, DB credentials, CMS_READ_TOKEN, Restic credentials, GHCR pull credential, forced SSH key and alert secrets in a password manager/protected host environment. Rotate the reader token in both CMS and site runtime together; rotating credentials does not require embedding them in a rebuilt image.

A full encrypted database backup contains authentication state. Content bundles omit owner and sessions but include private drafts and raw source history; store them privately. A restored authentication database may need owner reset after suspected exposure. A content-only restore always uses the target owner's access setup.

## Host and dependencies

Only Caddy exposes production ports. Keep the PostgreSQL data network internal, restrict administration SSH, disable unrestricted duplicate deploy keys and use pinned host keys. CMS/media and backup staging permissions must match container UID/GID. Monitor storage and offsite backup freshness; logs and alerts must omit bodies, credentials and private file paths.

Run production dependency audit and the configured OCI high/critical vulnerability scan before deploying. Maintain bounded Docker/Caddy log retention and planned host patch/reboot windows. Package/license evidence for the new editor and renderer is in author-cms/DEPENDENCIES.md. The former CMS runtime and SDK are removed; the retained offline snapshot converter has no dependency on that platform.

The quality job scans both actual app images as well as application dependencies;
manual publishing repeats the image scan. Use the pinned official Trivy release
and a current vulnerability DB, with no severity ignores or unfixed bypass.
If download/scan infrastructure fails, record that as unverified instead of
calling the image gate passed. Native image optimization is disabled in both
apps because they use original img delivery. Fontsource assets keep font builds
independent of Google Fonts; actual Sharp/libvips and CJK rendering stay covered
by the CMS image smoke.

Application runtime images use the patched Node 24.22.0/Alpine 3.23 base. Only
build/development stages keep npm, Corepack and Yarn; runtime applications and
management CLIs run node directly. The image smoke asserts the Node patch and
absence of those global toolchains. Scan the actual final image IDs, since a
clean application audit does not cover OS packages or the base image's npm tree.
