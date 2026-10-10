import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from "node:worker_threads";
import { IDS } from "../directus/constants.mjs";
import {
  EDITORIAL_IDS,
  LEGACY_FIXTURE_POSTS,
  buildLegacyFixtureOriginals,
} from "../directus/seed/content.mjs";
import {
  POST_OWNED_FIELDS,
  SETTINGS_OWNED_FIELDS,
  buildFixturePayloads,
  buildLaunchManifest,
  createStableDigest,
  itemMatchesOwned,
} from "../directus/seed/editorial.mjs";
import { loadSeedCoverFixture } from "../directus/seed/fixtures.mjs";

const targetOrigin = "http://launch-apply.invalid";
const baseLaunchTime = "2026-10-10T12:00:00.000Z";
const coverFixture = await loadSeedCoverFixture();
const manifest = buildLaunchManifest({
  baseLaunchTime,
  directusUrl: targetOrigin,
  coverId: EDITORIAL_IDS.cover,
});
const { manifestDigest, ...manifestPayload } = manifest;
const publishedAtMap = new Map(
  manifest.posts.map((post) => [post.id, post.published_at]),
);
const logicalFixture = buildFixturePayloads({ coverId: EDITORIAL_IDS.cover });
const canonicalPaths = [
  `/items/site_settings/${EDITORIAL_IDS.settings}`,
  ...logicalFixture.posts.map((post) => `/items/posts/${post.id}`),
  ...logicalFixture.topics.map((topic) => `/items/topics/${topic.id}`),
  ...logicalFixture.postTopics.map(
    (relation) => `/items/posts_topics/${relation.id}`,
  ),
];
const allowedItemPaths = new Set([
  ...canonicalPaths,
  ...LEGACY_FIXTURE_POSTS.map((post) => `/items/posts/${post.id}`),
]);
const ownerPostId = randomUUID();
const ownerFileId = randomUUID();
const settingsPath = `/items/site_settings/${EDITORIAL_IDS.settings}`;

function createState({ coverId = randomUUID(), seeded = true } = {}) {
  const items = new Map([
    [
      `/items/posts/${ownerPostId}`,
      {
        id: ownerPostId,
        status: "published",
        title: "Owner article",
        slug: "owner-article",
        body: "Preserve authored content",
        date_created: "2026-07-01T00:00:00.000Z",
        date_updated: "2026-08-01T00:00:00.000Z",
      },
    ],
  ]);
  const files = new Map([
    [
      ownerFileId,
      {
        id: ownerFileId,
        title: "Owner private original",
        folder: IDS.folders.private,
      },
    ],
  ]);
  if (coverId) {
    files.set(coverId, {
      id: coverId,
      title: coverFixture.title,
      folder: IDS.folders.publishable,
      type: coverFixture.mimeType,
      filename_download: coverFixture.filename,
    });
  }
  if (seeded) {
    assert.ok(coverId);
    const fixture = buildFixturePayloads({ coverId });
    const records = [
      ["site_settings", { ...fixture.settings, avatar: randomUUID() }],
      ...fixture.posts.map((post) => ["posts", post]),
      ...fixture.topics.map((topic) => ["topics", topic]),
      ...fixture.postTopics.map((relation) => ["posts_topics", relation]),
      ...LEGACY_FIXTURE_POSTS.map((post) => ["posts", post]),
    ];
    for (const [collection, item] of records) {
      items.set(`/items/${collection}/${item.id}`, {
        ...item,
        owner_extension: "Preserve this field",
        date_created: "2026-07-01T00:00:00.000Z",
        date_updated: "2026-08-01T00:00:00.000Z",
      });
    }
  }
  return { items, files, coverId, writeCount: 0 };
}

async function runLaunch(options) {
  // client.mjs captures DIRECTUS_URL on import; each invocation needs a fresh
  // module graph to exercise the endpoint that a real CLI process would use.
  const worker = new Worker(new URL(import.meta.url), { workerData: options });
  const result = await new Promise((resolve, reject) => {
    worker.once("message", resolve);
    worker.once("error", reject);
    worker.once("exit", (code) =>
      reject(
        new Error(`Offline launch worker exited without a result (${code})`),
      ),
    );
  });
  Object.assign(options.state, result.state);
  return result;
}

