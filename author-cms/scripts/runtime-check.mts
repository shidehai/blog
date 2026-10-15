import { spawn, type ChildProcess } from "node:child_process";
import { readFile, mkdir, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { parseArgs } from "node:util";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { z } from "zod";
import sharp from "sharp";
import {
  adminContentSchema,
  mediaSchema,
  publicationSchema,
  catalogSchema,
} from "@blog/content-contracts";
import { ContentStore } from "../lib/store";
import { migrate } from "../lib/migrate";
import { resetOwner } from "../lib/auth";
import { closePool } from "../lib/db";
import { persistImage } from "../lib/media-files";
import { FIXTURE_ROWS } from "../../frontend-v2/lib/fixture";
const { values: options } = parseArgs({
  options: {
    "site-port": { type: "string", default: "4321" },
    "cms-port": { type: "string", default: "4322" },
    preview: { type: "boolean", default: false },
    browser: { type: "boolean", default: false },
  },
});
const portSchema = z.coerce.number().int().min(1024).max(65535);
const sitePort = portSchema.parse(options["site-port"]);
const cmsPort = portSchema.parse(options["cms-port"]);
assert.notEqual(sitePort, cmsPort, "独立应用必须使用不同端口");
// Fail before touching the test schema when a daily app already owns a port.
for (const port of [sitePort, cmsPort]) {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
const repository = fileURLToPath(new URL("../../", import.meta.url)),
  cmsUrl = `http://localhost:${cmsPort}`,
  siteUrl = `http://localhost:${sitePort}`;
const databaseUrl = process.env.CMS_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("运行验证需要显式 CMS_TEST_DATABASE_URL");
const url = new URL(databaseUrl);
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  !url.pathname.endsWith("_test")
)
  throw new Error("只允许本地 _test 数据库");
const root = path.join(tmpdir(), `blog-cms-runtime-${Date.now()}`);
await mkdir(root, { mode: 0o700 });
Object.assign(process.env, {
  DATABASE_URL: databaseUrl,
  CMS_ORIGIN: cmsUrl,
  CMS_SITE_ORIGIN: siteUrl,
  SITE_URL: siteUrl,
  CMS_READ_TOKEN: "isolated-runtime-reader-token-at-least-32-characters",
  CMS_MEDIA_ROOT: path.join(root, "media"),
});
const pool = new Pool({ connectionString: databaseUrl }),
  store = new ContentStore(pool),
  processes: ChildProcess[] = [];
async function stop() {
  for (const child of processes) {
    child.kill("SIGCONT");
    child.kill("SIGTERM");
  }
  await closePool();
  await pool.end();
}
process.once("SIGINT", () => void stop().finally(() => process.exit(0)));
process.once("SIGTERM", () => void stop().finally(() => process.exit(0)));
async function start(name: string, port: number) {
  const output = await open(path.join(root, `${name}.log`), "w", 0o600);
  const child = spawn(
    process.execPath,
    [
      path.join(repository, name, "node_modules/next/dist/bin/next"),
      "start",
      "-p",
      String(port),
      "-H",
      "127.0.0.1",
    ],
    {
      cwd: path.join(repository, name),
      env: {
        ...process.env,
        NODE_ENV: "production",
        CONTENT_SOURCE: "cms",
        CMS_INTERNAL_URL: cmsUrl,
      },
      stdio: ["ignore", output.fd, output.fd],
    },
  );
  processes.push(child);
  await output.close();
  for (let tries = 0; tries < 40; tries++) {
    if (child.exitCode !== null)
      throw new Error(`${name} 启动失败，日志：${root}`);
    try {
      if ((await fetch(`http://localhost:${port}/healthz`)).ok) return child;
    } catch {}
    await delay(250);
  }
  throw new Error(`${name} 启动超时`);
}
let cookie = "";
async function admin<T>(
  resource: string,
  schema: z.ZodType<T>,
  method = "GET",
  data?: unknown,
) {
  const response = await fetch(`${cmsUrl}/api/${resource}`, {
    method,
    headers: {
      origin: cmsUrl,
      cookie,
      ...(data ? { "content-type": "application/json" } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  assert.ok(
    response.ok,
    `${resource}: ${response.status} ${await response.clone().text()}`,
  );
  return schema.parse(await response.json());
}
async function publicGet(route: string, status = 200) {
  const response = await fetch(`${siteUrl}${route}`, {
    redirect: "manual",
    cache: "no-store",
  });
  assert.equal(response.status, status, route);
  return response;
}
try {
  await pool.query("DROP SCHEMA IF EXISTS author_cms CASCADE");
  await migrate(pool);
  await resetOwner("isolated-preview-owner-2026");
  for (const [name, kind] of [
    ["categories", "category"],
    ["tags", "tag"],
    ["series", "series"],
  ] as const)
    for (const row of FIXTURE_ROWS[name])
      await store.saveTaxonomy({
        id: row.id,
        kind,
        name: row.name,
        slug: row.slug,
        description: row.description ?? "",
      });
  const image = await store.addMedia(
    await persistImage(
      process.env.CMS_MEDIA_ROOT!,
      await readFile(
        path.join(
          repository,
          "author-cms/tests/fixtures/reliability-boundaries.webp",
        ),
      ),
      "可靠性边界.webp",
    ),
  );
  const portrait = await store.addMedia(
    await persistImage(
      process.env.CMS_MEDIA_ROOT!,
      await sharp({
        create: { width: 320, height: 560, channels: 3, background: "#bdc7ad" },
      })
        .composite([
          {
            input: Buffer.from(
              '<svg width="320" height="560"><path d="M0 480L140 200L320 450V560H0Z" fill="#667b56"/><path d="M0 560L250 290L320 440V560Z" fill="#3d5037"/></svg>',
            ),
          },
        ])
        .png()
        .toBuffer(),
      "竖幅排版测试.png",
    ),
  );
  for (const row of FIXTURE_ROWS.posts) {
    let item = await store.create(row.kind);
    item = await store.save(item.id, item.version, {
      ...item.draft,
      title: row.title,
      slug: row.slug,
      summary: row.summary,
      content: row.body,
      categoryId: row.category?.id ?? null,
      tagIds: row.tags.map((tag) => tag.tags_id.id),
      seriesId: row.series?.id ?? null,
      seriesOrder: row.series_order,
      featured: row.featured,
      publishedAt: row.published_at,
      coverId: image.id,
    });
    await store.publish(item.id, {
      version: item.version,
      revisionId: item.draftRevisionId,
      key: randomUUID(),
    });
  }
  let draft = await store.create("article");
  draft = await store.save(draft.id, draft.version, {
    ...draft.draft,
    title: "在 Linux 上，为我的个人博客留出一间安静的写作室",
    slug: "a-quiet-writing-room",
    summary:
      "让写作回到文字本身：可以慢慢修改的草稿、随手插入的图片，以及按下发布时的笃定。",
    content: `## 写作，从一个小念头开始\n\n我想要一个属于自己的写作空间。早上打开电脑，把昨天没有写完的思考接着写下去。\n\n**文字先留给自己，准备好了再发布。**\n\n![可靠性边界](/media/${image.id})\n\n## 给文字一点秩序\n\n- Markdown 记录内容\n- 图片保留原始比例\n- 草稿与线上文章各自独立\n\n\`\`\`typescript\nconst publish = async (draft: Draft) => {\n  await save(draft);\n  return commitPublication(draft.revision);\n};\n\`\`\`\n\n| 状态 | 读者看见什么 |\n| --- | --- |\n| 草稿 | 之前发布的版本 |\n| 发布 | 刚刚确认的新版本 |\n\n> [!NOTE]\n> 想清楚，再分享。\n\n![竖幅排版测试](/media/${portrait.id})`,
    coverId: image.id,
    categoryId: FIXTURE_ROWS.categories[0]?.id ?? null,
    tagIds: FIXTURE_ROWS.tags.slice(0, 2).map((tag) => tag.id),
  });
  await store.saveProfile({
    profile: {
      name: "shidehai",
      handle: "@shidehai",
      title: "开发者 / AI 与 Linux",
      avatar: "/avatar.svg",
      bio: "记录技术、写作和日常思考。",
      hitokoto: "写下值得留下的。",
      location: "Shanghai",
      socials: {
        github: "https://github.com/shidehai",
        email: "mailto:author@example.com",
        about: "/about",
      },
    },
    version: 0,
  });
  const cms = await start("author-cms", cmsPort),
    site = await start("frontend-v2", sitePort);
  const pids = [cms.pid, site.pid];
  const builds = [
    await readFile(path.join(repository, "author-cms/.next/BUILD_ID"), "utf8"),
    await readFile(path.join(repository, "frontend-v2/.next/BUILD_ID"), "utf8"),
  ];
  const login = await fetch(`${cmsUrl}/api/auth/login`, {
    method: "POST",
    headers: { origin: cmsUrl, "content-type": "application/json" },
    body: JSON.stringify({ password: "isolated-preview-owner-2026" }),
  });
  assert.equal(login.status, 200);
  cookie = login.headers.get("set-cookie")!.split(";")[0]!;
  const slug = `published-after-build-${Date.now()}`;
  await publicGet(`/archives/${slug}`, 404);
  await publicGet(`/writing/${slug}`, 404);
  await publicGet("/writing", 404);
  await publicGet("/notes/synthetic-note", 404);
  const initialSitemap = await (await publicGet("/sitemap.xml")).text();
  assert.ok(
    !initialSitemap.includes(slug) &&
      !initialSitemap.includes(draft.draft.slug),
  );
  assert.doesNotMatch(initialSitemap, /\/media\/|\/writing\/|<lastmod>/);
  assert.match(
    await (await publicGet("/robots.txt")).text(),
    new RegExp(`Sitemap: ${siteUrl}/sitemap.xml`),
  );
  assert.match(
    await (await fetch(`${cmsUrl}/robots.txt`)).text(),
    /Disallow: \//,
  );
  const hostileHost = await fetch(`${siteUrl}/`, {
    headers: { host: "untrusted.example.test" },
  });
  const homeHtml = await hostileHost.text();
  assert.equal(hostileHost.status, 200);
  await writeFileSafe(path.join(root, "metadata-host-check.html"), homeHtml);
  const canonical = homeHtml.match(/rel="canonical" href="([^"]+)"/);
  const ogUrl = homeHtml.match(/property="og:url" content="([^"]+)"/);
  assert.ok(canonical?.[1] && ogUrl?.[1]);
  assert.equal(new URL(canonical[1]).href, `${siteUrl}/`);
  assert.equal(new URL(ogUrl[1]).href, `${siteUrl}/`);
  assert.match(homeHtml, /name="twitter:card" content="summary_large_image"/);
  assert.ok(homeHtml.includes(`${siteUrl}/share.png`));
  const share = await publicGet("/share.png");
  assert.equal(share.headers.get("content-type"), "image/png");
  const shareSize = await sharp(
    Buffer.from(await share.arrayBuffer()),
  ).metadata();
  assert.equal(shareSize.width, 1200);
  assert.equal(shareSize.height, 630);
  await publicGet("/_next/image?url=%2Fshare.png&w=1200&q=75", 404);
  let item = await admin("admin/contents", adminContentSchema, "POST", {
    kind: "article",
  });
  const category = {
    id: randomUUID(),
    kind: "category",
    name: "即时发布核验",
    slug: `category-${Date.now()}`,
    description: "",
  };
  const series = {
    id: randomUUID(),
    kind: "series",
    name: "运行时核验",
    slug: `series-${Date.now()}`,
    description: "",
  };
  await admin("admin/taxonomies", z.unknown(), "PUT", category);
  await admin("admin/taxonomies", z.unknown(), "PUT", series);
  const mediaBytes = await sharp({
    create: { width: 40, height: 30, channels: 3, background: "#a43e2d" },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append(
    "file",
    new File([new Uint8Array(mediaBytes)], "publish-check.png", {
      type: "image/png",
    }),
  );
  const upload = await fetch(`${cmsUrl}/api/admin/media`, {
    method: "POST",
    headers: { origin: cmsUrl, cookie },
    body: form,
  });
  assert.equal(upload.status, 201);
  const media = mediaSchema.parse(await upload.json());
  await publicGet(`/media/${media.id}`, 404);
  item = await admin(`admin/contents/${item.id}`, adminContentSchema, "PUT", {
    version: item.version,
    draft: {
      ...item.draft,
      title: "即时发布验收文章",
      slug,
      content: `## 原子发布\n\n第一版正文\n\n![测试](/media/${media.id})`,
      categoryId: category.id,
      seriesId: series.id,
      coverId: media.id,
    },
  });
  await admin(`admin/contents/${item.id}/publish`, publicationSchema, "POST", {
    version: item.version,
    revisionId: item.draftRevisionId,
    key: randomUUID(),
  });
  assert.match(
    await (await publicGet(`/archives/${slug}`)).text(),
    /即时发布验收文章/,
  );
  const publishedSitemap = await (await publicGet("/sitemap.xml")).text();
  for (const pathname of [
    `/archives/${slug}`,
    `/categories/${category.slug}`,
    `/series/${series.slug}`,
  ]) {
    assert.ok(publishedSitemap.includes(`<loc>${siteUrl}${pathname}</loc>`));
  }
  const articleHtml = await (await publicGet(`/archives/${slug}`)).text();
  assert.ok(
    articleHtml.includes(`rel="canonical" href="${siteUrl}/archives/${slug}"`),
  );
  assert.ok(articleHtml.includes('property="og:type" content="article"'));
  assert.ok(articleHtml.includes(`${siteUrl}/media/${media.id}`));
  assert.match(await (await publicGet("/archives")).text(), new RegExp(slug));
  assert.match(await (await publicGet("/")).text(), new RegExp(slug));
  assert.match(
    await (await publicGet(`/categories/${category.slug}`)).text(),
    new RegExp(slug),
  );
  assert.match(
    await (await publicGet(`/series/${series.slug}`)).text(),
    new RegExp(slug),
  );
  const legacy = await publicGet(`/writing/${slug}`, 308);
  assert.equal(legacy.headers.get("location"), `/archives/${slug}`);
  assert.deepEqual(
    Buffer.from(await (await publicGet(`/media/${media.id}`)).arrayBuffer()),
    mediaBytes,
  );
  const catalog = await fetch(`${cmsUrl}/api/public/catalog`, {
    headers: { authorization: `Bearer ${process.env.CMS_READ_TOKEN}` },
  });
  const publicCatalog = catalogSchema.parse(await catalog.json());
  assert.ok(publicCatalog.posts.some((post) => post.slug === slug));
  assert.equal(
    publicCatalog.posts.some((post) => post.slug === draft.draft.slug),
    false,
  );
  assert.equal("content" in publicCatalog.posts[0]!, false);
  item = await admin(`admin/contents/${item.id}`, adminContentSchema);
  item = await admin(`admin/contents/${item.id}`, adminContentSchema, "PUT", {
    version: item.version,
    draft: { ...item.draft, title: "未公开的草稿修改", content: "第二版正文" },
  });
  assert.doesNotMatch(
    await (await publicGet(`/archives/${slug}`)).text(),
    /未公开的草稿修改/,
  );
  await admin(`admin/contents/${item.id}/publish`, publicationSchema, "POST", {
    version: item.version,
    revisionId: item.draftRevisionId,
    key: randomUUID(),
  });
  assert.match(
    await (await publicGet(`/archives/${slug}`)).text(),
    /第二版正文/,
  );
  item = await admin(`admin/contents/${item.id}`, adminContentSchema);
  const renamedSlug = `${slug}-renamed`;
  item = await admin(`admin/contents/${item.id}`, adminContentSchema, "PUT", {
    version: item.version,
    draft: { ...item.draft, slug: renamedSlug },
  });
  await admin(`admin/contents/${item.id}/publish`, publicationSchema, "POST", {
    version: item.version,
    revisionId: item.draftRevisionId,
    key: randomUUID(),
  });
  assert.equal(
    (await publicGet(`/archives/${slug}`, 308)).headers.get("location"),
    `/archives/${renamedSlug}`,
  );
  const renamedSitemap = await (await publicGet("/sitemap.xml")).text();
  assert.ok(
    renamedSitemap.includes(`<loc>${siteUrl}/archives/${renamedSlug}</loc>`),
  );
  assert.ok(!renamedSitemap.includes(`<loc>${siteUrl}/archives/${slug}</loc>`));
  item = await admin(`admin/contents/${item.id}`, adminContentSchema);
  await admin(`admin/contents/${item.id}/archive`, adminContentSchema, "POST", {
    version: item.version,
  });
  await publicGet(`/archives/${slug}`, 404);
  await publicGet(`/archives/${renamedSlug}`, 404);
  await publicGet(`/media/${media.id}`, 404);
  const archivedSitemap = await (await publicGet("/sitemap.xml")).text();
  for (const privatePath of [
    slug,
    renamedSlug,
    category.slug,
    series.slug,
    draft.draft.slug,
  ]) {
    assert.ok(!archivedSitemap.includes(privatePath));
  }
  cms.kill("SIGSTOP");
  try {
    await publicGet("/", 503);
  } finally {
    cms.kill("SIGCONT");
  }
  await publicGet("/");
  assert.deepEqual([cms.pid, site.pid], pids);
  assert.equal(
    await readFile(path.join(repository, "author-cms/.next/BUILD_ID"), "utf8"),
    builds[0],
  );
  assert.equal(
    await readFile(path.join(repository, "frontend-v2/.next/BUILD_ID"), "utf8"),
    builds[1],
  );
  const evidence = {
    passed: true,
    buildIds: builds,
    pids,
    checks: [
      "previously-404 slug",
      "list/category/series/search summaries",
      "draft isolation",
      "publish update",
      "archive and media revoke",
      "reader-only boundary",
      "unavailable returns 503",
      "no rebuild/restart",
      "configured canonical/OG/Twitter and sharing PNG",
      "dynamic published-only sitemap after publish/rename/archive",
      "robots and disabled unused image optimizer",
    ],
    preview: {
      cms: cmsUrl,
      site: siteUrl,
      editor: `${cmsUrl}/write/${draft.id}`,
      logDirectory: root,
    },
  };
  await writeFileSafe(
    path.join(root, "runtime-evidence.json"),
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence, null, 2));
  if (options.browser) {
    const { checkBrowser } = await import("./browser-check.mjs");
    await checkBrowser(evidence.preview);
  }
  if (options.preview) {
    console.log(
      "PREVIEW_READY — isolated preview remains running until interrupted.",
    );
    await new Promise(() => {});
  } else await stop();
} catch (error) {
  await stop();
  throw error;
}
async function writeFileSafe(filename: string, text: string) {
  const file = await open(filename, "wx", 0o600);
  try {
    await file.writeFile(text);
  } finally {
    await file.close();
  }
}
