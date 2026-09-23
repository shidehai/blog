import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  adminClient,
  directusClient,
  filterPath,
  isDirectusError,
} from "../directus/client.mjs";
import { IDS, RETIRED_LEGACY_READER_IDS } from "../directus/constants.mjs";
import {
  EDITORIAL_IDS,
  EDITORIAL_POST_IDS,
  LEGACY_FIXTURE_POSTS,
} from "../directus/seed/content.mjs";
import { loadSeedCoverFixture } from "../directus/seed/fixtures.mjs";

const mode = process.argv[2];
const admin = await adminClient();
const fixture = {
  published: EDITORIAL_POST_IDS["production-llm-reliability-boundaries"],
  archived: "f2000000-0000-4000-8000-000000000004",
};

/**
 * @typedef {ReturnType<typeof directusClient>} DirectusRequest
 * @typedef {Parameters<DirectusRequest>[1]} DirectusRequestOptions
 * @typedef {{ override?: boolean | null, default: boolean }} Entitlement
 * @typedef {{ name: string, usage: { collections: number }, entitlements: { custom_permission_rules_enabled: Entitlement, production_enabled: Entitlement } }} License
 * @typedef {{ version: string, files: { mimeTypeAllowList: string[] } }} ServerInfo
 * @typedef {{ collection: string, meta: { versioning?: boolean, singleton?: boolean, preview_url?: string | null } }} CollectionRecord
 * @typedef {{ collection: string, field: string, meta: { interface: string | null, validation: unknown }, schema: { is_unique: boolean, is_indexed: boolean, is_nullable: boolean, default_value: unknown } }} FieldRecord
 * @typedef {{ collection: string, field: string, related_collection: string | null }} RelationRecord
 * @typedef {{ id?: string, status?: string, kind?: string, title?: string, body?: string, slug?: string, featured?: boolean, cover_image?: string | null }} PostRecord
 * @typedef {{ id: string, site_name: string, author_name: string, locale: string, timezone: string, default_og_image: string | null }} SiteSettings
 * @typedef {{ id: string, folder: string | null, title: string | null, type: string | null, filename_download: string, filesize: string | number, width: number | null, height: number | null }} FileRecord
 * @typedef {{ id: string, name: string, slug: string }} TopicRecord
 * @typedef {{ id: string, posts_id: string, topics_id: string }} PostTopicRecord
 * @typedef {{ id: string }} SocialLinkRecord
 * @typedef {{ id: string, name: string, admin_access: boolean, app_access: boolean, enforce_tfa: boolean }} PolicyRecord
 * @typedef {{ id: string, email: string | null, tfa_secret: string | null }} UserRecord
 * @typedef {{ id: string }} IdentityRecord
 * @typedef {{ id: string }} VersionRecord
 * @typedef {{ current: { title: string }, mainHash: string }} VersionComparison
 * @typedef {{ collection: string, data?: { title?: string } }} RevisionRecord
 * @typedef {{ collection: string, action: string }} ActivityRecord
 */

/**
 * @param {string} sql
 */
function postgres(sql) {
  const user = process.env.POSTGRES_USER;
  const database = process.env.POSTGRES_DB;
  assert.ok(user, "POSTGRES_USER is required");
  assert.ok(database, "POSTGRES_DB is required");
  return execFileSync(
    "docker",
    [
      "compose",
      "--env-file",
      ".env",
      "-f",
      "deploy/compose.yaml",
      "-f",
      "deploy/compose.dev.yaml",
      "exec",
      "-T",
      "postgres",
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      user,
      "-d",
      database,
      "-Atc",
      sql,
    ],
    { encoding: "utf8" },
  ).trim();
}

/**
 * @param {DirectusRequest} request
 * @param {string} path
 * @param {DirectusRequestOptions} [options]
 */
async function rejects(request, path, options) {
  try {
    await request(path, options);
  } catch (error) {
    assert.ok(isDirectusError(error), "Expected a Directus HTTP error");
    assert.ok([400, 403, 404, 422, 500].includes(error.status), error.message);
    return error;
  }
  assert.fail(`${options?.method || "GET"} ${path} unexpectedly succeeded`);
}

