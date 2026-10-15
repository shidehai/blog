# Boundary errors and recovery

## 1. Scope / Trigger

CMS APIs, frontend runtime reads and operational failure paths.

## 2. Signatures

`CmsError(status, message)` → `errorResponse(error)` → `{error: string}`.
`handleApi(request, path)` owns parsing/auth; frontend readers throw ContentUnavailable.
JSON/media/generation/health responses use no-store.

## 3. Contracts

Parse external JSON from unknown with shared Zod schemas. Limit streamed bodies.
Every private request checks owner session; writes/login require exact Origin.
Public bearer reader cannot access admin APIs. Never expose reader token in props.
Save failures retain text; 409 offers reload/clone. Publish waits for saves/images.
Unknown outcome retains the same key, locks editing and offers confirmation; only
confirmed commit is success. A query 404 during a network failure is not rollback.
Missing detail is 404; outage is explicit 503, never empty catalog/fixture fallback.
Configuration errors name keys, not values. Health is independent of content I/O.
Operations validate inputs before replacing data and clean temporary secret files.

## 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| Missing owner / invalid reader token | 401 |
| Wrong write Origin | 403 |
| Missing publication / denied public image | 404 |
| Version, slug/name or request-key conflict | 409 |
| Oversized request/image | 413 |
| Invalid JSON/schema/publication fields | 422 |
| Login busy/limited | 429 |
| Unexpected DB/service failure | Bounded 503 |
| Publication response lost | Query/retry same key; retain locked state |
| Backup invalid / restore input absent | Nonzero exit before replacement |

## 5. Good / Base / Bad Cases

- Good: failed save keeps text and explains recovery.
- Base: unavailable CMS shows reconnect with 503.
- Bad: optimistic published success, raw SQL/parser errors or fixture fallback.

## 6. Tests Required

Assert auth/origin, conflicts, rollback/idempotency, invalid/oversized requests,
private media and outage 503. Browser checks cover conflict retention/retry.
Operations prove refusal before mutation and cleanup on every exit.

## 7. Wrong vs Correct

Wrong: `loadCms().catch(() => fixture())`.
Correct: propagate ContentUnavailable as a non-cacheable 503 with reconnect UI.
