import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspect } from "node:util";
import { IDS } from "../../directus/constants.mjs";
import { buildSnapshot, loadFromDirectus } from "./directus.js";
import { normalizeDirectusUrl, readBuildEnvironment } from "./env.js";
import { FIXTURE_ROWS } from "./fixture.js";
import {
  materializePublicMedia,
  MEDIA_FILE_LIMIT,
  MEDIA_TOTAL_LIMIT,
} from "./media.js";
import { mediaPaths, resetGeneratedMedia } from "./media-files.js";

const root = await mkdtemp(join(tmpdir(), "blog-public-media-"));
const paths = mediaPaths(root);
const credentials = {
  url: "https://cms.test",
  token: "actual-build-token-do-not-log-1234",
};
const fileId = "33333333-3333-4333-8333-333333333333";
const otherId = "44444444-4444-4444-8444-444444444444";
const original = await readFile(
  new URL(
    "../../directus/seed/assets/ai-reliability-boundaries-960.webp",
    import.meta.url,
  ),
);
const expectedPath = `/_cms/${createHash("sha256").update(original).digest("hex")}.webp`;
const metadata = {
  id: fileId,
  folder: IDS.folders.publishable,
  type: "image/webp",
  filesize: String(original.length),
};
const body = [
  "# Public images",
  `![Directus](directus://${fileId} "A quoted title")`,
  `![Relative](/assets/${fileId}/cosmetic.webp)`,
  `![Absolute](https://cms.test/assets/${fileId})`,
  "![Local](/avatar.svg)",
  "![External](https://external.test/image.png)",
  `\`![Literal](directus://${otherId})\``,
  "```md",
  `![Code](directus://${otherId})`,
  "```",
  `\\![Escaped](directus://${otherId})`,
].join("\n");
const publicRow = {
  ...FIXTURE_ROWS.posts[0]!,
  body,
  cover_image: fileId,
  summary: null,
};
const rows = {
  ...FIXTURE_ROWS,
  posts: [publicRow],
  settings: { ...FIXTURE_ROWS.settings, avatar: fileId },
};
type Call = { path: string; search: string; options?: RequestInit };
let calls: Call[] = [];
let metadataResponse: (
  id: string,
  count: number,
) => Response | Promise<Response> = (id) =>
  Response.json({ data: { ...metadata, id } });
let originalResponse: () => Response = () =>
  new Response(original, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(original.length),
    },
  });
let currentRows: Omit<typeof rows, "posts"> & { posts: unknown[] } = rows;
const originalFetch = globalThis.fetch;
const counts = new Map<string, number>();
globalThis.fetch = async (input, options) => {
  const url = new URL(String(input));
  calls.push({ path: url.pathname, search: url.search, options });
  assert.equal(
    url.origin,
    credentials.url,
    "Only configured CMS may receive the build token",
  );
  assert.equal(
    new Headers(options?.headers).get("Authorization"),
    `Bearer ${credentials.token}`,
  );
  assert.equal(options?.redirect, "error");
  assert.ok(options?.signal);
  assert.equal(url.searchParams.has("access_token"), false);
  if (url.pathname.startsWith("/files/")) {
    assert.equal(url.searchParams.get("fields"), "id,folder,type,filesize");
    const id = url.pathname.split("/").at(-1)!;
    const count = (counts.get(id) ?? 0) + 1;
    counts.set(id, count);
    return metadataResponse(id, count);
  }
  if (url.pathname.startsWith("/assets/")) {
    assert.equal(url.pathname, `/assets/${url.pathname.split("/").at(-1)}`);
    assert.equal(url.search, "");
    return originalResponse();
  }
  const content: Record<string, unknown> = {
    "/items/posts": currentRows.posts,
    "/items/categories": currentRows.categories,
    "/items/tags": currentRows.tags,
    "/items/series": currentRows.series,
    "/items/site_settings": currentRows.settings,
    "/items/social_links": currentRows.socialLinks,
  };
  assert.ok(url.pathname in content);
  return Response.json({ data: content[url.pathname] });
};

async function reset() {
  await resetGeneratedMedia(paths);
  calls = [];
  counts.clear();
  currentRows = rows;
  metadataResponse = (id) => Response.json({ data: { ...metadata, id } });
  originalResponse = () =>
    new Response(original, {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(original.length),
      },
    });
}
async function refused({ beforeBytes = false, timeoutMs = 1000 } = {}) {
  await assert.rejects(
    loadFromDirectus(credentials, { paths, timeoutMs }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(
        error.message,
        "[directus] Failed to load the published build snapshot from Directus",
      );
      assert.equal(inspect(error).includes(credentials.token), false);
      assert.equal(inspect(error).includes(credentials.url), false);
      return true;
    },
  );
  if (beforeBytes)
    assert.equal(
      calls.filter((call) => call.path.startsWith("/assets/")).length,
      0,
    );
  assert.deepEqual(await readdir(paths.output), []);
  assert.deepEqual(await readdir(paths.staging), []);
}

