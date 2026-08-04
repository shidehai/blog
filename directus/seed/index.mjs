import { adminClient, filterPath, isDirectusError } from "../client.mjs";
import { IDS } from "../constants.mjs";

const request = await adminClient();

/**
 * @typedef {Record<string, unknown> & { id: string }} DirectusItem
 * @typedef {Record<string, unknown> & { slug?: string }} DirectusInput
 */

const DATA = {
  settings: "f0000000-0000-4000-8000-000000000001",
  topics: {
    astro: "f1000000-0000-4000-8000-000000000001",
    database: "f1000000-0000-4000-8000-000000000002",
    craft: "f1000000-0000-4000-8000-000000000003",
  },
  posts: {
    article: "f2000000-0000-4000-8000-000000000001",
    tutorial: "f2000000-0000-4000-8000-000000000002",
    note: "f2000000-0000-4000-8000-000000000003",
    archived: "f2000000-0000-4000-8000-000000000004",
  },
};

/**
 * @param {string} collection
 * @param {string} id
 * @param {DirectusInput} data
 * @param {[string, string | undefined]} [identity]
 * @returns {Promise<DirectusItem>}
 */
async function upsertItem(
  collection,
  id,
  data,
  identity = ["slug", data.slug],
) {
  /** @type {DirectusItem | null | undefined} */
  let existing;
  try {
    existing = await request(`/items/${collection}/${id}`);
  } catch (error) {
    if (
      !isDirectusError(error) ||
      (error.status !== 403 && error.status !== 404)
    )
      throw error;
  }

  if (!existing && identity[1]) {
    /** @type {DirectusItem[] | DirectusItem} */
    const matches = await request(
      filterPath(`items/${collection}`, identity[0], identity[1], "*"),
    );
    existing = Array.isArray(matches)
      ? matches[0]
      : matches.id
        ? matches
        : null;
  }

  if (collection === "site_settings") {
    return request("/items/site_settings", {
      method: "PATCH",
      body: existing ? data : { id, ...data },
    });
  }
  if (existing)
    return request(`/items/${collection}/${existing.id}`, {
      method: "PATCH",
      body: data,
    });
  return request(`/items/${collection}`, {
    method: "POST",
    body: { id, ...data },
  });
}

/**
 * @param {string} title
 * @param {string} folder
 * @param {string} type
 * @param {BlobPart} bytes
 * @param {string} filename
 * @returns {Promise<DirectusItem>}
 */
async function ensureFile(title, folder, type, bytes, filename) {
  /** @type {DirectusItem[]} */
  const [existing] = await request(filterPath("files", "title", title, "*"));
  if (existing) {
    return request(`/files/${existing.id}`, {
      method: "PATCH",
      body: { title, folder },
    });
  }

  const form = new FormData();
  form.set("title", title);
  form.set("folder", folder);
  form.set("file", new Blob([bytes], { type }), filename);
  return request("/files", { method: "POST", body: form });
}

const cover = await ensureFile(
  "示例封面（非真实内容）",
  IDS.folders.publishable,
  "image/png",
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAFAgH/2cFzWQAAAABJRU5ErkJggg==",
    "base64",
  ),
  "fixture-cover.png",
);
await ensureFile(
  "示例私有草稿图（非真实内容）",
  IDS.folders.private,
  "image/svg+xml",
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#dce8f5"/><text x="24" y="96" font-family="sans-serif" font-size="24" fill="#174b78">DRAFT FIXTURE</text></svg>',
  "fixture-draft.svg",
);

await upsertItem(
  "site_settings",
  DATA.settings,
  {
    site_name: "示例知识手记",
    author_name: "示例作者",
    tagline: "把复杂问题写清楚",
    homepage_intro:
      "这里收录长篇技术文章、实作教程和短随记。所有内容均为开发测试数据。",
    biography:
      "示例作者专注于可维护的软件、数据库和网页体验。此段落不对应真实个人。",
    default_seo_description:
      "一个使用 Directus、PostgreSQL 与 Astro 构建的中文优先个人出版示例。",
    default_og_image: cover.id,
    footer_text: "示例站点内容，仅用于开发与自动化测试。",
    locale: "zh-CN",
    timezone: "Asia/Shanghai",
  },
  ["site_name", "示例知识手记"],
);

