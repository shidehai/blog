# Frontend Directory Structure

```text
frontend-v2/app/archives/[slug]/        # Dynamic canonical article
frontend-v2/app/writing/[slug]/         # Published slug/alias permanent redirect
frontend-v2/app/media/[id]/             # Same-origin publication media proxy
frontend-v2/app/api/content-generation/ # Browser freshness, no-store
frontend-v2/components/                 # Public UI/browser interactions
frontend-v2/lib/content.ts              # Typed runtime reads, request-local dedup
frontend-v2/lib/env.ts                  # Server environment boundary
frontend-v2/lib/fixture-projector.ts    # Pure offline sample projection
frontend-v2/public/                     # Authored assets, never CMS upload root
author-cms/app/                         # Login/list/write/media/organize/settings
author-cms/components/                  # Editor/media picker/shell/controls
author-cms/lib/                         # API/domain/auth/storage/transfer
packages/content-contracts/             # Shared schemas and inferred types
packages/markdown/                      # Shared renderer and article CSS
```

The CMS uses fixed Next basePath `/admin`. Next Link/router/redirect consume
application-local paths; native fetch/XHR/img/a and private preview media use
cmsPath from `@blog/content-contracts/paths`. Do not double-prefix Next navigation.
Stored Markdown/public cover/avatar media remain `/media/UUID`. Root public
robots excludes `/admin`, and CMS responses stay noindex/no-store.

Pages are server components; client boundaries own named browser interactions.
Use promised params. Content routes are force-dynamic; no static slug list or
dynamicParams=false. archives resolves current publication/aliases and canonical
redirect; known writing slug returns308, unknown writing/note routes remain404.
Notes/topics remain manageable without new public channels.

Pages consume lib/content.ts, not raw CMS rows/credentials. Root layout embeds no
permanent catalog. LayoutShell receives summaries; detail only loads for its route.
Keep filesystem/crypto/DB/env out of client import graphs.

Each app owns semantic tokens/classes in app/globals.css; article CSS belongs to
packages/markdown. Do not add inactive Tailwind/utility config. Keep one-consumer
UI local; share after real reuse. Preserve authored assets and unrelated changes.