try {
  await mkdir(paths.public);
  await reset();
  const snapshot = await loadFromDirectus(credentials, { paths });
  const post = snapshot.posts[0]!;
  const baseline = buildSnapshot(rows, credentials.url).posts[0]!;
  assert.equal(post.cover, expectedPath);
  assert.equal(snapshot.profile.avatar, expectedPath);
  assert.equal(post.content.match(new RegExp(expectedPath, "g"))?.length, 3);
  assert.ok(post.content.includes('"A quoted title"'));
  assert.ok(post.content.includes("![Local](/avatar.svg)"));
  assert.ok(post.content.includes("https://external.test/image.png"));
  assert.ok(post.content.includes(`directus://${otherId}`));
  assert.equal(post.wordCount, baseline.wordCount);
  assert.equal(post.readingMinutes, baseline.readingMinutes);
  assert.equal(post.summary, baseline.summary);
  assert.deepEqual(
    calls
      .filter((call) => call.path.startsWith("/files/"))
      .map((call) => call.path),
    [`/files/${fileId}`, `/files/${fileId}`],
  );
  assert.equal(
    calls.filter((call) => call.path.startsWith("/assets/")).length,
    1,
  );
  assert.deepEqual(await readdir(paths.output), [
    expectedPath.split("/").at(-1),
  ]);
  assert.deepEqual(
    await readFile(join(paths.output, expectedPath.split("/").at(-1)!)),
    original,
  );

  await reset();
  currentRows = { ...rows, settings: { ...rows.settings, avatar: otherId } };
  const identical = await loadFromDirectus(credentials, { paths });
  assert.equal(identical.profile.avatar, identical.posts[0]!.cover);
  assert.equal(
    calls.filter((call) => call.path.startsWith("/assets/")).length,
    2,
  );
  assert.deepEqual(await readdir(paths.output), [
    expectedPath.split("/").at(-1),
  ]);
  const mediaEvents = calls.filter((call) =>
    /^\/(files|assets)\//.test(call.path),
  );
  assert.deepEqual(
    mediaEvents.slice(0, 2).map((call) => call.path),
    [`/files/${otherId}`, `/files/${fileId}`],
  );

  await reset();
  currentRows = {
    ...rows,
    posts: [
      {
        ...publicRow,
        cover_image: null,
        body: `![Local](authored/photo.png)\n![External](https://cms.test.evil/assets/${otherId})\nPlain example: directus://${otherId}`,
      },
    ],
    settings: { ...rows.settings, avatar: "/avatar.svg" },
  };
  const untouched = await loadFromDirectus(credentials, { paths });
  assert.equal(untouched.profile.avatar, "/avatar.svg");
  assert.ok(
    untouched.posts[0]!.content.includes("https://cms.test.evil/assets/"),
  );
  assert.equal(
    calls.some((call) => /^\/(files|assets)\//.test(call.path)),
    false,
  );
  assert.deepEqual(await readdir(paths.output), []);

  for (const field of [
    { status: "draft" },
    { status: "archived" },
    { kind: "note" },
  ]) {
    await reset();
    // Exercise unexpected transport rows, not only a direct schema predicate.
    currentRows = {
      ...rows,
      posts: [{ ...publicRow, ...field }],
    };
    await refused({ beforeBytes: true });
    assert.equal(
      calls.some((call) => call.path.startsWith("/files/")),
      false,
    );
  }
  for (const relation of ["not-a-uuid", "javascript:alert(1)"]) {
    await reset();
    currentRows = { ...rows, posts: [{ ...publicRow, cover_image: relation }] };
    await refused({ beforeBytes: true });
    await reset();
    currentRows = { ...rows, settings: { ...rows.settings, avatar: relation } };
    await refused({ beforeBytes: true });
  }

  for (const changed of [
    { folder: IDS.folders.private },
    { folder: null },
    { folder: "another-folder" },
    { id: otherId },
    { type: "image/svg+xml" },
    { filesize: 0 },
    { filesize: -1 },
    { filesize: 1.5 },
    { filesize: "1.5" },
    { filesize: "9007199254740993" },
    { filesize: MEDIA_FILE_LIMIT + 1 },
  ]) {
    await reset();
    metadataResponse = () =>
      Response.json({ data: { ...metadata, ...changed } });
    await refused({ beforeBytes: true });
  }
  for (const status of [403, 404, 302]) {
    await reset();
    metadataResponse = () => new Response(null, { status });
    await refused({ beforeBytes: true });
  }
  await reset();
  currentRows = { ...rows, posts: [{ ...publicRow, cover_image: otherId }] };
  metadataResponse = (id) =>
    Response.json({
      data: {
        ...metadata,
        id,
        folder: id === otherId ? IDS.folders.private : IDS.folders.publishable,
      },
    });
  await refused({ beforeBytes: true });

  await reset();
  metadataResponse = () => new Promise(() => {});
  await refused({ beforeBytes: true, timeoutMs: 20 });

  const invalidSources = [
    `directus://${fileId}?access_token=do-not-copy`,
    `directus://not-a-uuid`,
    `/assets/${fileId}?width=20`,
    `/assets/${fileId}/../secret`,
    `https://cms.test/assets/${fileId}?access_token=do-not-copy`,
    `https://url-user:url-password@cms.test/assets/${fileId}`,
    `https://cms.test/assets/../${fileId}`,
    `https://cms.test/assets/%2e%2e/${fileId}`,
    `//cms.test/assets/${fileId}`,
  ];
  for (const source of invalidSources) {
    await reset();
    currentRows = {
      ...rows,
      posts: [{ ...publicRow, body: `![Invalid](${source})` }],
    };
    await refused({ beforeBytes: true });
  }
  for (const unsupported of [
    `<img src="directus://${fileId}">`,
    `![Reference][cover]\n\n[cover]: directus://${fileId}`,
  ]) {
    await reset();
    currentRows = { ...rows, posts: [{ ...publicRow, body: unsupported }] };
    await refused({ beforeBytes: true });
  }

  for (const response of [
    () => new Response(original, { headers: { "Content-Type": "text/html" } }),
    () =>
      new Response(Buffer.alloc(original.length, 0x3c), {
        headers: { "Content-Type": "image/webp" },
      }),
    () =>
      new Response(original, {
        headers: {
          "Content-Type": "image/webp",
          "Content-Length": String(original.length + 1),
        },
      }),
    () =>
      new Response(original.subarray(0, -1), {
        headers: { "Content-Type": "image/webp" },
      }),
    () =>
      new Response(Buffer.concat([original, Buffer.from([0])]), {
        headers: { "Content-Type": "image/webp" },
      }),
    () =>
      new Response(null, {
        status: 302,
        headers: { Location: "https://external.test/secret" },
      }),
  ]) {
    await reset();
    originalResponse = response;
    await refused();
  }
  await reset();
  metadataResponse = (id, count) =>
    Response.json({
      data: {
        ...metadata,
        id,
        folder: count > 1 ? IDS.folders.private : IDS.folders.publishable,
      },
    });
  await refused();

  // High-bit bytes must not be normalized into ASCII raster magic.
  for (const type of ["image/webp", "image/gif", "image/avif"]) {
    await reset();
    const spoof =
      type === "image/webp"
        ? Buffer.from(original)
        : type === "image/gif"
          ? Buffer.from("GIF89a-fake")
          : Buffer.alloc(24);
    if (type === "image/avif") {
      spoof.writeUInt32BE(24, 0);
      spoof.write("ftyp", 4);
      spoof.write("avif", 8);
      spoof.write("avif", 16);
    }
    const offset = type === "image/avif" ? 4 : 0;
    spoof[offset] = spoof[offset]! | 0x80;
    metadataResponse = (id) =>
      Response.json({
        data: { ...metadata, id, type, filesize: spoof.length },
      });
    originalResponse = () =>
      new Response(spoof, { headers: { "Content-Type": type } });
    await refused();
  }
  await reset();
  metadataResponse = (id, count) =>
    Response.json({
      data: {
        ...metadata,
        id,
        filesize: count > 1 ? original.length + 1 : original.length,
      },
    });
  await refused();

  await reset();
  let cancelled = false;
  let chunks = 0;
  originalResponse = () =>
    new Response(
      new ReadableStream({
        pull(controller) {
          chunks += 1;
          controller.enqueue(new Uint8Array(MEDIA_FILE_LIMIT));
        },
        cancel() {
          cancelled = true;
        },
      }),
      { headers: { "Content-Type": "image/webp" } },
    );
  await refused();
  assert.equal(cancelled, true);
  assert.ok(
    chunks <= 2,
    "Stop a stream before buffering the unbounded response",
  );

  await reset();
  originalResponse = () =>
    new Response(
      new ReadableStream({
        pull() {
          return new Promise(() => {});
        },
      }),
      { headers: { "Content-Type": "image/webp" } },
    );
  await refused({ timeoutMs: 20 });

  await reset();
  currentRows = {
    ...rows,
    posts: Array.from({ length: 6 }, (_, i) => ({
      ...publicRow,
      body: "No body images",
      cover_image: `55555555-5555-4555-8555-${String(i).padStart(12, "0")}`,
    })),
    settings: { ...rows.settings, avatar: "/avatar.svg" },
  };
  metadataResponse = (id) =>
    Response.json({ data: { ...metadata, id, filesize: MEDIA_FILE_LIMIT } });
  assert.ok(6 * MEDIA_FILE_LIMIT > MEDIA_TOTAL_LIMIT);
  await refused({ beforeBytes: true });

  await reset();
  const concurrent = await Promise.all(
    Array.from({ length: 4 }, () =>
      materializePublicMedia(
        { posts: rows.posts, avatar: rows.settings.avatar },
        credentials,
        { paths },
      ),
    ),
  );
  assert.ok(
    concurrent.every((media) => media.resolve(fileId) === expectedPath),
  );
  assert.deepEqual(await readdir(paths.output), [
    expectedPath.split("/").at(-1),
  ]);
  assert.deepEqual(await readdir(paths.staging), []);
  assert.deepEqual(
    await readFile(join(paths.output, expectedPath.split("/").at(-1)!)),
    original,
  );

  // AVIF major/compatible brands are accepted, unrelated BMFF is refused.
  for (const major of ["avif", "mif1"]) {
    await reset();
    const avif = Buffer.alloc(24);
    avif.writeUInt32BE(24, 0);
    avif.write("ftyp", 4);
    avif.write(major, 8);
    avif.write("avif", 16);
    avif.write("mif1", 20);
    metadataResponse = (id) =>
      Response.json({
        data: { ...metadata, id, type: "image/avif", filesize: avif.length },
      });
    originalResponse = () =>
      new Response(avif, { headers: { "Content-Type": "image/avif" } });
    const image = await materializePublicMedia(
      { posts: [{ body: "", cover_image: fileId }], avatar: null },
      credentials,
      { paths },
    );
    assert.match(image.resolve(fileId), /^\/_cms\/[a-f0-9]{64}\.avif$/);
    await resetGeneratedMedia(paths);
    avif.write("heic", 8);
    avif.write("heic", 16);
    await assert.rejects(
      materializePublicMedia(
        { posts: [{ body: "", cover_image: fileId }], avatar: null },
        credentials,
        { paths },
      ),
    );
    assert.deepEqual(await readdir(paths.output), []);
  }

  await reset();
  const extendedAvif = Buffer.alloc(32);
  extendedAvif.writeUInt32BE(1, 0);
  extendedAvif.write("ftyp", 4);
  extendedAvif.writeBigUInt64BE(32n, 8);
  extendedAvif.write("mif1", 16);
  extendedAvif.write("avis", 24);
  extendedAvif.write("mif1", 28);
  metadataResponse = (id) =>
    Response.json({
      data: {
        ...metadata,
        id,
        type: "image/avif",
        filesize: extendedAvif.length,
      },
    });
  originalResponse = () =>
    new Response(extendedAvif, { headers: { "Content-Type": "image/avif" } });
  assert.match(
    (
      await materializePublicMedia(
        { posts: [{ body: "", cover_image: fileId }], avatar: null },
        credentials,
        { paths },
      )
    ).resolve(fileId),
    /\.avif$/,
  );
  for (const declared of [0n, 31n, 33n, 9_007_199_254_740_993n]) {
    await resetGeneratedMedia(paths);
    extendedAvif.writeBigUInt64BE(declared, 8);
    await assert.rejects(
      materializePublicMedia(
        { posts: [{ body: "", cover_image: fileId }], avatar: null },
        credentials,
        { paths },
      ),
    );
    assert.deepEqual(await readdir(paths.output), []);
  }

  await reset();
  for (const url of [
    "ftp://cms.test",
    "https://url-user:url-password@cms.test",
    "https://cms.test?token=secret",
    "https://cms.test/#fragment",
    "not-a-url",
  ]) {
    assert.throws(() => normalizeDirectusUrl(url), /DIRECTUS_URL/);
    assert.throws(
      () =>
        readBuildEnvironment({
          NODE_ENV: "test",
          CONTENT_SOURCE: "directus",
          DIRECTUS_URL: url,
          DIRECTUS_BUILD_TOKEN: credentials.token,
        }),
      /DIRECTUS_URL/,
    );
    await assert.rejects(loadFromDirectus({ ...credentials, url }, { paths }));
  }
  assert.equal(
    calls.length,
    0,
    "Invalid direct loader configuration must fail before SDK requests",
  );
} finally {
  globalThis.fetch = originalFetch;
  await rm(root, { recursive: true, force: true });
}
console.log(
  "public media check ok: real loader mapping, public-folder preflight, bounded originals, revocation and concurrency",
);