async function runLaunchInProcess({
  state,
  args,
  allowMutations = false,
  environment = {},
  expectedOrigin = targetOrigin,
}) {
  const originalFetch = globalThis.fetch;
  const originalExit = process.exit;
  const originalArgv = process.argv;
  const originalEnv = process.env;
  const originalLog = console.log;
  const originalError = console.error;
  const calls = [];
  const messages = [];
  const exitSignal = new Error("Offline launch exit");
  let exitCode;
  let failure;
  try {
    process.env = {
      DIRECTUS_URL: targetOrigin,
      ...(args[0] === "apply"
        ? { DIRECTUS_ADMIN_TOKEN: "offline-test-only" }
        : {}),
      ...environment,
    };
    process.argv = [process.execPath, "directus/launch.mjs", ...args];
    process.exit = (code) => {
      exitCode = code;
      throw exitSignal;
    };
    console.log = console.error = (message) => messages.push(message);
    globalThis.fetch = async (input, options) => {
      const method = options.method ?? "GET";
      const call = { method };
      calls.push(call);
      const url = new URL(input);
      Object.assign(call, { pathname: url.pathname, search: url.search });
      assert.equal(url.origin, expectedOrigin);
      if (url.pathname === "/auth/login") {
        assert.equal(method, "POST");
        assert.deepEqual(JSON.parse(options.body), {
          email: process.env.DIRECTUS_ADMIN_EMAIL,
          password: process.env.DIRECTUS_ADMIN_PASSWORD,
          mode: "json",
        });
        return Response.json({ data: { access_token: "offline-login-token" } });
      }
      if (method !== "GET") {
        assert.equal(
          allowMutations,
          true,
          "Preflight must not mutate CMS state",
        );
        state.writeCount += 1;
        const timestamp = new Date(
          Date.UTC(2026, 9, 10) + state.writeCount * 1000,
        ).toISOString();
        if (method === "POST" && url.pathname === "/files") {
          assert.ok(options.body instanceof FormData);
          assert.equal(options.body.get("title"), coverFixture.title);
          assert.equal(options.body.get("folder"), IDS.folders.publishable);
          const upload = options.body.get("file");
          assert.equal(upload.type, coverFixture.mimeType);
          assert.deepEqual(
            Buffer.from(await upload.arrayBuffer()),
            coverFixture.bytes,
          );
          const file = {
            id: randomUUID(),
            title: options.body.get("title"),
            folder: options.body.get("folder"),
            type: upload.type,
            filename_download: upload.name,
            date_created: timestamp,
          };
          state.files.set(file.id, file);
          state.coverId = file.id;
          return Response.json({ data: file });
        }
        const payload = JSON.parse(options.body);
        call.payload = payload;
        if (method === "PATCH" && url.pathname.startsWith("/files/")) {
          const fileId = url.pathname.split("/").at(-1);
          assert.equal(fileId, state.coverId);
          const file = {
            ...state.files.get(fileId),
            ...payload,
            date_updated: timestamp,
          };
          state.files.set(fileId, file);
          return Response.json({ data: file });
        }
        assert.ok(method === "POST" || method === "PATCH");
        const pathname =
          url.pathname === "/items/site_settings"
            ? settingsPath
            : method === "POST"
              ? `${url.pathname}/${payload.id}`
              : url.pathname;
        assert.ok(
          allowedItemPaths.has(pathname),
          "Must not write owner records",
        );
        assert.equal("date_created" in payload, false);
        assert.equal("date_updated" in payload, false);
        const existing = state.items.get(pathname);
        const item = {
          ...existing,
          ...payload,
          date_created: existing?.date_created ?? timestamp,
          date_updated: existing ? timestamp : null,
        };
        state.items.set(pathname, item);
        return Response.json({ data: item });
      }
      if (url.pathname === "/files") {
        assert.equal(
          url.searchParams.get("filter[title][_eq]"),
          coverFixture.title,
        );
        const fields = url.searchParams.get("fields");
        assert.ok(fields === "id" || fields === "*");
        const matches = [...state.files.values()].filter(
          (file) => file.title === coverFixture.title,
        );
        return Response.json({
          data:
            fields === "id"
              ? matches.map((file) => ({ id: file.id }))
              : matches,
        });
      }
      if (url.pathname === "/items/posts") {
        return Response.json({
          data: [...state.items.entries()]
            .filter(([pathname]) => pathname.startsWith("/items/posts/"))
            .map(([, item]) => item),
        });
      }
      const item = state.items.get(url.pathname);
      return item
        ? Response.json({ data: item })
        : Response.json(
            { errors: [{ message: "Not found" }] },
            { status: 404 },
          );
    };
    await import(`../directus/launch.mjs?offline=${randomUUID()}`);
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
  const writes = calls.filter(
    (call) => call.method !== "GET" && call.pathname !== "/auth/login",
  );
  if (!allowMutations) assert.equal(writes.length, 0);
  return { calls, writes, exitCode, failure, messages };
}

function assertAppliedIdentity(state, coverId) {
  assert.notEqual(coverId, EDITORIAL_IDS.cover);
  const desired = buildFixturePayloads({ coverId, publishedAtMap });
  assert.ok(
    itemMatchesOwned(
      state.items.get(settingsPath),
      desired.settings,
      SETTINGS_OWNED_FIELDS,
    ),
  );
  for (const post of desired.posts) {
    const actual = state.items.get(`/items/posts/${post.id}`);
    assert.ok(itemMatchesOwned(actual, post, POST_OWNED_FIELDS), post.slug);
    assert.equal(JSON.stringify(actual).includes(EDITORIAL_IDS.cover), false);
    for (const mediaRef of actual.body.matchAll(/directus:\/\/([a-f0-9-]+)/g)) {
      assert.equal(mediaRef[1], coverId);
    }
  }
}

async function testLaunch() {
  const directory = await mkdtemp(join(tmpdir(), "blog-launch-apply-"));
  try {
    const manifestPath = join(directory, "manifest.json");
    const plan = await runLaunch({
      state: createState({ coverId: null, seeded: false }),
      args: [
        "plan",
        `--output=${manifestPath}`,
        `--base-time=${baseLaunchTime}`,
      ],
    });
    assert.equal(plan.failure, undefined);
    assert.equal(
      plan.calls.length,
      0,
      "Plan must remain offline without CMS credentials",
    );
    const manifestContent = await readFile(manifestPath, "utf8");
    assert.deepEqual(JSON.parse(manifestContent), manifest);
    assert.equal((await stat(manifestPath)).mode & 0o777, 0o600);
    const confirmedArgs = [
      "apply",
      `--manifest=${manifestPath}`,
      `--confirm=CONFIRM_LAUNCH_${manifestDigest}_FOR_${targetOrigin}`,
    ];

    const seeded = createState();
    const originalSeed = structuredClone(seeded);
    const launched = await runLaunch({
      state: seeded,
      args: confirmedArgs,
      allowMutations: true,
    });
    assert.equal(launched.failure, undefined);
    assert.equal(launched.exitCode, undefined);
    assert.ok(launched.messages.includes("Status:          SUCCESS"));
    assert.equal(launched.writes.length, logicalFixture.posts.length);
    assert.ok(
      launched.writes.every(
        (call) =>
          call.method === "PATCH" &&
          logicalFixture.posts.some(
            (post) => call.pathname === `/items/posts/${post.id}`,
          ),
      ),
    );
    assert.equal(launched.calls[0].pathname, "/files");
    assert.equal(
      new URLSearchParams(launched.calls[0].search).get("fields"),
      "id",
    );
    const preflightCalls = launched.calls.slice(
      0,
      launched.calls.findIndex((call) => call.method !== "GET"),
    );
    for (const pathname of allowedItemPaths) {
      assert.ok(
        preflightCalls.some((call) => call.pathname === pathname),
        `Classify ${pathname} before mutation`,
      );
    }
    assertAppliedIdentity(seeded, seeded.coverId);
    assert.deepEqual(seeded.files, originalSeed.files);
    assert.equal(
      seeded.items.get(settingsPath).avatar,
      originalSeed.items.get(settingsPath).avatar,
    );
    for (const pathname of originalSeed.items.keys()) {
      assert.equal(
        seeded.items.get(pathname).date_created,
        originalSeed.items.get(pathname).date_created,
      );
      assert.equal(
        seeded.items.get(pathname).owner_extension,
        originalSeed.items.get(pathname).owner_extension,
      );
    }
    assert.deepEqual(
      seeded.items.get(`/items/posts/${ownerPostId}`),
      originalSeed.items.get(`/items/posts/${ownerPostId}`),
    );
    const launchedSnapshot = structuredClone(seeded);
    const repeated = await runLaunch({ state: seeded, args: confirmedArgs });
    assert.equal(repeated.failure, undefined);
    assert.equal(repeated.writes.length, 0);
    assert.deepEqual(
      seeded,
      launchedSnapshot,
      "Reapply must preserve all timestamps and data",
    );

    const legacyOriginals = buildLegacyFixtureOriginals({
      coverId: seeded.coverId,
    });
    const historical = structuredClone(seeded);
    for (const post of legacyOriginals) {
      const pathname = `/items/posts/${post.id}`;
      historical.items.set(pathname, {
        ...historical.items.get(pathname),
        ...post,
      });
    }
    const historicalSnapshot = structuredClone(historical);
    const migrated = await runLaunch({
      state: historical,
      args: confirmedArgs,
      allowMutations: true,
    });
    assert.equal(migrated.failure, undefined);
    assert.deepEqual(
      migrated.writes.map((call) => [call.method, call.pathname]),
      LEGACY_FIXTURE_POSTS.map((post) => ["PATCH", `/items/posts/${post.id}`]),
      "Historical migration must patch only the four recognized legacy rows",
    );
    for (const post of LEGACY_FIXTURE_POSTS) {
      const pathname = `/items/posts/${post.id}`;
      const actual = historical.items.get(pathname);
      const original = historicalSnapshot.items.get(pathname);
      assert.ok(itemMatchesOwned(actual, post, POST_OWNED_FIELDS));
      assert.equal(actual.date_created, original.date_created);
      assert.notEqual(actual.date_updated, original.date_updated);
      assert.equal(actual.owner_extension, original.owner_extension);
    }
    for (const [pathname, item] of historicalSnapshot.items) {
      if (
        !LEGACY_FIXTURE_POSTS.some(
          (post) => pathname === `/items/posts/${post.id}`,
        )
      ) {
        assert.deepEqual(historical.items.get(pathname), item);
      }
    }
    assert.deepEqual(historical.files, historicalSnapshot.files);
    const archivedSnapshot = structuredClone(historical);
    const archivedReplay = await runLaunch({
      state: historical,
      args: confirmedArgs,
    });
    assert.equal(archivedReplay.failure, undefined);
    assert.equal(archivedReplay.writes.length, 0);
    assert.deepEqual(historical, archivedSnapshot);

    const legacyOnlyPartial = structuredClone(seeded);
    legacyOnlyPartial.items.delete(
      `/items/posts/${LEGACY_FIXTURE_POSTS[0].id}`,
    );
    const legacyPartialSnapshot = structuredClone(legacyOnlyPartial);
    const legacyRepaired = await runLaunch({
      state: legacyOnlyPartial,
      args: confirmedArgs,
      allowMutations: true,
    });
    assert.equal(legacyRepaired.failure, undefined);
    assert.equal(legacyRepaired.writes.length, 1);
    assert.equal(legacyRepaired.writes[0].method, "POST");
    assert.equal(legacyRepaired.writes[0].pathname, "/items/posts");
    assert.equal(
      legacyRepaired.writes[0].payload.id,
      LEGACY_FIXTURE_POSTS[0].id,
    );
    assert.ok(
      itemMatchesOwned(
        legacyOnlyPartial.items.get(
          `/items/posts/${LEGACY_FIXTURE_POSTS[0].id}`,
        ),
        LEGACY_FIXTURE_POSTS[0],
        POST_OWNED_FIELDS,
      ),
    );
    for (const [pathname, item] of legacyPartialSnapshot.items) {
      assert.deepEqual(legacyOnlyPartial.items.get(pathname), item);
    }
    assert.deepEqual(legacyOnlyPartial.files, legacyPartialSnapshot.files);

    const fresh = createState({ coverId: null, seeded: false });
    const originalFresh = structuredClone(fresh);
    const installed = await runLaunch({
      state: fresh,
      args: confirmedArgs,
      allowMutations: true,
    });
    assert.equal(installed.failure, undefined);
    assert.equal(
      installed.writes.filter(
        (call) => call.method === "POST" && call.pathname === "/files",
      ).length,
      1,
    );
    assertAppliedIdentity(fresh, fresh.coverId);
    assert.deepEqual(
      fresh.items.get(`/items/posts/${ownerPostId}`),
      originalFresh.items.get(`/items/posts/${ownerPostId}`),
    );
    assert.deepEqual(
      fresh.files.get(ownerFileId),
      originalFresh.files.get(ownerFileId),
    );
    const installedSnapshot = structuredClone(fresh);
    const freshRepeated = await runLaunch({
      state: fresh,
      args: confirmedArgs,
    });
    assert.equal(freshRepeated.failure, undefined);
    assert.equal(freshRepeated.writes.length, 0);
    assert.deepEqual(fresh, installedSnapshot);

    async function argsForTarget(origin, confirmationOrigin = targetOrigin) {
      const payload = { ...manifestPayload, targetOrigin: origin };
      const digest = createStableDigest(payload);
      const path = join(directory, `target-${randomUUID()}.json`);
      await writeFile(
        path,
        JSON.stringify({ ...payload, manifestDigest: digest }),
      );
      return [
        "apply",
        `--manifest=${path}`,
        `--confirm=CONFIRM_LAUNCH_${digest}_FOR_${confirmationOrigin}`,
      ];
    }

    const credentialModes = [
      {},
      {
        DIRECTUS_ADMIN_TOKEN: undefined,
        DIRECTUS_ADMIN_EMAIL: "offline-login@example.invalid",
        DIRECTUS_ADMIN_PASSWORD: "offline-login-password",
      },
    ];
    const mismatch =
      /DIRECTUS_URL origin does not match the manifest target origin/;
    const invalidEndpoint = /DIRECTUS_URL.*valid absolute HTTP\(S\) URL/;
    const invalidTarget = /manifest targetOrigin.*valid absolute HTTP\(S\) URL/;

    async function assertTargetRefused(args, environment, pattern) {
      const state = createState();
      const snapshot = structuredClone(state);
      const result = await runLaunch({ state, args, environment });
      assert.match(result.failure?.message ?? "", pattern);
      assert.equal(
        result.calls.length,
        0,
        "Target refusal must precede authentication and every CMS request",
      );
      assert.deepEqual(
        state,
        snapshot,
        "Target refusal must preserve CMS state",
      );
      assert.ok(result.failure.message.length < 180, "Keep errors bounded");
      const diagnostic = [result.failure.stack, ...result.messages].join("\n");
      for (const secret of [
        "offline-test-only",
        "offline-login@example.invalid",
        "offline-login-password",
        "url-user",
        "url-password",
        "url-token",
        "other.invalid",
      ]) {
        assert.equal(
          diagnostic.includes(secret),
          false,
          "Do not echo URL/secrets",
        );
      }
    }

    const rejectedEndpoints = [
      ["http://other.invalid", mismatch],
      ["http://launch-apply.invalid:8055", mismatch],
      ["https://launch-apply.invalid", mismatch],
      [
        "http://url-user:url-password@other.invalid/private?token=url-token",
        invalidEndpoint,
      ],
      [
        "http://url-user:url-password@launch-apply.invalid/private?token=url-token",
        invalidEndpoint,
      ],
      ["http://url-user@launch-apply.invalid", invalidEndpoint],
      ["http://:url-password@launch-apply.invalid", invalidEndpoint],
      [
        "http://url-user:url-password@[/private?token=url-token",
        invalidEndpoint,
      ],
      ["/private?token=url-token", invalidEndpoint],
      [
        "ftp://url-user:url-password@launch-apply.invalid/private",
        invalidEndpoint,
      ],
      ["file:///private?token=url-token", invalidEndpoint],
      [undefined, mismatch],
      ["", mismatch],
    ];
    for (const credentials of credentialModes) {
      for (const [url, pattern] of rejectedEndpoints) {
        await assertTargetRefused(
          confirmedArgs,
          { ...credentials, DIRECTUS_URL: url },
          pattern,
        );
      }
    }

    const rejectedTargets = [
      ["http://other.invalid", mismatch],
      ["http://launch-apply.invalid:8055", mismatch],
      ["https://launch-apply.invalid", mismatch],
      [
        "http://url-user:url-password@launch-apply.invalid/private?token=url-token",
        invalidTarget,
      ],
      ["http://url-user@launch-apply.invalid", invalidTarget],
      ["http://:url-password@launch-apply.invalid", invalidTarget],
      ["http://url-user:url-password@[/private?token=url-token", invalidTarget],
      ["/private?token=url-token", invalidTarget],
      [
        "ftp://url-user:url-password@launch-apply.invalid/private",
        invalidTarget,
      ],
      ["file:///private?token=url-token", invalidTarget],
      [null, invalidTarget],
      [8055, invalidTarget],
    ];
    for (const [origin, pattern] of rejectedTargets) {
      const args = await argsForTarget(origin);
      for (const credentials of credentialModes) {
        await assertTargetRefused(args, credentials, pattern);
      }
    }

    const equivalentTargets = [
      {
        origin: targetOrigin,
        url: "HTTP://LAUNCH-APPLY.INVALID:80/",
        expectedOrigin: targetOrigin,
      },
      {
        origin: "HTTP://LAUNCH-APPLY.INVALID:80/",
        url: targetOrigin,
        expectedOrigin: targetOrigin,
      },
      {
        origin: "https://launch-apply.invalid",
        url: "HTTPS://LAUNCH-APPLY.INVALID:443/",
        expectedOrigin: "https://launch-apply.invalid",
      },
      {
        origin: "http://127.0.0.1:8055",
        url: undefined,
        expectedOrigin: "http://127.0.0.1:8055",
      },
    ];
    for (const { origin, url, expectedOrigin } of equivalentTargets) {
      const args = await argsForTarget(origin, expectedOrigin);
      for (const credentials of credentialModes) {
        const state = structuredClone(seeded);
        const snapshot = structuredClone(state);
        const result = await runLaunch({
          state,
          args,
          environment: { ...credentials, DIRECTUS_URL: url },
          expectedOrigin,
        });
        assert.equal(result.failure, undefined);
        assert.equal(result.exitCode, undefined);
        assert.ok(result.messages.includes("Status:          SUCCESS"));
        assert.ok(result.calls.some((call) => call.pathname === "/files"));
        const loginCalls = result.calls.filter(
          (call) => call.pathname === "/auth/login",
        );
        assert.equal(
          loginCalls.length,
          credentials.DIRECTUS_ADMIN_EMAIL ? 1 : 0,
        );
        if (loginCalls.length) assert.equal(result.calls[0], loginCalls[0]);
        assert.equal(result.writes.length, 0);
        assert.deepEqual(state, snapshot);
        assertAppliedIdentity(state, state.coverId);
      }
    }

    async function assertRefused(state, pattern) {
      const snapshot = structuredClone(state);
      const result = await runLaunch({ state, args: confirmedArgs });
      assert.match(result.failure?.message ?? "", pattern);
      assert.equal(result.writes.length, 0);
      assert.deepEqual(state, snapshot);
      return result;
    }

    const featuredPost = logicalFixture.posts.find((post) => post.featured);
    assert.ok(featuredPost);
    const featuredPath = `/items/posts/${featuredPost.id}`;
    for (const originals of [LEGACY_FIXTURE_POSTS, legacyOriginals]) {
      for (const post of originals) {
        for (const field of POST_OWNED_FIELDS) {
          for (const partialCanonical of [false, true]) {
            const edited = structuredClone(seeded);
            const pathname = `/items/posts/${post.id}`;
            edited.items.set(pathname, {
              ...edited.items.get(pathname),
              ...post,
              [field]:
                typeof post[field] === "boolean"
                  ? !post[field]
                  : "Owner-private edit",
            });
            if (partialCanonical) edited.items.delete(featuredPath);
            const refused = await assertRefused(
              edited,
              /legacy post .* contains owner-modified content.*aborted before mutation/,
            );
            assert.ok(refused.failure.message.length < 180);
            assert.equal(
              refused.failure.message.includes("Owner-private edit"),
              false,
            );
          }
        }
      }
    }
    for (const post of legacyOriginals.slice(0, 2)) {
      const missingLegacyMedia = createState({ coverId: null, seeded: false });
      missingLegacyMedia.items.set(`/items/posts/${post.id}`, post);
      await assertRefused(
        missingLegacyMedia,
        /legacy post .* contains owner-modified content.*aborted before mutation/,
      );
    }

    for (const field of SETTINGS_OWNED_FIELDS) {
      const edited = structuredClone(seeded);
      edited.items.set(settingsPath, {
        ...edited.items.get(settingsPath),
        [field]: field === "default_og_image" ? randomUUID() : "Owner edit",
      });
      await assertRefused(
        edited,
        /site_settings contains owner-modified content.*aborted before mutation/,
      );
    }
    for (const field of ["body", "title", "cover_image"]) {
      const edited = structuredClone(seeded);
      edited.items.set(featuredPath, {
        ...edited.items.get(featuredPath),
        [field]:
          field === "cover_image" ? randomUUID() : "Owner-authored content",
      });
      await assertRefused(
        edited,
        /post .* contains owner-modified content.*aborted before mutation/,
      );
    }
    const editedRelation = structuredClone(seeded);
    const relationPath = `/items/posts_topics/${logicalFixture.postTopics[0].id}`;
    editedRelation.items.set(relationPath, {
      ...editedRelation.items.get(relationPath),
      topics_id: randomUUID(),
    });
    await assertRefused(
      editedRelation,
      /posts_topics relation .*owner-modified content.*aborted before mutation/,
    );
    const missingMedia = structuredClone(seeded);
    missingMedia.files.delete(missingMedia.coverId);
    await assertRefused(
      missingMedia,
      /site_settings contains owner-modified content.*aborted before mutation/,
    );
    const partialMedia = createState({ coverId: null, seeded: false });
    partialMedia.items.set(
      featuredPath,
      structuredClone(seeded.items.get(featuredPath)),
    );
    await assertRefused(
      partialMedia,
      /post .* contains owner-modified content.*aborted before mutation/,
    );
    const partialTopic = createState({ coverId: null, seeded: false });
    const topicPath = `/items/topics/${logicalFixture.topics[0].id}`;
    partialTopic.items.set(
      topicPath,
      structuredClone(seeded.items.get(topicPath)),
    );
    await assertRefused(
      partialTopic,
      /topic .* contains owner-modified content.*aborted before mutation/,
    );
    const replacedMedia = structuredClone(seeded);
    const replacementId = randomUUID();
    const replacedFile = replacedMedia.files.get(replacedMedia.coverId);
    replacedMedia.files.delete(replacedMedia.coverId);
    replacedMedia.files.set(replacementId, {
      ...replacedFile,
      id: replacementId,
    });
    await assertRefused(
      replacedMedia,
      /site_settings contains owner-modified content.*aborted before mutation/,
    );

    const changedAvatar = structuredClone(seeded);
    changedAvatar.items.get(settingsPath).avatar = randomUUID();
    const avatarSnapshot = structuredClone(changedAvatar);
    const avatarApplied = await runLaunch({
      state: changedAvatar,
      args: confirmedArgs,
    });
    assert.equal(avatarApplied.failure, undefined);
    assert.deepEqual(changedAvatar, avatarSnapshot);
    const partial = structuredClone(seeded);
    partial.items.delete(featuredPath);
    const repaired = await runLaunch({
      state: partial,
      args: confirmedArgs,
      allowMutations: true,
    });
    assert.equal(repaired.failure, undefined);
    assert.equal(repaired.writes.length, 1);
    assert.equal(repaired.writes[0].method, "POST");
    assert.equal(repaired.writes[0].pathname, "/items/posts");
    assertAppliedIdentity(partial, partial.coverId);

    const badManifestPath = join(directory, "bad-manifest.json");
    await writeFile(
      badManifestPath,
      JSON.stringify({ ...manifest, baseLaunchTime: "Owner edit" }),
    );
    const badDigest = await runLaunch({
      state: seeded,
      args: ["apply", `--manifest=${badManifestPath}`, confirmedArgs[2]],
    });
    assert.match(badDigest.failure?.message ?? "", /Manifest digest mismatch/);
    assert.equal(badDigest.calls.length, 0);
    for (const confirmation of [undefined, "--confirm=wrong"]) {
      const unconfirmed = await runLaunch({
        state: seeded,
        args: [
          "apply",
          `--manifest=${manifestPath}`,
          ...(confirmation ? [confirmation] : []),
        ],
      });
      assert.equal(unconfirmed.failure, undefined);
      assert.equal(unconfirmed.exitCode, 1);
      assert.equal(unconfirmed.calls.length, 0);
      assert.ok(
        unconfirmed.messages.some((message) =>
          message.includes("requires explicit confirmation"),
        ),
      );
    }
    assert.deepEqual(seeded, launchedSnapshot);
    assert.equal(await readFile(manifestPath, "utf8"), manifestContent);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  console.log("Launch apply target, media identity and replay checks passed.");
}

if (isMainThread) {
  await testLaunch();
} else {
  const result = await runLaunchInProcess(workerData);
  parentPort.postMessage({ ...result, state: workerData.state });
}
