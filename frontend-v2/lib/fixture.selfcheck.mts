/**
 * 显式离线夹具的映射与运行时环境边界自检。
 */
import assert from "node:assert/strict";
import { buildSnapshot, rawPostSchema } from "./fixture-projector.js";
import { readRuntimeEnvironment } from "./env.js";
import { FIXTURE_ROWS } from "./fixture.js";

const snap = buildSnapshot(FIXTURE_ROWS);

assert.equal(snap.posts.length, 3, "公开快照应有 3 篇文章");

// 发布时间倒序（buildSnapshot 统一保证，夹具书写顺序不可依赖）。
const times = snap.posts.map((post) => Date.parse(post.publishedAt));
assert.deepEqual(
  times,
  [...times].sort((left, right) => right - left),
  "应按时间倒序",
);

const post = snap.posts.find(
  (entry) => entry.slug === "production-llm-reliability-boundaries",
);
assert.ok(post, "应能按 slug 找到文章");
assert.ok(post.readingMinutes > 0, "readingMinutes 应为正数");
assert.ok(post.summary.length > 0, "summary 应非空");
assert.ok(post.wordCount > 0, "wordCount 应为正数");
assert.equal(post.series?.order, 1, "series.order 应映射自 series_order");
assert.deepEqual(
  new Set(post.tags),
  new Set(["架构", "可观测性"]),
  "tags 应展开 M2M 为名称数组",
);
assert.equal(post.category, "工程实践", "category 应映射为分类名");

assert.ok(snap.categories.every((category) => category.count > 0));
assert.ok(snap.tags.some((tag) => tag.count > 0));
assert.equal(snap.series[0]?.posts.length, snap.series[0]?.count);

// profile：CMS 列 + mock 兜底字段。
assert.equal(snap.profile.name, "shidehai");
assert.ok(snap.profile.handle.length > 0, "handle 应由 mock 兜底");
assert.ok(
  snap.profile.socials.about.length > 0,
  "socials.about 应由 mock 兜底",
);
assert.equal("rss" in snap.profile.socials, false, "前端不再暴露 RSS");

// --- 回归：解码必须拒绝无法进入公开快照的记录 ---
const validRow = { ...FIXTURE_ROWS.posts[0]! };
assert.ok(rawPostSchema.safeParse(validRow).success, "合法行应通过解码");

for (const bad of [null, undefined, "", "2026-05-20", "not-a-date"]) {
  const result = rawPostSchema.safeParse({ ...validRow, published_at: bad });
  assert.equal(
    result.success,
    false,
    `published_at=${JSON.stringify(bad)} 应被拒绝`,
  );
}

assert.equal(
  rawPostSchema.safeParse({ ...validRow, body: null }).success,
  false,
  "body 为 null 应被拒绝",
);
assert.equal(
  rawPostSchema.safeParse({ ...validRow, body: "" }).success,
  false,
  "空 body 应被拒绝",
);
assert.equal(
  rawPostSchema.safeParse({ ...validRow, kind: "note" }).success,
  false,
  "note 不能进入 V2 公开快照",
);

// --- 运行时环境：离线样本必须显式选择；生产配置失败不能回退 ---
assert.deepEqual(readRuntimeEnvironment({ NODE_ENV: "test" }), {
  source: "fixture",
  siteUrl: "http://localhost:4321",
});
assert.deepEqual(
  readRuntimeEnvironment({ NODE_ENV: "production", CONTENT_SOURCE: "fixture" }),
  { source: "fixture", siteUrl: "http://localhost:4321" },
);
for (const input of [
  { NODE_ENV: "production" },
  { NODE_ENV: "test", CONTENT_SOURCE: "cms" },
] as const) {
  assert.throws(
    () => readRuntimeEnvironment(input),
    /CMS_INTERNAL_URL.*CMS_READ_TOKEN/,
    "CMS 模式缺凭据必须失败",
  );
}
assert.throws(
  () => readRuntimeEnvironment({ NODE_ENV: "test", CONTENT_SOURCE: "unknown" }),
  /CONTENT_SOURCE/,
  "未知内容源必须失败",
);
const readerToken = "fixture-runtime-reader-token-do-not-log";
for (const url of [
  "not-a-url",
  "file:///etc/hosts",
  "https://private-user:private-password@cms.example.test/",
  "https://cms.example.test/subpath",
  "https://cms.example.test/?token=private-query",
  "https://cms.example.test/#private-fragment",
]) {
  assert.throws(
    () =>
      readRuntimeEnvironment({
        NODE_ENV: "test",
        CONTENT_SOURCE: "cms",
        CMS_INTERNAL_URL: url,
        CMS_READ_TOKEN: readerToken,
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /CMS_INTERNAL_URL/);
      assert.equal(error.message.includes(url), false);
      assert.equal(error.message.includes(readerToken), false);
      return true;
    },
  );
}
assert.throws(
  () =>
    readRuntimeEnvironment({
      NODE_ENV: "test",
      CONTENT_SOURCE: "cms",
      CMS_INTERNAL_URL: "http://cms.example.test/",
      CMS_READ_TOKEN: "short-private-token",
    }),
  /CMS_READ_TOKEN/,
);
assert.deepEqual(
  readRuntimeEnvironment({
    NODE_ENV: "production",
    CMS_INTERNAL_URL: "http://cms.example.test/",
    CMS_READ_TOKEN: readerToken,
    SITE_URL: "https://blog.example.test/",
  }),
  {
    source: "cms",
    url: "http://cms.example.test",
    token: readerToken,
    siteUrl: "https://blog.example.test",
  },
);

for (const siteUrl of [
  undefined,
  "file:///etc/hosts",
  "https://private-user:private-password@blog.example.test/",
  "https://blog.example.test/subpath",
  "https://blog.example.test/?secret=private-query",
  "https://blog.example.test/#private-fragment",
]) {
  assert.throws(
    () =>
      readRuntimeEnvironment({
        NODE_ENV: "production",
        CMS_INTERNAL_URL: "http://cms.example.test",
        CMS_READ_TOKEN: readerToken,
        SITE_URL: siteUrl,
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /SITE_URL/);
      assert.equal(error.message.includes(readerToken), false);
      if (siteUrl) assert.equal(error.message.includes(siteUrl), false);
      return true;
    },
  );
}

console.log(`fixture selfcheck ok: ${snap.posts.length} published posts`);