async function schemaCheck() {
  const coverFixture = await loadSeedCoverFixture();
  /** @type {Promise<[ServerInfo, License, CollectionRecord[], FieldRecord[], RelationRecord[], PostRecord[], SiteSettings, FileRecord[], TopicRecord[], PostTopicRecord[], SocialLinkRecord[]]>} */
  const responses = Promise.all([
    admin("/server/info"),
    admin("/license"),
    admin("/collections?limit=-1&fields=*"),
    admin("/fields?limit=-1&fields=*"),
    admin("/relations?limit=-1&fields=*"),
    admin(
      "/items/posts?limit=-1&fields=id,status,kind,slug,featured,cover_image",
    ),
    admin(
      "/items/site_settings?fields=id,site_name,author_name,locale,timezone,default_og_image",
    ),
    admin(
      "/files?limit=-1&fields=id,title,type,filename_download,filesize,width,height,folder",
    ),
    admin("/items/topics?limit=-1&fields=id,name,slug"),
    admin("/items/posts_topics?limit=-1&fields=id,posts_id,topics_id"),
    admin("/items/social_links?limit=-1&fields=id"),
  ]);
  const [
    info,
    license,
    collections,
    fields,
    relations,
    posts,
    settings,
    files,
    topics,
    postTopics,
    socialLinks,
  ] = await responses;

  assert.equal(info.version, "12.2.0");
  assert.deepEqual(info.files.mimeTypeAllowList, [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "image/gif",
    "image/svg+xml",
  ]);
  assert.equal(license.name, "Core");
  assert.equal(license.usage.collections, 9);

  const expectedCollections = [
    "categories",
    "posts",
    "posts_tags",
    "posts_topics",
    "series",
    "site_settings",
    "social_links",
    "tags",
    "topics",
  ];
  for (const name of expectedCollections)
    assert.ok(
      collections.some((entry) => entry.collection === name),
      name,
    );
  assert.equal(
    collections.find((entry) => entry.collection === "posts")?.meta.versioning,
    true,
  );
  assert.equal(
    collections.find((entry) => entry.collection === "posts")?.meta
      .preview_url,
    null,
    "Posts must not advertise a retired preview URL",
  );
  assert.equal(
    collections.find((entry) => entry.collection === "site_settings")?.meta
      .singleton,
    true,
  );
  assert.equal(
    collections.find((entry) => entry.collection === "site_settings")?.meta
      .versioning,
    true,
  );

  /**
   * @param {string} collection
   * @param {string} name
   */
  const field = (collection, name) => {
    const match = fields.find(
      (entry) => entry.collection === collection && entry.field === name,
    );
    assert.ok(match, `${collection}.${name}`);
    return match;
  };
  assert.equal(field("posts", "body").meta.interface, "input-rich-text-md");
  assert.equal(field("posts", "slug").schema.is_unique, true);
  assert.equal(field("posts", "status").schema.is_indexed, true);
  assert.equal(field("posts", "kind").schema.is_indexed, true);
  assert.equal(field("topics", "slug").schema.is_unique, true);
  assert.equal(field("categories", "slug").schema.is_unique, true);
  assert.equal(field("tags", "slug").schema.is_unique, true);
  assert.equal(field("series", "slug").schema.is_unique, true);
  assert.equal(field("posts", "category").schema.is_nullable, true);
  assert.equal(field("posts", "series").schema.is_nullable, true);
  assert.equal(field("posts", "series_order").schema.is_nullable, true);
  assert.equal(field("site_settings", "locale").schema.default_value, "zh-CN");
  assert.equal(
    field("site_settings", "timezone").schema.default_value,
    "Asia/Shanghai",
  );
  assert.ok(field("posts", "status").meta.validation);

  /**
   * @param {string} collection
   * @param {string} name
   * @param {string} related
   */
  const relation = (collection, name, related) =>
    relations.some(
      (entry) =>
        entry.collection === collection &&
        entry.field === name &&
        entry.related_collection === related,
    );
  assert.ok(relation("posts_topics", "posts_id", "posts"));
  assert.ok(relation("posts_topics", "topics_id", "topics"));
  assert.ok(relation("posts_tags", "posts_id", "posts"));
  assert.ok(relation("posts_tags", "tags_id", "tags"));
  assert.ok(relation("posts", "category", "categories"));
  assert.ok(relation("posts", "series", "series"));
  assert.ok(relation("posts", "cover_image", "directus_files"));
  assert.ok(relation("social_links", "site_settings_id", "site_settings"));

  const publishedPosts = posts.filter((post) => post.status === "published");
  const archivedPosts = posts.filter((post) => post.status === "archived");
  assert.equal(publishedPosts.length, 12);
  assert.deepEqual(
    Object.fromEntries(
      ["article", "tutorial", "note"].map((kind) => [
        kind,
        publishedPosts.filter((post) => post.kind === kind).length,
      ]),
    ),
    { article: 5, tutorial: 4, note: 3 },
  );
  assert.equal(archivedPosts.length, 4);
  assert.deepEqual(
    new Map(archivedPosts.map((post) => [post.id, post.slug])),
    new Map(LEGACY_FIXTURE_POSTS.map((post) => [post.id, post.slug])),
  );
  assert.equal(topics.length, 6);
  assert.equal(postTopics.length, 28);
  assert.equal(
    new Set(postTopics.map((relation) => relation.topics_id)).size,
    topics.length,
  );
  assert.equal(
    new Set(
      postTopics.map(
        (relation) => `${relation.posts_id}:${relation.topics_id}`,
      ),
    ).size,
    postTopics.length,
  );
  const archivedIds = new Set(archivedPosts.map((post) => post.id));
  assert.ok(
    postTopics.every((relation) => !archivedIds.has(relation.posts_id)),
  );
  assert.ok(
    EDITORIAL_IDS.socialLinks.every(
      (id) => !socialLinks.some((link) => link.id === id),
    ),
  );
  const currentCovers = files.filter(
    (file) => file.title === coverFixture.title,
  );
  assert.equal(currentCovers.length, 1);
  const [currentCover] = currentCovers;
  assert.ok(currentCover);
  assert.deepEqual(
    {
      filename: currentCover.filename_download,
      filesize: Number(currentCover.filesize),
      folder: currentCover.folder,
      height: currentCover.height,
      type: currentCover.type,
      width: currentCover.width,
    },
    {
      filename: coverFixture.filename,
      filesize: coverFixture.bytes.byteLength,
      folder: IDS.folders.publishable,
      height: 540,
      type: coverFixture.mimeType,
      width: 960,
    },
  );
  assert.deepEqual(settings, {
    default_og_image: currentCover.id,
    id: EDITORIAL_IDS.settings,
    site_name: "海边的小卖部",
    author_name: "关山",
    locale: "zh-CN",
    timezone: "Asia/Shanghai",
  });
  const featuredPosts = posts.filter((post) => post.featured);
  assert.equal(featuredPosts.length, 1);
  assert.equal(featuredPosts[0]?.cover_image, currentCover.id);
  const oldCovers = files.filter(
    (file) => file.title === "示例封面（非真实内容）",
  );
  assert.ok(oldCovers.length <= 1);
  const [oldCover] = oldCovers;
  if (oldCover) {
    assert.deepEqual(
      {
        filename: oldCover.filename_download,
        filesize: Number(oldCover.filesize),
        folder: oldCover.folder,
        height: oldCover.height,
        type: oldCover.type,
        width: oldCover.width,
      },
      {
        filename: "fixture-cover.png",
        filesize: 70,
        folder: IDS.folders.publishable,
        height: 1,
        type: "image/png",
        width: 1,
      },
    );
    assert.notEqual(settings.default_og_image, oldCover.id);
    assert.ok(posts.every((post) => post.cover_image !== oldCover.id));
  }
  assert.equal(
    files.filter((file) => file.folder === IDS.folders.private).length,
    1,
  );

  const databaseObjects = postgres(`
    SELECT conname FROM pg_constraint
    WHERE conname IN ('posts_status_valid','posts_kind_valid','posts_slug_valid','posts_publishable','topics_slug_valid','site_settings_locale_valid','site_settings_timezone_valid','social_links_icon_valid')
    UNION ALL
    SELECT indexname FROM pg_indexes
    WHERE indexname IN ('posts_topics_pair_unique','posts_status_published_at_index','posts_status_kind_published_at_index')
    ORDER BY 1;
  `).split("\n");
  assert.equal(databaseObjects.length, 11);
  assert.equal(
    postgres(
      "SELECT count(*) FROM pg_trigger WHERE tgname = 'posts_keep_slug_stable';",
    ),
    "1",
  );

  console.log("Directus schema check passed");
}

