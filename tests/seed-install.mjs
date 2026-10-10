import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { IDS } from "../directus/constants.mjs";
import {
  EDITORIAL_IDS,
  EDITORIAL_SETTINGS,
  LEGACY_FIXTURE_POSTS,
  buildLegacyFixtureOriginals,
} from "../directus/seed/content.mjs";
import {
  POST_OWNED_FIELDS,
  SETTINGS_OWNED_FIELDS,
  buildFixturePayloads,
  classifyRecordState,
  itemMatchesOwned,
  parseFixtureConfirmation,
} from "../directus/seed/editorial.mjs";
import { loadSeedCoverFixture } from "../directus/seed/fixtures.mjs";

const coverId = randomUUID();
const ownerCoverId = randomUUID();
const fixture = buildFixturePayloads({ coverId });
const coverFixture = await loadSeedCoverFixture();
const targetOrigin = "http://seed-install.invalid";

assert.notEqual(coverId, EDITORIAL_IDS.cover);
assert.deepEqual(
  [...SETTINGS_OWNED_FIELDS].sort(),
  [
    ...Object.keys(EDITORIAL_SETTINGS).filter((field) => field !== "id"),
    "default_og_image",
  ].sort(),
);
assert.equal(fixture.settings.default_og_image, coverId);
assert.ok(
  itemMatchesOwned(fixture.settings, fixture.settings, SETTINGS_OWNED_FIELDS),
);

const settings = {
  ...fixture.settings,
  avatar: randomUUID(),
  owner_extension: "Preserve this field",
};
assert.equal(
  classifyRecordState(settings, fixture.settings, null, SETTINGS_OWNED_FIELDS),
  "exact_fixture",
);
for (const field of SETTINGS_OWNED_FIELDS) {
  assert.equal(
    classifyRecordState(
      {
        ...settings,
        [field]: field === "default_og_image" ? ownerCoverId : "Owner edit",
      },
      fixture.settings,
      null,
      SETTINGS_OWNED_FIELDS,
    ),
    "owner_modified",
    field,
  );
}
for (const post of fixture.posts) {
  assert.equal(JSON.stringify(post).includes(EDITORIAL_IDS.cover), false);
  assert.equal(
    classifyRecordState(
      post,
      buildFixturePayloads({ coverId }).posts.find(
        (candidate) => candidate.id === post.id,
      ),
      null,
      POST_OWNED_FIELDS,
    ),
    "exact_fixture",
  );
}
const featuredPost = fixture.posts.find((post) => post.featured);
assert.ok(featuredPost);
assert.equal(featuredPost.cover_image, coverId);
assert.ok(featuredPost.body.includes(`directus://${coverId}`));
assert.equal(
  classifyRecordState(
    { ...featuredPost, cover_image: ownerCoverId },
    featuredPost,
    null,
    POST_OWNED_FIELDS,
  ),
  "owner_modified",
);
assert.equal(
  classifyRecordState(null, fixture.settings, null, SETTINGS_OWNED_FIELDS),
  "absent",
);
assert.equal(parseFixtureConfirmation(undefined, targetOrigin), false);
assert.equal(
  parseFixtureConfirmation(
    `CONFIRM_FIXTURE_INSTALL_${targetOrigin}`,
    targetOrigin,
  ),
  true,
);

const records = new Map([
  [`/items/site_settings/${EDITORIAL_IDS.settings}`, settings],
  ...[
    ...fixture.topics.map((topic) => ["topics", topic]),
    ...fixture.posts.map((post) => ["posts", post]),
    ...fixture.postTopics.map((relation) => ["posts_topics", relation]),
    ...LEGACY_FIXTURE_POSTS.map((post) => ["posts", post]),
  ].map(([collection, item]) => [
    `/items/${collection}/${item.id}`,
    {
      ...item,
      owner_extension: "Preserve this field",
      date_created: "2026-07-01T00:00:00.000Z",
      date_updated: "2026-08-01T00:00:00.000Z",
    },
  ]),
]);
const ownerPostId = randomUUID();
records.set(`/items/posts/${ownerPostId}`, {
  id: ownerPostId,
  title: "Owner article",
  body: "Preserve authored content",
});
const originalRecords = structuredClone(records);

