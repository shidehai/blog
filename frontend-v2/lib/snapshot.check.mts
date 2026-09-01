/**
 * 映射层自检：夹具走 buildSnapshot 后，派生字段与索引必须成立。
 * 跑法：npx tsx lib/snapshot.check.ts
 */
import assert from "node:assert/strict";
import { snapshot } from "./snapshot";

const snap = await snapshot();

assert.equal(snap.posts.length, 3, "3 篇 article/tutorial 进 posts");
assert.equal(snap.notes.length, 3, "3 篇 note 进 notes");

for (const post of snap.posts) {
  assert.ok(post.slug, "slug 非空");
  assert.ok(post.readingMinutes > 0, `${post.slug} 应有阅读时长`);
  assert.ok(post.wordCount > 0, `${post.slug} 应有字数`);
  assert.ok(post.publishedAt, `${post.slug} 应有发布时间`);
}

const featured = snap.posts.find((p) => p.featured);
assert.ok(featured, "至少一篇 featured");
assert.ok(featured.category, "featured 应有分类");
assert.ok(featured.tags.length > 0, "featured 应有标签（M2M 展开成功）");

const seriesPost = snap.posts.find((p) => p.series);
assert.ok(seriesPost, "至少一篇属于系列");
assert.ok(seriesPost.series?.name, "系列应有名称");
assert.equal(typeof seriesPost.series?.order, "number", "系列内应有序号");

assert.ok(snap.topics.length > 0, "topics 非空");
assert.ok(
  snap.topics.some((t) => t.count > 0),
  "主题计数来自 M2M 关系，不能全为 0",
);

for (const topic of snap.topics) {
  const slugs = snap.postSlugsByTopic.get(topic.slug) ?? [];
  assert.equal(slugs.length, topic.count, `${topic.slug} 的索引长度应等于 count`);
}

assert.ok(
  snap.categories.some((c) => c.count > 0),
  "分类计数不能全为 0",
);
assert.ok(
  snap.tags.some((t) => t.count > 0),
  "标签计数不能全为 0（M2M 展开成功）",
);

const seriesEntry = snap.series.find((s) => s.count > 0);
assert.ok(seriesEntry, "至少一个系列有成员");
assert.equal(
  seriesEntry.posts.length,
  seriesEntry.count,
  "系列成员列表长度应等于 count",
);

assert.equal(snap.profile.name, "shidehai", "作者名来自 site_settings");
assert.ok(snap.profile.bio, "简介有值");
assert.ok(
  Object.keys(snap.profile.socials).length > 0,
  "社交链接按 icon 映射，不能为空",
);

console.log(
  `ok — posts=${snap.posts.length} notes=${snap.notes.length} topics=${snap.topics.length}`,
);