/**
 * @param {License} license
 */
function hasCustomPermissions(license) {
  const entitlement = license.entitlements.custom_permission_rules_enabled;
  return entitlement.override ?? entitlement.default;
}

async function accessCheck() {
  /** @type {License} */
  const license = await admin("/license");
  assert.ok(
    hasCustomPermissions(license),
    "Directus Core cannot enforce status/folder/field-scoped credentials. Activate an OIG or paid license and rerun pnpm directus:bootstrap.",
  );

  const build = directusClient(process.env.DIRECTUS_BUILD_TOKEN);
  const author = directusClient(process.env.DIRECTUS_TEST_AUTHOR_TOKEN);
  const publicClient = directusClient();

  await rejects(publicClient, "/items/posts?limit=1");
  await rejects(publicClient, "/items/site_settings");

  /** @type {PostRecord[]} */
  const builtPosts = await build(
    "/items/posts?limit=-1&fields=id,status,kind",
  );
  assert.ok(builtPosts.length >= 3);
  assert.ok(builtPosts.every((post) => post.status === "published"));
  assert.ok(
    builtPosts.every(
      (post) => post.kind === "article" || post.kind === "tutorial",
    ),
    "Build Reader must not receive published notes",
  );
  await rejects(build, `/items/posts/${fixture.archived}?fields=id,status`);
  await rejects(build, "/items/posts", { method: "POST", body: {} });
  await rejects(build, "/items/topics?limit=1");
  await rejects(build, "/items/posts_topics?limit=1");

  /** @type {FileRecord[]} */
  const publicFiles = await build("/files?limit=-1&fields=id,title,folder");
  assert.ok(publicFiles.length >= 1);
  assert.ok(
    publicFiles.every((file) => file.folder === IDS.folders.publishable),
  );

  const testTopic = randomUUID();
  await author("/items/topics", {
    method: "POST",
    body: {
      id: testTopic,
      name: `权限测试 ${testTopic.slice(0, 8)}`,
      slug: `access-${testTopic}`,
    },
  });
  await author(`/items/topics/${testTopic}`, { method: "DELETE" });
  /** @type {FileRecord[]} */
  const files = await admin("/files?limit=-1&fields=id,title,folder");
  const privateFile = files.find(
    (file) => file.folder === IDS.folders.private,
  );
  assert.ok(privateFile, "No private fixture file found");
  await rejects(author, `/files/${privateFile.id}`, { method: "DELETE" });

  /** @type {Promise<[PolicyRecord[], UserRecord[], IdentityRecord[], IdentityRecord[]]>} */
  const responses = Promise.all([
    admin(
      "/policies?limit=-1&fields=id,name,admin_access,app_access,enforce_tfa",
    ),
    admin("/users?limit=-1&fields=id,email,role,tfa_secret"),
    admin("/roles?limit=-1&fields=id"),
    admin("/access?limit=-1&fields=id"),
  ]);
  const [policies, users, roles, access] = await responses;
  /** @param {string} name */
  const policy = (name) => {
    const match = policies.find((entry) => entry.name === name);
    assert.ok(match, name);
    return match;
  };
  assert.deepEqual(
    [
      policy("Author").admin_access,
      policy("Author").app_access,
      policy("Author").enforce_tfa,
    ],
    [false, true, true],
  );
  assert.deepEqual(
    [
      policy("Break-glass Administrator").admin_access,
      policy("Break-glass Administrator").enforce_tfa,
    ],
    [true, true],
  );
  assert.ok(
    !policies.some((policy) => policy.id === RETIRED_LEGACY_READER_IDS.policy),
    "retired reader policy must be absent after bootstrap",
  );
  assert.ok(
    !users.some((user) => user.id === RETIRED_LEGACY_READER_IDS.user),
    "retired reader user must be absent after bootstrap",
  );
  assert.ok(
    !roles.some((role) => role.id === RETIRED_LEGACY_READER_IDS.role),
    "retired reader role must be absent after bootstrap",
  );
  assert.ok(
    !access.some((entry) => entry.id === RETIRED_LEGACY_READER_IDS.access),
    "retired reader access must be absent after bootstrap",
  );
  for (const email of [
    process.env.DIRECTUS_AUTHOR_EMAIL,
    process.env.DIRECTUS_BREAK_GLASS_EMAIL,
  ]) {
    assert.ok(
      users.find((user) => user.email === email)?.tfa_secret,
      `${email} has no TFA enrollment`,
    );
  }

  console.log("Directus access check passed");
}

