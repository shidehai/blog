/**
 * 夹具数据自检。撑着 /topics 与 /topics/[slug]，跑法：
 *   npx tsx lib/mock.check.ts
 * 没装 tsx 时：npx --yes tsx lib/mock.check.ts
 */
import assert from "node:assert/strict";
import { MOCK_NOTES, MOCK_POSTS, MOCK_PROJECTS, MOCK_TOPICS } from "./mock";

// 专题 count 必须等于真实携带该 tag 的文章数，不是手写展示值。
for (const topic of MOCK_TOPICS) {
  const actual = MOCK_POSTS.filter((p) => p.tags.includes(topic.name)).length;
  assert.equal(
    topic.count,
    actual,
    `专题「${topic.name}」标称 ${topic.count} 篇，实际 ${actual} 篇`,
  );
  assert.ok(actual > 0, `专题「${topic.name}」没有文章，不应生成页面`);
}

// slug 必须是 URL 安全的，否则中文会变成百分号编码路径。
for (const topic of MOCK_TOPICS) {
  assert.match(
    topic.slug,
    /^[a-z0-9-]+$/,
    `专题「${topic.name}」slug 不是 URL 安全的: ${topic.slug}`,
  );
}

// slug 唯一，否则 generateStaticParams 会产生重复路由。
const slugs = MOCK_TOPICS.map((t) => t.slug);
assert.equal(new Set(slugs).size, slugs.length, "专题 slug 有重复");

// 文章 slug 唯一，详情页路由依赖它。
const postSlugs = MOCK_POSTS.map((p) => p.slug);
assert.equal(
  new Set(postSlugs).size,
  postSlugs.length,
  `文章 slug 有重复: ${postSlugs.filter((s, i) => postSlugs.indexOf(s) !== i).join(", ")}`,
);

// 随记按时间倒序渲染，publishedAt 必须可解析。
for (const note of MOCK_NOTES) {
  assert.ok(
    !Number.isNaN(Date.parse(note.publishedAt)),
    `随记「${note.title}」publishedAt 无法解析`,
  );
}

// 项目卡片直接渲染 techStack，空数组会渲染出空白行。
for (const project of MOCK_PROJECTS) {
  assert.ok(
    project.techStack.length > 0,
    `项目「${project.name}」techStack 为空`,
  );
}

console.log(
  `✓ 夹具自检通过：${MOCK_TOPICS.length} 专题 / ${MOCK_POSTS.length} 文章 / ${MOCK_NOTES.length} 随记 / ${MOCK_PROJECTS.length} 项目`,
);