async function runPreflight({
  items = records,
  cover = { id: coverId },
  args = [],
  allowMutations = false,
} = {}) {
  const originalFetch = globalThis.fetch;
  const originalExit = process.exit;
  const originalArgv = process.argv;
  const originalLog = console.log;
  const originalError = console.error;
  const originalEnv = process.env;
  const calls = [];
  const messages = [];
  const exitSignal = new Error("Offline fixture exit");
  let exitCode;
  let failure;
  const privateFileId = randomUUID();
  const files = new Map([
    ...(cover
      ? [
          [
            cover.id,
            {
              ...cover,
              title: coverFixture.title,
              folder: IDS.folders.publishable,
              date_created: "2026-07-01T00:00:00.000Z",
              date_updated: "2026-08-01T00:00:00.000Z",
            },
          ],
        ]
      : []),
    [
      privateFileId,
      {
        id: privateFileId,
        title: "示例私有草稿图（非真实内容）",
        folder: IDS.folders.private,
        date_created: "2026-07-01T00:00:00.000Z",
        date_updated: "2026-08-01T00:00:00.000Z",
      },
    ],
  ]);
  const snapshotBefore = structuredClone({ items, files });
  try {
    process.env = {
      DIRECTUS_URL: targetOrigin,
      DIRECTUS_ADMIN_TOKEN: "offline-test-only",
    };
    process.argv = [process.execPath, "directus/seed/index.mjs", ...args];
    process.exit = (code) => {
      exitCode = code;
      throw exitSignal;
    };
    console.log = console.error = (message) => messages.push(message);
    globalThis.fetch = async (input, options) => {
      const url = new URL(input);
      const method = options.method ?? "GET";
      calls.push({ method, pathname: url.pathname });
      assert.equal(url.origin, targetOrigin);
      if (method !== "GET") {
        assert.equal(
          allowMutations,
          true,
          "Preflight must not mutate CMS state",
        );
        const timestamp = new Date(
          Date.UTC(2026, 9, 10) + calls.length * 1000,
        ).toISOString();
        if (method === "POST" && url.pathname === "/files") {
          assert.ok(options.body instanceof FormData);
          const file = {
            id: randomUUID(),
            title: options.body.get("title"),
            folder: options.body.get("folder"),
            date_created: timestamp,
          };
          files.set(file.id, file);
          return Response.json({ data: file });
        }
        if (method === "DELETE") {
          assert.match(url.pathname, /^\/items\/social_links\//);
          items.delete(url.pathname);
          return new Response(null, { status: 204 });
        }
        const payload = JSON.parse(options.body);
        calls.at(-1).payload = payload;
        if (method === "PATCH" && url.pathname.startsWith("/files/")) {
          const fileId = url.pathname.split("/").at(-1);
          const file = {
            ...files.get(fileId),
            ...payload,
            date_updated: timestamp,
          };
          files.set(fileId, file);
          return Response.json({ data: file });
        }
        assert.ok(url.pathname.startsWith("/items/"));
        assert.ok(method === "POST" || method === "PATCH");
        const pathname =
          url.pathname === "/items/site_settings"
            ? `/items/site_settings/${EDITORIAL_IDS.settings}`
            : method === "POST"
              ? `${url.pathname}/${payload.id}`
              : url.pathname;
        assert.equal("date_created" in payload, false);
        assert.equal("date_updated" in payload, false);
        const existing = items.get(pathname);
        const item = {
          ...existing,
          ...payload,
          date_created: existing?.date_created ?? timestamp,
          date_updated: existing ? timestamp : null,
        };
        items.set(pathname, item);
        return Response.json({ data: item });
      }
      if (url.pathname === "/files") {
        const fields = url.searchParams.get("fields");
        assert.ok(fields === "id" || fields === "*");
        const matches = [...files.values()].filter(
          (file) => file.title === url.searchParams.get("filter[title][_eq]"),
        );
        return Response.json({
          data:
            fields === "id"
              ? matches.map((file) => ({ id: file.id }))
              : matches,
        });
      }
      const item = items.get(url.pathname);
      return item
        ? Response.json({ data: item })
        : Response.json(
            { errors: [{ message: "Not found" }] },
            { status: 404 },
          );
    };
    await import(`../directus/seed/index.mjs?offline=${randomUUID()}`);
  } catch (error) {
    if (error !== exitSignal) failure = error;
  } finally {
    globalThis.fetch = originalFetch;
    process.exit = originalExit;
    process.argv = originalArgv;
    process.env = originalEnv;
    console.log = originalLog;
    console.error = originalError;
  }
  if (!allowMutations) assert.ok(calls.every((call) => call.method === "GET"));
  return { calls, exitCode, failure, messages, files, snapshotBefore };
}

function assertUnchanged(result, items) {
  assert.ok(result.calls.every((call) => call.method === "GET"));
  assert.deepEqual(
    { items, files: result.files },
    result.snapshotBefore,
    "Refusal or replay must preserve all data and timestamps",
  );
}

const unchanged = await runPreflight();
assert.equal(unchanged.failure, undefined);
assert.equal(unchanged.exitCode, 0);
assert.ok(
  unchanged.messages.some((message) =>
    message.includes("No mutations performed"),
  ),
);
for (const field of SETTINGS_OWNED_FIELDS) {
  const editedItems = new Map(records);
  editedItems.set(`/items/site_settings/${EDITORIAL_IDS.settings}`, {
    ...settings,
    [field]: field === "default_og_image" ? ownerCoverId : "Owner edit",
  });
  const edited = await runPreflight({ items: editedItems });
  assert.match(
    edited.failure?.message ?? "",
    /owner-modified site_settings.*refused before mutation/,
  );
}
const editedPosts = new Map(records);
editedPosts.set(`/items/posts/${featuredPost.id}`, {
  ...featuredPost,
  cover_image: ownerCoverId,
});
const editedPost = await runPreflight({ items: editedPosts });
assert.match(
  editedPost.failure?.message ?? "",
  /owner-modified or launched post.*refused before mutation/,
);
const missingCover = await runPreflight({ cover: null });
assert.match(
  missingCover.failure?.message ?? "",
  /owner-modified site_settings.*refused before mutation/,
);
const absent = await runPreflight({ items: new Map(), cover: null });
assert.equal(absent.failure, undefined);
assert.equal(absent.exitCode, 1);
assert.ok(
  absent.messages.some((message) =>
    message.includes("requires explicit target confirmation"),
  ),
);
const partialItems = new Map(records);
partialItems.delete(`/items/posts/${featuredPost.id}`);
const partial = await runPreflight({ items: partialItems });
assert.equal(partial.failure, undefined);
assert.equal(partial.exitCode, 1);
const confirmation = `--confirm=CONFIRM_FIXTURE_INSTALL_${targetOrigin}`;
const legacyOriginals = buildLegacyFixtureOriginals({ coverId });
assert.ok(Object.isFrozen(legacyOriginals));
assert.ok(legacyOriginals.every(Object.isFrozen));
assert.deepEqual(
  legacyOriginals.map((post) => post.status),
  ["published", "published", "published", "archived"],
);
const historicalItems = structuredClone(records);
for (const post of legacyOriginals) {
  const pathname = `/items/posts/${post.id}`;
  historicalItems.set(pathname, {
    ...historicalItems.get(pathname),
    ...post,
  });
}
const historicalSnapshot = structuredClone(historicalItems);
const migrated = await runPreflight({
  items: historicalItems,
  args: [confirmation],
  allowMutations: true,
});
assert.equal(migrated.failure, undefined);
const migratedWrites = migrated.calls.filter((call) => call.method !== "GET");
assert.deepEqual(
  migratedWrites
    .filter((call) => call.method !== "DELETE")
    .map((call) => [call.method, call.pathname]),
  LEGACY_FIXTURE_POSTS.map((post) => ["PATCH", `/items/posts/${post.id}`]),
  "Complete canonical content must still migrate the four historical rows",
);
for (const post of LEGACY_FIXTURE_POSTS) {
  const pathname = `/items/posts/${post.id}`;
  const actual = historicalItems.get(pathname);
  assert.ok(itemMatchesOwned(actual, post, POST_OWNED_FIELDS));
  assert.equal(
    actual.date_created,
    historicalSnapshot.get(pathname).date_created,
  );
  assert.notEqual(
    actual.date_updated,
    historicalSnapshot.get(pathname).date_updated,
  );
  assert.equal(
    actual.owner_extension,
    historicalSnapshot.get(pathname).owner_extension,
  );
}
for (const [pathname, item] of historicalSnapshot) {
  if (
    !LEGACY_FIXTURE_POSTS.some((post) => pathname === `/items/posts/${post.id}`)
  ) {
    assert.deepEqual(historicalItems.get(pathname), item);
  }
}
assert.deepEqual(migrated.files, migrated.snapshotBefore.files);
const archivedReplay = await runPreflight({
  items: historicalItems,
  args: [confirmation],
  allowMutations: true,
});
assert.equal(archivedReplay.failure, undefined);
assert.equal(archivedReplay.exitCode, 0);
assertUnchanged(archivedReplay, historicalItems);

const legacyOnlyPartial = structuredClone(records);
legacyOnlyPartial.delete(`/items/posts/${LEGACY_FIXTURE_POSTS[0].id}`);
const legacyUnconfirmed = await runPreflight({ items: legacyOnlyPartial });
assert.equal(legacyUnconfirmed.failure, undefined);
assert.equal(legacyUnconfirmed.exitCode, 1);
assertUnchanged(legacyUnconfirmed, legacyOnlyPartial);
const legacyRepaired = await runPreflight({
  items: legacyOnlyPartial,
  args: [confirmation],
  allowMutations: true,
});
assert.equal(legacyRepaired.failure, undefined);
assert.deepEqual(
  legacyRepaired.calls
    .filter((call) => call.method !== "GET" && call.method !== "DELETE")
    .map((call) => [call.method, call.pathname, call.payload.id]),
  [["POST", "/items/posts", LEGACY_FIXTURE_POSTS[0].id]],
);
for (const [pathname, item] of legacyRepaired.snapshotBefore.items) {
  assert.deepEqual(legacyOnlyPartial.get(pathname), item);
}
assert.deepEqual(legacyRepaired.files, legacyRepaired.snapshotBefore.files);
assert.ok(
  itemMatchesOwned(
    legacyOnlyPartial.get(`/items/posts/${LEGACY_FIXTURE_POSTS[0].id}`),
    LEGACY_FIXTURE_POSTS[0],
    POST_OWNED_FIELDS,
  ),
);

for (const originals of [LEGACY_FIXTURE_POSTS, legacyOriginals]) {
  for (const post of originals) {
    for (const field of POST_OWNED_FIELDS) {
      for (const partialCanonical of [false, true]) {
        const edited = structuredClone(records);
        const pathname = `/items/posts/${post.id}`;
        edited.set(pathname, {
          ...edited.get(pathname),
          ...post,
          [field]:
            typeof post[field] === "boolean"
              ? !post[field]
              : "Owner-private edit",
        });
        if (partialCanonical) edited.delete(`/items/posts/${featuredPost.id}`);
        const refused = await runPreflight({
          items: edited,
          args: [confirmation],
          allowMutations: true,
        });
        assert.match(
          refused.failure?.message ?? "",
          /owner-modified legacy post.*refused before mutation/,
          `${post.id}: ${field}, partial=${partialCanonical}`,
        );
        assert.ok(refused.failure.message.length < 180);
        assert.equal(
          refused.failure.message.includes("Owner-private edit"),
          false,
        );
        assertUnchanged(refused, edited);
      }
    }
  }
}

for (const post of legacyOriginals.slice(0, 2)) {
  const missingLegacyMedia = new Map([[`/items/posts/${post.id}`, post]]);
  const refused = await runPreflight({
    items: missingLegacyMedia,
    cover: null,
    args: [confirmation],
    allowMutations: true,
  });
  assert.match(
    refused.failure?.message ?? "",
    /owner-modified legacy post.*refused before mutation/,
  );
  assertUnchanged(refused, missingLegacyMedia);
}

const repairedItems = structuredClone(partialItems);
const repaired = await runPreflight({
  items: repairedItems,
  args: [confirmation],
  allowMutations: true,
});
assert.equal(repaired.failure, undefined);
assert.equal(repaired.exitCode, undefined);
assert.ok(
  repaired.calls.every((call) => call.method !== "PATCH"),
  "Repairing one missing post must not patch unchanged records or files",
);
for (const [pathname, item] of originalRecords) {
  assert.ok(repairedItems.has(pathname));
  if (pathname !== `/items/posts/${featuredPost.id}`) {
    assert.deepEqual(repairedItems.get(pathname), item);
  }
}
assert.equal(
  classifyRecordState(
    repairedItems.get(`/items/posts/${featuredPost.id}`),
    featuredPost,
    null,
    POST_OWNED_FIELDS,
  ),
  "exact_fixture",
);
const confirmedOwnerEdit = await runPreflight({
  items: editedPosts,
  args: [confirmation],
  allowMutations: true,
});
assert.match(
  confirmedOwnerEdit.failure?.message ?? "",
  /refused before mutation/,
);
assert.ok(confirmedOwnerEdit.calls.every((call) => call.method === "GET"));
const installedItems = new Map();
const installed = await runPreflight({
  items: installedItems,
  cover: null,
  args: [confirmation],
  allowMutations: true,
});
assert.equal(installed.failure, undefined);
const installedCover = [...installed.files.values()].find(
  (file) => file.title === coverFixture.title,
);
assert.ok(installedCover);
assert.notEqual(installedCover.id, EDITORIAL_IDS.cover);
const installedFixture = buildFixturePayloads({ coverId: installedCover.id });
assert.equal(
  installedItems.get(`/items/site_settings/${EDITORIAL_IDS.settings}`)
    .default_og_image,
  installedCover.id,
);
for (const post of installedFixture.posts) {
  assert.equal(
    classifyRecordState(
      installedItems.get(`/items/posts/${post.id}`),
      post,
      null,
      POST_OWNED_FIELDS,
    ),
    "exact_fixture",
  );
}
const installedAgain = await runPreflight({
  items: installedItems,
  cover: installedCover,
});
assert.equal(installedAgain.failure, undefined);
assert.equal(installedAgain.exitCode, 0);
const dryRun = await runPreflight({
  items: new Map(),
  cover: null,
  args: ["--dry-run"],
});
assert.equal(dryRun.failure, undefined);
assert.equal(dryRun.exitCode, 0);
assert.ok(
  dryRun.messages.some((message) =>
    message.includes("[DRY RUN] Preflight passed"),
  ),
);
assert.ok(
  unchanged.calls.every(
    (call) => call.pathname !== `/items/posts/${ownerPostId}`,
  ),
);
assert.deepEqual(records, originalRecords);

console.log("Seed installation preflight checks passed.");