async function workflowCheck() {
  const suffix = randomUUID();
  const slug = `workflow-${suffix}`;
  const topicId = randomUUID();
  const joinId = randomUUID();
  let postId;
  let versionId;
  let namedVersionId;

  await rejects(admin, "/items/posts", {
    method: "POST",
    body: {
      status: "published",
      kind: "article",
      title: "无摘要",
      slug: `invalid-${suffix}`,
      body: "正文",
      published_at: new Date().toISOString(),
    },
  });
  await rejects(admin, "/items/posts", {
    method: "POST",
    body: {
      status: "published",
      kind: "note",
      title: "坏 slug",
      slug: `Bad_${suffix}`,
      body: "正文",
      published_at: new Date().toISOString(),
    },
  });
  await rejects(admin, `/items/posts/${fixture.published}`, {
    method: "PATCH",
    body: { slug: `changed-${suffix}` },
  });

  const markdown =
    "# 自动化首稿\n\n中文与 `code` 保持原样。\n\n> [!NOTE]\n> 版本草稿检查。\n";
  try {
    /** @type {VersionRecord} */
    const version = await admin("/versions", {
      method: "POST",
      body: {
        key: "draft",
        name: "自动化首稿",
        collection: "posts",
        item: null,
      },
    });
    versionId = version.id;
    /** @type {{ body: string }} */
    const saved = await admin(`/versions/${versionId}/save`, {
      method: "POST",
      body: {
        status: "published",
        kind: "article",
        title: "自动化版本文章",
        slug,
        summary: "用于验证 Directus 内容版本的假摘要。",
        body: markdown,
        published_at: new Date().toISOString(),
        featured: false,
        cover_decorative: false,
      },
    });
    assert.equal(saved.body, markdown);

    /** @type {string} */
    const promotedPostId = await admin(`/versions/${versionId}/promote`, {
      method: "POST",
      body: {},
    });
    postId = promotedPostId;
    /** @type {PostRecord} */
    const published = await admin(`/items/posts/${postId}?fields=*`);
    assert.equal(published.body, markdown);
    assert.equal(published.status, "published");

    /** @type {VersionRecord} */
    const named = await admin("/versions", {
      method: "POST",
      body: {
        key: `review-${suffix.slice(0, 8)}`,
        name: "命名修订",
        collection: "posts",
        item: postId,
      },
    });
    namedVersionId = named.id;
    await admin(`/versions/${namedVersionId}/save`, {
      method: "POST",
      body: { title: "自动化版本文章（修订）" },
    });
    /** @type {VersionComparison} */
    const comparison = await admin(`/versions/${namedVersionId}/compare`);
    assert.equal(comparison.current.title, "自动化版本文章（修订）");
    await admin(`/versions/${namedVersionId}/promote`, {
      method: "POST",
      body: { mainHash: comparison.mainHash },
    });
    /** @type {PostRecord} */
    const namedPost = await admin(`/items/posts/${postId}?fields=title`);
    assert.equal(namedPost.title, "自动化版本文章（修订）");

    await admin(`/items/posts/${postId}`, {
      method: "PATCH",
      body: { status: "archived" },
    });
    /** @type {PostRecord} */
    const archivedPost = await admin(`/items/posts/${postId}?fields=status`);
    assert.equal(archivedPost.status, "archived");
    await admin(`/items/posts/${postId}`, {
      method: "PATCH",
      body: { status: "published" },
    });

    await admin(`/items/posts/${postId}`, {
      method: "PATCH",
      body: { title: "临时标题" },
    });
    /** @type {RevisionRecord[]} */
    const revisions = await admin(
      `${filterPath("revisions", "item", postId, "id,collection,item,data,delta,activity")}&sort=id`,
    );
    const restorable = revisions.find(
      (revision) =>
        revision.collection === "posts" &&
        revision.data?.title === "自动化版本文章（修订）",
    );
    assert.ok(restorable, "No restorable revision found");
    assert.ok(restorable.data, "Restorable revision has no data");
    await admin(`/items/posts/${postId}`, {
      method: "PATCH",
      body: { title: restorable.data.title },
    });
    /** @type {PostRecord} */
    const restoredPost = await admin(`/items/posts/${postId}?fields=title`);
    assert.equal(restoredPost.title, "自动化版本文章（修订）");

    await admin("/items/topics", {
      method: "POST",
      body: {
        id: topicId,
        name: `工作流主题 ${suffix.slice(0, 8)}`,
        slug: `workflow-topic-${suffix}`,
      },
    });
    await admin("/items/posts_topics", {
      method: "POST",
      body: { id: joinId, posts_id: postId, topics_id: topicId },
    });
    await admin(`/items/posts_topics/${joinId}`, { method: "DELETE" });
    await admin(`/items/topics/${topicId}`, { method: "DELETE" });

    await admin(`/items/posts/${postId}`, { method: "DELETE" });
    /** @type {ActivityRecord[]} */
    const activities = await admin(
      filterPath("activity", "item", postId, "id,action,collection,item"),
    );
    const actions = new Set(
      activities
        .filter((entry) => entry.collection === "posts")
        .map((entry) => entry.action),
    );
    for (const action of ["create", "update", "delete"])
      assert.ok(actions.has(action), `missing ${action} event`);
    postId = null;
  } finally {
    if (joinId)
      await admin(`/items/posts_topics/${joinId}`, { method: "DELETE" }).catch(
        () => {},
      );
    if (topicId)
      await admin(`/items/topics/${topicId}`, { method: "DELETE" }).catch(
        () => {},
      );
    if (postId)
      await admin(`/items/posts/${postId}`, { method: "DELETE" }).catch(
        () => {},
      );
    if (namedVersionId)
      await admin(`/versions/${namedVersionId}`, { method: "DELETE" }).catch(
        () => {},
      );
    if (versionId)
      await admin(`/versions/${versionId}`, { method: "DELETE" }).catch(
        () => {},
      );
  }

  /** @type {License} */
  const info = await admin("/license");
  assert.equal(
    info.entitlements.production_enabled.override ??
      info.entitlements.production_enabled.default,
    true,
  );
  console.log("Directus workflow check passed");
}

if (mode === "schema") await schemaCheck();
else if (mode === "access") await accessCheck();
else if (mode === "workflow") await workflowCheck();
else throw new Error("Expected schema, access, or workflow mode");
