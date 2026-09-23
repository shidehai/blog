/**
 * 内容入口自检：默认 fixture 路径应产出 V2 所有公开页面需要的快照。
 */
import assert from "node:assert/strict";

import { snapshot } from "./content";

const snap = await snapshot();

assert.equal(snap.posts.length, 3, "3 篇 article/tutorial 进入公开快照");
for (const post of snap.posts) {
  assert.ok(post.slug, "slug 非空");
  assert.ok(post.readingMinutes > 0, `${post.slug} 应有阅读时长`);
  assert.ok(post.wordCount > 0, `${post.slug} 应有字数`);
  assert.ok(post.publishedAt, `${post.slug} 应有发布时间`);
}

const featured = snap.posts.find((post) => post.featured);
assert.ok(featured, "至少一篇 featured");
assert.ok(featured.category, "featured 应有分类");

assert.ok(
  snap.categories.some((category) => category.count > 0),
  "分类计数不能全为 0",
);
assert.ok(
  snap.tags.some((tag) => tag.count > 0),
  "标签计数不能全为 0（M2M 展开成功）",
);

const seriesEntry = snap.series.find((series) => series.count > 0);
assert.ok(seriesEntry, "至少一个系列有成员");
assert.equal(
  seriesEntry.posts.length,
  seriesEntry.count,
  "系列成员列表长度应等于 count",
);

assert.equal(snap.profile.name, "shidehai", "作者名来自 site_settings");
assert.ok(snap.profile.bio, "简介有值");
assert.ok(snap.profile.socials.github, "GitHub 链接有值");
assert.ok(snap.profile.socials.email, "Email 链接有值");

console.log(
  `snapshot selfcheck ok: posts=${snap.posts.length} categories=${snap.categories.length}`,
);
