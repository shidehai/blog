import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import sharp from "sharp";
import { z } from "zod";
import { renderMarkdown, collectMediaIds } from "@blog/markdown";
import { cmsPath } from "@blog/content-contracts/paths";
import { ContentStore } from "../lib/store";
import { migrate } from "../lib/migrate";
import { persistImage } from "../lib/media-files";
import {
  hashPassword,
  verifyPassword,
  resetOwner,
  cookieName,
} from "../lib/auth";
import { handleApi } from "../lib/http";
import { closePool } from "../lib/db";
import {
  databaseData,
  exportBundle,
  restoreBundle,
  readBundle,
} from "../lib/transfer";
import { sourceTables, importSource } from "../lib/source-transfer";

test("shared Markdown handles GFM, matching anchors and sanitized HTML", () => {
  const id = randomUUID();
  const content = `## 中文 **标题**\n\n## 中文 **标题**\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n![山林](/media/${id})\n\n\`\`\`js\nconst value = '<script>';\n\`\`\`\n\n> [!NOTE]\n> 提示内容\n\n<script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(1)">`;
  const rendered = renderMarkdown(content, cmsPath("/api/admin/media"));
  assert.deepEqual(
    rendered.headings.map((h) => h.id),
    ["中文-标题", "中文-标题-2"],
  );
  assert.deepEqual(collectMediaIds(content), [id]);
  assert.match(rendered.html, /<table>/);
  assert.match(rendered.html, /code-copy/);
  assert.match(rendered.html, /alert-note/);
  assert.match(
    rendered.html,
    new RegExp(`${cmsPath(`/api/admin/media/${id}`)}`),
  );
  assert.doesNotMatch(rendered.html, /<script>|onerror=|src="javascript:/);
  assert.deepEqual(collectMediaIds(`\`![fake](/media/${id})\``), []);
});

test("scrypt uses salts and rejects incorrect passwords", async () => {
  const encoded = await hashPassword("a-long-owner-password");
  assert.ok(await verifyPassword("a-long-owner-password", encoded));
  assert.equal(await verifyPassword("wrong-password", encoded), false);
  assert.notEqual(encoded, await hashPassword("a-long-owner-password"));
  await assert.rejects(hashPassword("short"));
});

test(
  "isolated database: drafts, transactions, aliases, authorization and media",
  { skip: !process.env.CMS_TEST_DATABASE_URL },
  async (t) => {
    const url = new URL(process.env.CMS_TEST_DATABASE_URL!);
    assert.ok(
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
        url.pathname.endsWith("_test"),
      "DB integration requires a local database ending in _test",
    );
    const root = await mkdtemp(path.join(tmpdir(), "author-cms-test-"));
    process.env.DATABASE_URL = url.href;
    process.env.CMS_ORIGIN = "http://localhost:4322";
    process.env.CMS_READ_TOKEN = "isolated-reader-test-token-at-least-32-chars";
    process.env.CMS_MEDIA_ROOT = root;
    const pool = new Pool({ connectionString: url.href });
    const store = new ContentStore(pool);
    try {
      await pool.query("DROP SCHEMA IF EXISTS author_cms CASCADE");
      await migrate(pool);
      await migrate(pool);
      await resetOwner("isolated-owner-password");
      await assert.rejects(
        pool.query(
          "INSERT INTO author_cms.owner(id,password_hash) VALUES(2,'invalid')",
        ),
      );
      const request = (
        pathname: string,
        method = "GET",
        data?: unknown,
        cookie = "",
        origin = "http://localhost:4322",
      ) =>
        new Request(`http://localhost:4322/api/${pathname}`, {
          method,
          headers: { origin, cookie, "content-type": "application/json" },
          ...(data === undefined ? {} : { body: JSON.stringify(data) }),
        });
      assert.equal(
        (await handleApi(request("admin/contents"), ["admin", "contents"]))
          .status,
        401,
      );
      assert.equal(
        (
          await handleApi(
            request(
              "auth/login",
              "POST",
              { password: "isolated-owner-password" },
              "",
              "https://untrusted.invalid",
            ),
            ["auth", "login"],
          )
        ).status,
        403,
      );
      const login = await handleApi(
        request("auth/login", "POST", { password: "isolated-owner-password" }),
        ["auth", "login"],
      );
      assert.equal(login.status, 200);
      const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
      assert.match(cookie, new RegExp(`^${cookieName()}=`));
      assert.match(
        login.headers.get("set-cookie")!,
        /HttpOnly; SameSite=Strict/,
      );
      assert.equal(
        (
          await handleApi(
            request(
              "admin/contents",
              "POST",
              { kind: "article" },
              cookie,
              "https://untrusted.invalid",
            ),
            ["admin", "contents"],
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await handleApi(request("public/catalog", "GET", undefined, cookie), [
            "public",
            "catalog",
          ])
        ).status,
        401,
      );

      const category = {
        id: randomUUID(),
        kind: "category" as const,
        name: "数据库",
        slug: "database",
        description: "",
      };
      const series = {
        id: randomUUID(),
        kind: "series" as const,
        name: "从零开始",
        slug: "from-zero",
        description: "实践笔记",
      };
      await store.saveTaxonomy(category);
      await store.saveTaxonomy(series);
      const bytes = await sharp({
        create: { width: 64, height: 40, channels: 3, background: "#ae442f" },
      })
        .png()
        .toBuffer();
      const media = await store.addMedia(
        await persistImage(root, bytes, "cover.png"),
      );
      let item = await store.create("article");
      const draft = {
        ...item.draft,
        title: "事务中的中文文章",
        slug: "transaction-test",
        content: `## 起点\n\n初稿\n\n![封面](/media/${media.id})`,
        categoryId: category.id,
        seriesId: series.id,
        coverId: media.id,
      };
      item = await store.save(item.id, item.version, draft);
      assert.equal(
        (await store.save(item.id, item.version, draft)).version,
        item.version,
        "unchanged save creates no revision",
      );
      await assert.rejects(store.save(item.id, item.version - 1, draft), {
        status: 409,
      });
      assert.equal((await store.catalog()).posts.length, 0);
      assert.equal(await store.mediaFile(media.id, true), null);
      const firstVersion = item.version;
      const publishInput = {
        version: item.version,
        revisionId: item.draftRevisionId,
        key: randomUUID(),
      };
      const publication = await store.publish(item.id, publishInput);
      assert.deepEqual(
        await store.publish(item.id, publishInput),
        publication,
        "same request returns exact same publication",
      );
      assert.equal((await store.get(item.id)).version, firstVersion + 1);
      await assert.rejects(
        store.publish(item.id, { ...publishInput, version: 999 }),
        { status: 409 },
      );
      let catalog = await store.catalog();
      assert.equal(catalog.posts.length, 1);
      assert.equal(catalog.categories[0]?.count, 1);
      assert.equal(catalog.series[0]?.posts[0]?.slug, draft.slug);
      assert.equal(
        "content" in catalog.posts[0]!,
        false,
        "catalog never serializes full body",
      );
      assert.ok(await store.mediaFile(media.id, true));
      const visibleGeneration = await store.generation();
      await store.allowMedia(media.id, false);
      assert.equal(
        await store.mediaFile(media.id, true),
        null,
        "revoked media is no longer public",
      );
      assert.ok(
        (await store.generation()) > visibleGeneration,
        "media privacy changes invalidate open readers",
      );
      await store.allowMedia(media.id, true);
      const first = await store.detail(draft.slug);
      assert.match(first!.post.content, /初稿/);
      item = await store.get(item.id);
      item = await store.save(item.id, item.version, {
        ...item.draft,
        content: "新正文",
        slug: "changed-address",
      });
      assert.match(
        (await store.detail(draft.slug))!.post.content,
        /初稿/,
        "editing leaves published revision alone",
      );
      await store.publish(item.id, {
        version: item.version,
        revisionId: item.draftRevisionId,
        key: randomUUID(),
      });
      assert.equal(
        (await store.detail(draft.slug))!.canonicalSlug,
        "changed-address",
      );
      assert.equal(
        (await store.detail("changed-address"))!.post.content,
        "新正文",
      );
      item = await store.get(item.id);
      item = await store.restore(item.id, item.version, publication.revisionId);
      assert.equal(
        (await store.detail("changed-address"))!.post.content,
        "新正文",
        "restore changes draft only",
      );

      const before = await store.generation();
      const storedMedia = (await store.mediaFile(media.id))!;
      await writeFile(
        path.join(root, storedMedia.storage_key),
        Buffer.alloc(bytes.length),
      );
      await assert.rejects(
        store.publish(item.id, {
          version: item.version,
          revisionId: item.draftRevisionId,
          key: randomUUID(),
        }),
        { status: 422 },
      );
      assert.equal(
        await store.generation(),
        before,
        "failed publish rolls generation back",
      );
      assert.equal(
        (await store.detail("changed-address"))!.post.content,
        "新正文",
      );
      await writeFile(path.join(root, storedMedia.storage_key), bytes);
      assert.equal(
        (await readFile(path.join(root, storedMedia.storage_key))).length,
        bytes.length,
      );
      await store.archive(item.id, item.version);
      assert.equal(await store.detail(draft.slug), null);
      assert.equal(await store.detail("changed-address"), null);
      assert.equal(await store.mediaFile(media.id, true), null);
      const note = await store.create("note");
      await assert.rejects(
        store.publish(note.id, {
          version: note.version,
          revisionId: note.draftRevisionId,
          key: randomUUID(),
        }),
        { status: 422 },
      );
      catalog = await store.catalog();
      assert.equal(catalog.posts.length, 0);
      const exported = JSON.stringify(await store.exportContent());
      assert.doesNotMatch(
        exported,
        /password_hash|token_hash|isolated-owner-password/,
      );
      assert.equal(
        (
          await handleApi(request("admin/contents", "GET", undefined, cookie), [
            "admin",
            "contents",
          ])
        ).status,
        200,
      );
      await resetOwner("reset-owner-password-2026");
      assert.equal(
        (
          await handleApi(request("admin/contents", "GET", undefined, cookie), [
            "admin",
            "contents",
          ])
        ).status,
        401,
      );
      await t.test("invalid files and paths are rejected", async () => {
        await assert.rejects(
          persistImage(
            root,
            Buffer.from('<svg onload="alert(1)"></svg>'),
            "bad.png",
          ),
          { status: 422 },
        );
        await assert.rejects(
          persistImage(root, Buffer.alloc(21 * 1024 * 1024), "large.png"),
          { status: 413 },
        );
      });
      await t.test(
        "content and actual media recover into an empty schema without sessions",
        async () => {
          const before = await databaseData(pool);
          const folder = path.join(root, "bundle");
          const bundle = await exportBundle(pool, root, folder);
          assert.equal(bundle.files.length, 1);
          await pool.query("DROP SCHEMA author_cms CASCADE");
          await migrate(pool);
          const restoredRoot = path.join(root, "restored-media");
          await restoreBundle(pool, restoredRoot, folder);
          assert.deepEqual(await databaseData(pool), before);
          assert.deepEqual(
            await readFile(path.join(restoredRoot, storedMedia.storage_key)),
            bytes,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int AS count FROM author_cms.sessions",
              )
            ).rows[0]?.count,
            0,
          );
          await assert.rejects(
            restoreBundle(pool, restoredRoot, folder),
            /目标 CMS 必须没有内容/,
          );
          await writeFile(
            path.join(folder, "media", storedMedia.storage_key),
            Buffer.alloc(bytes.length),
          );
          await assert.rejects(readBundle(folder), /图片校验失败/);
        },
      );
      await t.test(
        "Directus source import preserves published URLs, unbound drafts, versions and raw history",
        async () => {
          await pool.query("DROP SCHEMA author_cms CASCADE");
          await migrate(pool);
          const uploads = path.join(root, "source");
          await mkdir(uploads);
          const imageId = randomUUID(),
            svgId = randomUUID(),
            postId = randomUUID(),
            topicId = randomUUID(),
            tagId = randomUUID(),
            categoryId = randomUUID();
          await writeFile(path.join(uploads, `${imageId}.png`), bytes);
          await writeFile(
            path.join(uploads, `${svgId}.svg`),
            '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="50"><rect width="30" height="50" fill="#547658"/></svg>',
          );
          const post = {
            id: postId,
            status: "published",
            kind: "article",
            title: "保留的原文章",
            slug: "original-address",
            body: `原始正文\n\n![山林](directus://${imageId})\n\n\`![示例](directus://${imageId})\``,
            published_at: "2024-01-02T03:04:05.000Z",
            category: categoryId,
            series: null,
            series_order: null,
            summary: "原始摘要",
            featured: false,
            cover_image: imageId,
            date_created: "2024-01-01T00:00:00.000Z",
            date_updated: null,
          };
          const tables = Object.fromEntries(
            sourceTables.map((table) => [table, []]),
          );
          Object.assign(tables, {
            posts: [post],
            topics: [
              {
                id: topicId,
                name: "主题",
                slug: "topic-slug",
                description: "随记关系",
              },
            ],
            categories: [{ id: categoryId, name: "随笔", slug: "essays" }],
            tags: [{ id: tagId, name: "思考", slug: "thinking" }],
            posts_tags: [{ id: 1, posts_id: postId, tags_id: tagId }],
            posts_topics: [{ id: 1, posts_id: postId, topics_id: topicId }],
            directus_files: [
              {
                id: imageId,
                filename_disk: `${imageId}.png`,
                filename_download: "landscape.png",
                type: "image/png",
                folder: "11111111-1111-4111-8111-111111111111",
              },
              {
                id: svgId,
                filename_disk: `${svgId}.svg`,
                filename_download: "portrait.svg",
                type: "image/svg+xml",
                folder: "22222222-2222-4222-8222-222222222222",
              },
            ],
            directus_versions: [
              {
                id: randomUUID(),
                key: "draft",
                name: "工作草稿",
                collection: "posts",
                item: postId,
                delta: { title: "还没发布的修改" },
              },
              {
                id: randomUUID(),
                key: "draft",
                name: "未绑定首稿",
                collection: "posts",
                item: null,
                delta: {
                  title: "独立首稿",
                  body: "未发布内容",
                  kind: "note",
                  slug: "",
                },
              },
            ],
            directus_revisions: [
              {
                id: 1,
                activity: 1,
                collection: "posts",
                item: postId,
                data: {
                  ...post,
                  tags: [{ tags_id: tagId }],
                  topics: [{ topics_id: topicId }],
                },
              },
              {
                id: 2,
                activity: 2,
                collection: "posts",
                item: postId,
                data: { id: postId, title: "只有标题的旧 delta" },
              },
              {
                id: 3,
                activity: 3,
                collection: "posts_tags",
                item: 1,
                data: { tags_id: tagId },
              },
            ],
            directus_activity: [
              { id: 1, timestamp: "2024-01-01T08:00:00.000Z" },
              { id: 2, timestamp: "2024-01-02T08:00:00.000Z" },
            ],
          });
          const source = {
            format: "directus-content-source",
            version: 1,
            exportedAt: "2026-10-14T00:00:00.000Z",
            tables,
          };
          const targetRoot = path.join(root, "imported-media");
          process.env.CMS_MEDIA_ROOT = targetRoot;
          await assert.rejects(
            importSource(
              pool,
              targetRoot,
              {
                ...source,
                tables: {
                  ...tables,
                  posts: [{ ...post, title: "x".repeat(241) }],
                },
              },
              uploads,
              "http://old-cms.invalid",
            ),
          );
          assert.equal(
            (await store.list()).length,
            0,
            "an interrupted import never installs partial content",
          );
          const report = z
            .object({
              targetCounts: z.record(z.string(), z.number()),
              limitations: z.array(
                z.object({
                  source: z.string(),
                  id: z.string(),
                  reason: z.string(),
                }),
              ),
              readyForCutover: z.boolean(),
            })
            .parse(
              await importSource(
                pool,
                targetRoot,
                source,
                uploads,
                "http://old-cms.invalid",
              ),
            );
          assert.equal(report.limitations.length, 2);
          assert.equal(
            report.readyForCutover,
            false,
            "partial and unbound historical records require explicit reconciliation",
          );
          assert.ok(
            report.limitations.some(
              (entry) => entry.source === "revisions" && entry.id === "3",
            ),
            "junction histories must not silently disappear from the report",
          );
          assert.equal(
            report.targetCounts.source_archives,
            1,
            "reported archive count matches persisted archive",
          );
          const published = await store.detail(post.slug);
          assert.equal(published?.post.title, post.title);
          assert.equal(published?.post.publishedAt, post.published_at);
          assert.match(
            published!.post.content,
            new RegExp(`/media/${imageId}`),
          );
          assert.match(
            published!.post.content,
            new RegExp(`directus://${imageId}`),
            "code samples are not rewritten",
          );
          assert.equal((await store.get(postId)).draft.title, "还没发布的修改");
          assert.equal(
            (await store.list()).filter((item) => item.draft.kind === "note")
              .length,
            1,
          );
          assert.deepEqual((await store.get(postId)).draft.topicIds, [topicId]);
          assert.equal((await store.mediaFile(svgId))?.mime, "image/png");
          assert.equal(await store.mediaFile(svgId, true), null);
          assert.ok(
            await readFile(path.join(targetRoot, "originals", `${svgId}.svg`)),
          );
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int AS count FROM author_cms.source_archives",
              )
            ).rows[0]?.count,
            1,
          );
          const count = (await store.list()).length;
          await importSource(
            pool,
            targetRoot,
            source,
            uploads,
            "http://old-cms.invalid",
          );
          assert.equal(
            (await store.list()).length,
            count,
            "replay never overwrites author data",
          );
          const bundle = await exportBundle(
            pool,
            targetRoot,
            path.join(root, "source-bundle"),
          );
          assert.equal(
            bundle.files.length,
            3,
            "safe display files and original SVG are both backed up",
          );
        },
      );
      await t.test(
        "history reconciliation never borrows current relations and recovers proven deletions privately",
        async () => {
          await pool.query("DROP SCHEMA author_cms CASCADE");
          await migrate(pool);
          const postId = randomUUID(),
            topicId = randomUUID(),
            currentTag = randomUUID(),
            historicalTag = randomUUID(),
            deletedPost = randomUUID(),
            deletedTopic = randomUUID(),
            unboundTopic = randomUUID(),
            partialPost = randomUUID(),
            deletedSocial = randomUUID();
          const post = {
            id: postId,
            kind: "article",
            status: "published",
            title: "当前文章",
            slug: "kept-address",
            body: "当前正文",
            published_at: "2024-01-01T00:00:00.000Z",
          };
          const full = {
            ...post,
            title: "历史文章",
            body: "历史正文",
            tags: [{ tags_id: historicalTag }],
            topics: [],
          };
          const rows = [
            { id: 1, collection: "posts", item: postId, data: full },
            {
              id: 2,
              collection: "posts",
              item: postId,
              data: { ...full, tags: [{ id: 11 }] },
            },
            {
              id: 3,
              collection: "posts",
              item: postId,
              data: { ...full, tags: { create: [], delete: [] } },
            },
            { id: 4, collection: "posts", item: postId, data: post },
            {
              id: 5,
              collection: "posts",
              item: deletedPost,
              data: {
                ...full,
                id: deletedPost,
                slug: post.slug,
                tags: [],
                topics: [],
              },
            },
            {
              id: 6,
              collection: "topics",
              item: deletedTopic,
              data: {
                id: deletedTopic,
                name: "已删除专题",
                slug: "deleted-topic",
              },
            },
            {
              id: 7,
              collection: "topics",
              item: deletedTopic,
              data: {
                id: deletedTopic,
                name: "专题的新修订",
                slug: "deleted-topic",
                description: "恢复最新完整字段",
              },
            },
            {
              id: 8,
              collection: "topics",
              item: unboundTopic,
              data: {
                id: unboundTopic,
                name: "未证明删除",
                slug: "unbound-topic",
              },
            },
            {
              id: 9,
              collection: "posts",
              item: partialPost,
              data: { id: partialPost, title: "缺正文" },
            },
            { id: 10, collection: "posts_tags", item: 11, data: { id: 11 } },
            {
              id: 11,
              collection: "site_settings",
              item: randomUUID(),
              data: { author_name: "历史作者" },
            },
            {
              id: 12,
              collection: "posts",
              item: postId,
              data: full,
              version: randomUUID(),
            },
          ];
          const timestamp = (day: number) =>
            `2024-01-${String(day).padStart(2, "0")}T08:00:00.000Z`;
          const tables = Object.fromEntries(
            sourceTables.map((table) => [table, []]),
          );
          Object.assign(tables, {
            posts: [post],
            topics: [{ id: topicId, name: "当前专题", slug: "current-topic" }],
            tags: [
              { id: currentTag, name: "当前标签", slug: "current-tag" },
              { id: historicalTag, name: "历史标签", slug: "historical-tag" },
            ],
            posts_tags: [{ id: 11, posts_id: postId, tags_id: currentTag }],
            posts_topics: [{ id: 12, posts_id: postId, topics_id: topicId }],
            // Source export order is not a chronology guarantee.
            directus_revisions: rows
              .map((row) => ({ ...row, activity: row.id }))
              .reverse(),
            directus_activity: [
              ...rows.map((row) => ({
                id: row.id,
                collection: row.collection,
                item: row.item,
                action: row.id === 7 ? "update" : "create",
                timestamp: timestamp(row.id),
              })),
              ...[deletedPost, deletedTopic, partialPost, deletedSocial].map(
                (item, index) => ({
                  id: 20 + index,
                  collection:
                    index === 1
                      ? "topics"
                      : index === 3
                        ? "social_links"
                        : "posts",
                  item,
                  action: "delete",
                  timestamp: timestamp(20 + index),
                }),
              ),
            ].reverse(),
          });
          const source = {
            format: "directus-content-source",
            version: 1,
            exportedAt: "2026-10-14T00:00:00.000Z",
            tables,
          };
          const targetRoot = path.join(root, "history-media");
          const reportSchema = z.object({
            limitations: z.array(
              z.object({
                source: z.string(),
                id: z.string(),
                code: z.string(),
                missingFields: z.array(z.string()),
              }),
            ),
            historyReconciliation: z.object({
              counts: z.record(z.string(), z.number()),
              records: z.array(
                z.object({
                  source: z.string(),
                  id: z.string(),
                  disposition: z.string(),
                  targetId: z.string().optional(),
                  targetRevisionId: z.string().optional(),
                  timestamp: z.string().nullable(),
                }),
              ),
            }),
            readyForCutover: z.boolean(),
          });
          const result = await importSource(
            pool,
            targetRoot,
            source,
            root,
            "http://old-cms.invalid",
          );
          const report = reportSchema.parse(result);
          assert.equal(report.readyForCutover, false);
          assert.equal(report.limitations.length, 9);
          assert.deepEqual(report.historyReconciliation.counts, {
            versions: 0,
            revisions: 12,
            activitiesWithoutRevision: 4,
            converted: 1,
            recoveredArchivedRevisions: 3,
            recoveredArchivedContents: 2,
            archiveOnly: 9,
            eventOnly: 3,
          });
          const gaps = new Map(
            report.limitations
              .filter((row) => row.source === "revisions")
              .map((row) => [row.id, row]),
          );
          for (const id of ["2", "3", "4"])
            assert.equal(gaps.get(id)?.code, "incomplete-history-relations");
          assert.deepEqual(gaps.get("2")?.missingFields, ["tags.tags_id"]);
          assert.deepEqual(gaps.get("4")?.missingFields, ["tags", "topics"]);
          assert.equal(gaps.get("8")?.code, "unbound-content-history");
          assert.equal(gaps.get("9")?.code, "partial-content-snapshot");
          assert.deepEqual(gaps.get("10")?.missingFields, [
            "posts_id",
            "tags_id",
          ]);
          assert.equal(gaps.get("11")?.code, "non-content-history");
          assert.equal(gaps.get("12")?.code, "version-delta");
          assert.equal(
            report.limitations.find((row) => row.source === "activities")?.code,
            "deleted-item-without-snapshot",
          );
          const historical = (await store.history(postId)).find(
            (row) => row.source === "directus-revision:1",
          )!;
          assert.deepEqual(historical.data.tagIds, [historicalTag]);
          assert.deepEqual(
            historical.data.topicIds,
            [],
            "empty historical relations stay empty despite current links",
          );
          const current = await store.get(postId);
          assert.deepEqual(current.draft.tagIds, [currentTag]);
          assert.deepEqual(current.draft.topicIds, [topicId]);
          assert.equal(
            (await store.detail(post.slug))?.post.content,
            post.body,
          );
          assert.equal((await store.catalog()).posts.length, 1);
          for (const id of [deletedPost, deletedTopic]) {
            const item = await store.get(id);
            assert.equal(item.archived, true);
            assert.equal(item.publishedRevisionId, null);
            assert.equal(item.publishedSlug, null);
          }
          const recoveredTopic = await store.get(deletedTopic);
          assert.equal(recoveredTopic.draft.title, "专题的新修订");
          assert.equal(recoveredTopic.draft.summary, "恢复最新完整字段");
          assert.equal(
            new Date(recoveredTopic.createdAt).toISOString(),
            timestamp(6),
          );
          assert.equal(
            new Date(recoveredTopic.updatedAt).toISOString(),
            timestamp(7),
          );
          assert.equal(
            (await store.list()).length,
            4,
            "partial or unproven records never create live contents",
          );
          const data = await databaseData(pool);
          assert.deepEqual(
            data.source_archives[0]?.data &&
              (data.source_archives[0].data as { source: unknown }).source,
            source,
          );
          assert.deepEqual(
            data.slug_aliases,
            [{ slug: post.slug, content_id: postId }],
            "archival recovery does not reserve deleted addresses",
          );
          for (const record of report.historyReconciliation.records.filter(
            (row) => row.targetRevisionId,
          )) {
            assert.ok(
              data.content_revisions.some(
                (row) =>
                  row.id === record.targetRevisionId &&
                  row.content_id === record.targetId,
              ),
            );
          }
          assert.deepEqual(
            await importSource(
              pool,
              targetRoot,
              source,
              root,
              "http://old-cms.invalid",
            ),
            result,
          );
          await exportBundle(
            pool,
            targetRoot,
            path.join(root, "history-bundle"),
          );
          await pool.query("DROP SCHEMA author_cms CASCADE");
          await migrate(pool);
          await restoreBundle(
            pool,
            path.join(root, "history-restored"),
            path.join(root, "history-bundle"),
          );
          assert.deepEqual(
            await databaseData(pool),
            data,
            "recovered history, audit and raw source survive full restore",
          );
        },
      );
    } finally {
      await closePool();
      await pool.end();
      await rm(root, { recursive: true, force: true });
    }
  },
);
