/**
 * 夹具映射自检：跑 FIXTURE_ROWS 经 buildSnapshot 的降级路径，断言派生值与
 * 构建期环境边界。类型通过不等于映射正确。
 */
import assert from "node:assert/strict";

import { buildSnapshot, rawPostSchema } from "./directus.js";
import { readBuildEnvironment } from "./env.js";
import { FIXTURE_ROWS } from "./fixture.js";

const snap = buildSnapshot(FIXTURE_ROWS, "");

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

// --- 回归：fixture 可离线；Directus 模式必须在读取前失败闭环 ---
assert.deepEqual(readBuildEnvironment({}), { source: "fixture" });
assert.throws(
  () => readBuildEnvironment({ CONTENT_SOURCE: "directus" }),
  /DIRECTUS_URL.*DIRECTUS_BUILD_TOKEN/,
  "Directus 模式缺凭据必须失败",
);
assert.throws(
  () =>
    readBuildEnvironment({
      CONTENT_SOURCE: "directus",
      DIRECTUS_URL: "not-a-url",
      DIRECTUS_BUILD_TOKEN: "x".repeat(24),
    }),
  /DIRECTUS_URL/,
  "Directus URL 必须合法",
);
assert.throws(
  () => readBuildEnvironment({ CONTENT_SOURCE: "unknown" }),
  /CONTENT_SOURCE/,
  "未知内容源必须失败",
);
assert.deepEqual(
  readBuildEnvironment({
    CONTENT_SOURCE: "directus",
    DIRECTUS_URL: "http://directus.test/",
    DIRECTUS_BUILD_TOKEN: "x".repeat(24),
  }),
  {
    source: "directus",
    directus: {
      url: "http://directus.test",
      token: "x".repeat(24),
    },
  },
);

console.log(`fixture selfcheck ok: ${snap.posts.length} published posts`);
