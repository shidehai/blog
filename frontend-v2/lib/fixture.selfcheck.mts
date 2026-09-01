/**
 * 夹具映射自检：跑 FIXTURE_ROWS 经 buildSnapshot 的降级路径，
 * 断言派生值真实产出。类型通过不等于映射正确。
 *
 * 运行：npx tsx lib/fixture.selfcheck.mts
 */
import assert from "node:assert/strict";

import { buildSnapshot, rawPostSchema } from "./directus.js";
import { readDirectusCredentials } from "./env.js";
import { FIXTURE_ROWS } from "./fixture.js";

const snap = buildSnapshot(FIXTURE_ROWS, "");

// 条目切分：article/tutorial 进 posts，note 进 notes
assert.equal(snap.posts.length, 3, "posts 应为 3 篇");
assert.equal(snap.notes.length, 3, "notes 应为 3 条");
assert.equal(snap.topics.length, 6, "topics 应为 6 个");

// 发布时间倒序（buildSnapshot 统一保证，夹具书写顺序不可依赖）
for (const list of [snap.posts, snap.notes]) {
  const times = list.map((x) => Date.parse(x.publishedAt));
  assert.deepEqual(times, [...times].sort((a, b) => b - a), "应按时间倒序");
}

// 派生字段
const post = snap.posts.find((p) => p.slug === "production-llm-reliability-boundaries");
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

// 专题计数与索引一致
for (const topic of snap.topics) {
  const slugs = snap.postSlugsByTopic.get(topic.slug) ?? [];
  assert.equal(topic.count, slugs.length, `${topic.slug} 的 count 应等于索引长度`);
}
const llm = snap.topics.find((t) => t.slug === "llm-systems");
assert.ok(llm && llm.count > 0, "llm-systems 应有关联文章");

// profile：CMS 列 + mock 兜底字段
assert.equal(snap.profile.name, "shidehai");
assert.ok(snap.profile.handle.length > 0, "handle 应由 mock 兜底");
assert.ok(snap.profile.socials.about.length > 0, "socials.about 应由 mock 兜底");

console.log(
  `fixture selfcheck ok: ${snap.posts.length} posts, ${snap.notes.length} notes, ${snap.topics.length} topics`,
);

// --- 回归：published_at 为空必须被解码层拦住 ---
// schema.yaml 允许该列为空，而它要参与 Date.parse 排序，
// 漏过去会静默产出 NaN 打乱顺序，所以必须显式失败。
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

// body 为空也不能放过：readingMinutes 与 excerpt 都读它的 length
assert.equal(
  rawPostSchema.safeParse({ ...validRow, body: null }).success,
  false,
  "body 为 null 应被拒绝",
);

// --- 回归：env 边界不抛错，只降级 ---
assert.equal(readDirectusCredentials({}), null, "无凭据应返回 null");
assert.equal(
  readDirectusCredentials({ DIRECTUS_URL: "http://x.test" }),
  null,
  "缺 token 应返回 null",
);
assert.equal(
  readDirectusCredentials({
    DIRECTUS_URL: "not-a-url",
    DIRECTUS_BUILD_TOKEN: "x".repeat(24),
  }),
  null,
  "URL 非法应降级而非抛错",
);
assert.equal(
  readDirectusCredentials({
    DIRECTUS_URL: "http://x.test",
    DIRECTUS_BUILD_TOKEN: "short",
  }),
  null,
  "token 过短应降级",
);
const ok = readDirectusCredentials({
  DIRECTUS_URL: "http://x.test/",
  DIRECTUS_BUILD_TOKEN: "x".repeat(24),
});
assert.equal(ok?.url, "http://x.test", "应剥掉 URL 末尾斜杠");

console.log("selfcheck ok");