const topics = {
  astro: await upsertItem("topics", DATA.topics.astro, {
    name: "Astro",
    slug: "astro",
    description: "Astro 与静态内容交付。",
  }),
  database: await upsertItem("topics", DATA.topics.database, {
    name: "数据库",
    slug: "database",
    description: "PostgreSQL、数据模型与可靠性。",
  }),
  craft: await upsertItem("topics", DATA.topics.craft, {
    name: "工程手艺",
    slug: "engineering-craft",
    description: "让系统保持清楚、可测试与可恢复。",
  }),
};

await upsertItem(
  "social_links",
  "f3000000-0000-4000-8000-000000000001",
  {
    site_settings_id: DATA.settings,
    label: "示例代码仓库",
    url: "https://example.com/source",
    icon: "github",
    sort: 1,
  },
  ["label", "示例代码仓库"],
);
await upsertItem(
  "social_links",
  "f3000000-0000-4000-8000-000000000002",
  {
    site_settings_id: DATA.settings,
    label: "RSS",
    url: "https://example.com/rss.xml",
    icon: "rss",
    sort: 2,
  },
  ["label", "RSS"],
);

const common = {
  status: "published",
  featured: false,
  cover_decorative: false,
  seo_title: null,
  seo_description: null,
};
const posts = {
  article: await upsertItem("posts", DATA.posts.article, {
    ...common,
    kind: "article",
    title: "示例：静态发布为何仍需要清晰的数据边界",
    slug: "static-publishing-data-boundary",
    summary: "从内容数据库到静态页面，逐层说明校验、快照和失败关闭如何协作。",
    body: `# 静态发布的数据边界

这是一篇**完全虚构的开发夹具**，用于覆盖中英文混排、链接与脚注。[Astro](https://astro.build/) 负责生成页面。[^source]

## 一次构建的输入

| 输入 | 责任 |
| --- | --- |
| PostgreSQL | 保存权威内容 |
| Directus | 权限与版本 |
| Astro | 校验并渲染 |

> [!NOTE]
> 公开构建只接受已经发布且媒体可公开的记录。

\`\`\`ts filename="snapshot.ts" {2}
const records = await loadPublishedPosts();
assertPublished(records);
\`\`\`

- [x] 校验 slug
- [x] 校验媒体
- [ ] 部署真实内容

[^source]: 示例脚注，不引用私有资料。
`,
    published_at: "2026-07-28T02:00:00.000Z",
    featured: true,
    cover_image: cover.id,
    cover_alt: "浅蓝色的示例封面图",
  }),
  tutorial: await upsertItem("posts", DATA.posts.tutorial, {
    ...common,
    kind: "tutorial",
    title: "示例教程：从草稿版本发布一篇文章",
    slug: "publish-from-content-version",
    summary: "使用假数据演示草稿版本、比较、发布和恢复的完整路径。",
    body: `# 从草稿版本发布

本教程只用于测试工作流。

1. 新建内容版本。
2. 保存 Markdown。
3. 比较主版本。
4. 发布并触发静态构建。

\`\`\`bash filename="verify.sh"
pnpm test:directus-workflow
\`\`\`
`,
    published_at: "2026-07-25T06:30:00.000Z",
    cover_image: null,
    cover_alt: null,
  }),
  note: await upsertItem("posts", DATA.posts.note, {
    ...common,
    kind: "note",
    title: "示例随记：先让失败可诊断",
    slug: "diagnosable-failures-first",
    summary: null,
    body: "短记录也走同一条发布边界。错误需要指出记录与字段，但不能泄露正文或令牌。",
    published_at: "2026-07-30T11:20:00.000Z",
    cover_image: null,
    cover_alt: null,
  }),
  archived: await upsertItem("posts", DATA.posts.archived, {
    ...common,
    status: "archived",
    kind: "note",
    title: "示例归档随记",
    slug: "archived-fixture-note",
    summary: null,
    body: "这条假记录用于证明公开构建凭据看不到归档内容。",
    published_at: "2026-07-20T01:00:00.000Z",
    cover_image: null,
    cover_alt: null,
  }),
};

/** @type {Array<[string, string, string]>} */
const joins = [
  ["f4000000-0000-4000-8000-000000000001", posts.article.id, topics.astro.id],
  [
    "f4000000-0000-4000-8000-000000000002",
    posts.article.id,
    topics.database.id,
  ],
  ["f4000000-0000-4000-8000-000000000003", posts.tutorial.id, topics.craft.id],
  ["f4000000-0000-4000-8000-000000000004", posts.note.id, topics.craft.id],
];
for (const [id, posts_id, topics_id] of joins) {
  await upsertItem("posts_topics", id, { posts_id, topics_id }, ["id", id]);
}

console.log("Directus fake fixtures ready");
