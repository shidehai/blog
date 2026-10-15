import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { readVerifiedMedia } from "./media-files";
import { readEnvironment } from "./env";
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Pool } from "pg";
import {
  adminContentSchema,
  catalogSchema,
  DEFAULT_PROFILE,
  draftSchema,
  emptyDraft,
  mediaSchema,
  postSummarySchema,
  publicationSchema,
  siteProfileSchema,
  slugSchema,
  taxonomySchema,
  type AdminContent,
  type ContentDraft,
  type Media,
  type Post,
  type PublicCatalog,
  type Taxonomy,
} from "@blog/content-contracts";
import {
  collectMediaIds,
  deriveExcerpt,
  deriveReadingMinutes,
  deriveWordCount,
} from "@blog/markdown";
import { database, getPool } from "./db";
import { CmsError, conflict } from "./errors";

type Database = ReturnType<typeof database>;
type Executor = Pick<Database, "execute">;
async function records<T>(
  db: Executor,
  query: SQL,
  schema: z.ZodType<T>,
): Promise<T[]> {
  const result = await db.execute(query);
  return result.rows.map(
    (row) => z.object({ record: schema }).parse(row).record,
  );
}
const contentSelect = sql`SELECT jsonb_build_object('id',c.id,'version',c.version,'draftRevisionId',c.draft_revision_id,'publishedRevisionId',c.published_revision_id,'archived',c.archived,'createdAt',c.created_at,'updatedAt',c.updated_at,'draft',d.data,'publishedSlug',p.data->>'slug') AS record FROM author_cms.contents c JOIN author_cms.content_revisions d ON d.id=c.draft_revision_id LEFT JOIN author_cms.content_revisions p ON p.id=c.published_revision_id`;
const mediaSelect = sql`SELECT jsonb_build_object('id',m.id,'filename',m.filename,'mime',m.mime,'bytes',m.bytes,'width',m.width,'height',m.height,'sha256',m.sha256,'publishable',m.publishable,'createdAt',m.created_at,'references',(SELECT count(*)::int FROM author_cms.published_media_refs r WHERE r.media_id=m.id)) AS record FROM author_cms.media m`;
const revisionSchema = z.object({
  id: z.uuid(),
  data: draftSchema,
  source: z.string(),
  createdAt: z.string(),
});
const publishedRowSchema = z.object({
  id: z.uuid(),
  data: draftSchema,
  updatedAt: z.string(),
});
const profileRecordSchema = z.object({
  profile: siteProfileSchema,
  version: z.number().int(),
});

async function generation(db: Executor, increment = false): Promise<number> {
  const result = await db.execute(
    increment
      ? sql`UPDATE author_cms.public_state SET generation=generation+1 WHERE id=1 RETURNING generation::float8 AS generation`
      : sql`SELECT generation::float8 AS generation FROM author_cms.public_state WHERE id=1`,
  );
  return z
    .object({ generation: z.number().int().nonnegative() })
    .parse(result.rows[0]).generation;
}
async function findContent(
  db: Executor,
  id: string,
  lock = false,
): Promise<AdminContent> {
  const item = (
    await records(
      db,
      sql`${contentSelect} WHERE c.id=${id}::uuid ${lock ? sql`FOR UPDATE OF c` : sql``}`,
      adminContentSchema,
    )
  )[0];
  if (!item) throw new CmsError(404, "内容不存在");
  return item;
}
async function taxonomies(db: Executor): Promise<Taxonomy[]> {
  return records(
    db,
    sql`SELECT jsonb_build_object('id',id,'kind',kind,'name',name,'slug',slug,'description',description) AS record FROM author_cms.taxonomies ORDER BY kind,name`,
    taxonomySchema,
  );
}
async function profile(db: Executor) {
  return (
    (
      await records(
        db,
        sql`SELECT jsonb_build_object('profile',data,'version',version) AS record FROM author_cms.site_profile WHERE id=1`,
        profileRecordSchema,
      )
    )[0] ?? { profile: DEFAULT_PROFILE, version: 0 }
  );
}
async function assertSlug(db: Executor, slug: string, id: string) {
  if (!slug) return;
  const reserved = await db.execute(
    sql`SELECT 1 FROM author_cms.slug_aliases WHERE slug=${slug} AND content_id<>${id}::uuid UNION ALL SELECT 1 FROM author_cms.contents WHERE draft_slug=${slug} AND id<>${id}::uuid`,
  );
  if (reserved.rows.length)
    throw new CmsError(409, "这个文章地址已被其他内容使用，请换一个地址。");
}
async function assertRelations(db: Executor, data: ContentDraft) {
  const all = await taxonomies(db);
  for (const [id, kind] of [
    [data.categoryId, "category"],
    [data.seriesId, "series"],
    ...data.tagIds.map((id) => [id, "tag"]),
  ] as const) {
    if (id && !all.some((entry) => entry.id === id && entry.kind === kind))
      throw new CmsError(422, "分类、标签或系列已经变更，请重新选择。");
  }
  for (const id of data.topicIds) {
    const result = await db.execute(
      sql`SELECT 1 FROM author_cms.contents WHERE id=${id}::uuid AND kind='topic'`,
    );
    if (!result.rows.length) throw new CmsError(422, "关联专题不存在");
  }
}
async function setMediaReferences(
  db: Executor,
  sourceId: string,
  ids: string[],
) {
  const unique = [...new Set(ids)];
  for (const id of unique) {
    const result = await db.execute(
      sql`SELECT publishable,storage_key,bytes,sha256 FROM author_cms.media WHERE id=${id}::uuid FOR SHARE`,
    );
    const row = result.rows[0];
    if (!row)
      throw new CmsError(422, "正文或封面引用了不存在的图片，请重新选择。");
    const file = z
      .object({
        publishable: z.boolean(),
        storage_key: z.string(),
        bytes: z.number(),
        sha256: z.string(),
      })
      .parse(row);
    await readVerifiedMedia(readEnvironment().mediaRoot, file);
    if (!file.publishable)
      throw new CmsError(
        422,
        "文章引用了受保护的旧素材，请在媒体库明确允许公开后再发布。",
      );
  }
  await db.execute(
    sql`DELETE FROM author_cms.published_media_refs WHERE source_id=${sourceId}`,
  );
  for (const id of unique)
    await db.execute(
      sql`INSERT INTO author_cms.published_media_refs(media_id,source_id) VALUES(${id}::uuid,${sourceId})`,
    );
}
function projectPost(
  id: string,
  data: ContentDraft,
  updatedAt: string,
  all: Taxonomy[],
): Post {
  const category = all.find((entry) => entry.id === data.categoryId);
  const series = all.find((entry) => entry.id === data.seriesId);
  if (!data.publishedAt || !data.slug)
    throw new Error("已发布内容缺少发布时间或地址");
  return {
    id,
    title: data.title,
    slug: data.slug,
    summary: data.summary || deriveExcerpt(data.content),
    content: data.content,
    publishedAt: data.publishedAt,
    updatedAt,
    category: category?.name ?? "未分类",
    tags: all
      .filter((entry) => data.tagIds.includes(entry.id))
      .map((entry) => entry.name),
    ...(data.coverId ? { cover: `/media/${data.coverId}` } : {}),
    featured: data.featured,
    ...(series
      ? {
          series: {
            name: series.name,
            slug: series.slug,
            ...(data.seriesOrder === null ? {} : { order: data.seriesOrder }),
          },
        }
      : {}),
    readingMinutes: deriveReadingMinutes(data.content),
    wordCount: deriveWordCount(data.content),
  };
}

export class ContentStore {
  readonly db: Database;
  constructor(readonly pool: Pool) {
    this.db = database(pool);
  }
  async list() {
    return records(
      this.db,
      sql`${contentSelect} ORDER BY c.updated_at DESC,c.id`,
      adminContentSchema,
    );
  }
  async get(id: string) {
    return findContent(this.db, id);
  }
  async create(kind: ContentDraft["kind"]) {
    const id = randomUUID(),
      revisionId = randomUUID();
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`INSERT INTO author_cms.contents(id,kind,draft_revision_id) VALUES(${id}::uuid,${kind},${revisionId}::uuid)`,
      );
      await tx.execute(
        sql`INSERT INTO author_cms.content_revisions(id,content_id,data,source) VALUES(${revisionId}::uuid,${id}::uuid,${JSON.stringify(emptyDraft(kind))}::jsonb,'create')`,
      );
      return findContent(tx, id);
    });
  }
  async save(
    id: string,
    version: number,
    input: ContentDraft,
    source = "save",
  ) {
    const data = draftSchema.parse(input);
    return this.db.transaction(async (tx) => {
      const existing = await findContent(tx, id, true);
      if (existing.version !== version) conflict();
      if (data.kind !== existing.draft.kind)
        throw new CmsError(422, "内容类型不能在编辑时更改");
      await assertSlug(tx, data.slug, id);
      if (isDeepStrictEqual(existing.draft, data)) return existing;
      const revisionId = randomUUID();
      await tx.execute(
        sql`INSERT INTO author_cms.content_revisions(id,content_id,data,source) VALUES(${revisionId}::uuid,${id}::uuid,${JSON.stringify(data)}::jsonb,${source})`,
      );
      await tx.execute(
        sql`UPDATE author_cms.contents SET draft_revision_id=${revisionId}::uuid,draft_slug=${data.slug || null},version=version+1,updated_at=now() WHERE id=${id}::uuid`,
      );
      return findContent(tx, id);
    });
  }
  async history(id: string) {
    return records(
      this.db,
      sql`SELECT jsonb_build_object('id',id,'data',data,'source',source,'createdAt',created_at) AS record FROM author_cms.content_revisions WHERE content_id=${id}::uuid ORDER BY created_at DESC,id DESC`,
      revisionSchema,
    );
  }
  async restore(id: string, version: number, revisionId: string) {
    const entry = (
      await records(
        this.db,
        sql`SELECT jsonb_build_object('id',id,'data',data,'source',source,'createdAt',created_at) AS record FROM author_cms.content_revisions WHERE content_id=${id}::uuid AND id=${revisionId}::uuid`,
        revisionSchema,
      )
    )[0];
    if (!entry) throw new CmsError(404, "历史版本不存在");
    return this.save(id, version, entry.data, "restore");
  }
  async publish(
    id: string,
    input: { version: number; revisionId: string; key: string },
  ) {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${input.key}))`,
      );
      const replay = (
        await tx.execute(
          sql`SELECT content_id,request,result FROM author_cms.publication_requests WHERE key=${input.key}::uuid`,
        )
      ).rows[0];
      if (replay) {
        const row = z
          .object({
            content_id: z.uuid(),
            request: z.unknown(),
            result: publicationSchema,
          })
          .parse(replay);
        const saved = z
          .object({ revisionId: z.uuid(), version: z.number().int() })
          .parse(row.request);
        if (
          row.content_id !== id ||
          saved.revisionId !== input.revisionId ||
          saved.version !== input.version
        )
          throw new CmsError(409, "发布请求编号已用于其他操作");
        return row.result;
      }
      const item = await findContent(tx, id, true);
      if (
        item.version !== input.version ||
        item.draftRevisionId !== input.revisionId
      )
        conflict();
      if (!["article", "tutorial"].includes(item.draft.kind))
        throw new CmsError(
          422,
          "随记和专题保存在后台，首版不提供公开发布路由。",
        );
      const parsed = draftSchema
        .extend({
          title: z.string().trim().min(1).max(240),
          slug: slugSchema,
          content: z.string().trim().min(1).max(2_000_000),
        })
        .safeParse(item.draft);
      if (!parsed.success)
        throw new CmsError(422, "发布前请填写标题、文章地址和正文。");
      await assertSlug(tx, parsed.data.slug, id);
      await assertRelations(tx, parsed.data);
      const previous = item.publishedRevisionId
        ? (
            await tx.execute(
              sql`SELECT data FROM author_cms.content_revisions WHERE id=${item.publishedRevisionId}::uuid`,
            )
          ).rows[0]
        : undefined;
      const previousData = previous
        ? draftSchema.parse(previous.data)
        : undefined;
      const publishedAt =
        parsed.data.publishedAt ??
        previousData?.publishedAt ??
        new Date().toISOString();
      const data = { ...parsed.data, publishedAt };
      const ids = [
        ...collectMediaIds(data.content),
        ...(data.coverId ? [data.coverId] : []),
      ];
      await setMediaReferences(tx, id, ids);
      let revisionId = item.draftRevisionId;
      if (!isDeepStrictEqual(data, item.draft)) {
        revisionId = randomUUID();
        await tx.execute(
          sql`INSERT INTO author_cms.content_revisions(id,content_id,data,source) VALUES(${revisionId}::uuid,${id}::uuid,${JSON.stringify(data)}::jsonb,'publish')`,
        );
      }
      await tx.execute(
        sql`INSERT INTO author_cms.slug_aliases(slug,content_id) VALUES(${data.slug},${id}::uuid) ON CONFLICT(slug) DO NOTHING`,
      );
      await tx.execute(
        sql`UPDATE author_cms.contents SET published_revision_id=${revisionId}::uuid,draft_revision_id=${revisionId}::uuid,archived=false,version=version+1,updated_at=now() WHERE id=${id}::uuid`,
      );
      const result = {
        contentId: id,
        revisionId,
        generation: await generation(tx, true),
        slug: data.slug,
        publishedAt,
      };
      await tx.execute(
        sql`INSERT INTO author_cms.publication_requests(key,content_id,request,result) VALUES(${input.key}::uuid,${id}::uuid,${JSON.stringify({ revisionId: input.revisionId, version: input.version })}::jsonb,${JSON.stringify(result)}::jsonb)`,
      );
      return result;
    });
  }
  async publication(key: string) {
    const row = (
      await this.db.execute(
        sql`SELECT result FROM author_cms.publication_requests WHERE key=${key}::uuid`,
      )
    ).rows[0];
    return row ? publicationSchema.parse(row.result) : null;
  }
  async archive(id: string, version: number) {
    return this.db.transaction(async (tx) => {
      const item = await findContent(tx, id, true);
      if (item.version !== version) conflict();
      await tx.execute(
        sql`UPDATE author_cms.contents SET archived=true,version=version+1,updated_at=now() WHERE id=${id}::uuid`,
      );
      await tx.execute(
        sql`DELETE FROM author_cms.published_media_refs WHERE source_id=${id}`,
      );
      await generation(tx, true);
      return findContent(tx, id);
    });
  }
  async taxonomies() {
    return taxonomies(this.db);
  }
  async saveTaxonomy(input: Taxonomy) {
    const data = taxonomySchema.parse(input);
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`INSERT INTO author_cms.taxonomies(id,kind,name,slug,description) VALUES(${data.id}::uuid,${data.kind},${data.name},${data.slug},${data.description}) ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,description=excluded.description WHERE author_cms.taxonomies.kind=excluded.kind`,
      );
      await generation(tx, true);
    });
    return data;
  }
  async profile() {
    return profile(this.db);
  }
  async saveProfile(input: {
    profile: z.infer<typeof siteProfileSchema>;
    version: number;
  }) {
    const data = siteProfileSchema.parse(input.profile);
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(795231)`);
      const current = await profile(tx);
      if (current.version !== input.version) conflict();
      const avatar = data.avatar.match(/^\/media\/([\da-f-]{36})$/i)?.[1];
      await setMediaReferences(tx, "profile", avatar ? [avatar] : []);
      await tx.execute(
        sql`INSERT INTO author_cms.site_profile(id,data,version) VALUES(1,${JSON.stringify(data)}::jsonb,1) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=author_cms.site_profile.version+1`,
      );
      await generation(tx, true);
      return profile(tx);
    });
  }
  async media(): Promise<Media[]> {
    return records(
      this.db,
      sql`${mediaSelect} ORDER BY m.created_at DESC`,
      mediaSchema,
    );
  }
  async mediaReferences(id: string) {
    const candidates = await records(
      this.db,
      sql`SELECT jsonb_build_object('id',r.id,'contentId',r.content_id,'data',r.data,'draft',c.draft_revision_id=r.id,'published',c.published_revision_id=r.id AND NOT c.archived) AS record FROM author_cms.content_revisions r JOIN author_cms.contents c ON c.id=r.content_id WHERE r.data->>'coverId'=${id} OR position(${`/media/${id}`} in r.data->>'content')>0`,
      z.object({
        id: z.uuid(),
        contentId: z.uuid(),
        data: draftSchema,
        draft: z.boolean(),
        published: z.boolean(),
      }),
    );
    const grouped = new Map<
      string,
      {
        id: string;
        title: string;
        draft: boolean;
        published: boolean;
        history: number;
      }
    >();
    for (const row of candidates) {
      if (
        row.data.coverId !== id &&
        !collectMediaIds(row.data.content).includes(id)
      )
        continue;
      const entry = grouped.get(row.contentId) ?? {
        id: row.contentId,
        title: row.data.title,
        draft: false,
        published: false,
        history: 0,
      };
      entry.draft ||= row.draft;
      entry.published ||= row.published;
      entry.history++;
      if (row.draft) entry.title = row.data.title;
      grouped.set(row.contentId, entry);
    }
    return [...grouped.values()];
  }
  async mediaFile(id: string, publicOnly = false) {
    const result = await this.db.execute(
      sql`SELECT storage_key,mime,sha256,bytes FROM author_cms.media WHERE id=${id}::uuid ${publicOnly ? sql`AND publishable=true AND EXISTS(SELECT 1 FROM author_cms.published_media_refs WHERE media_id=${id}::uuid)` : sql``}`,
    );
    return result.rows[0]
      ? z
          .object({
            storage_key: z
              .string()
              .regex(/^[\da-f-]{36}\.(jpg|png|webp|gif|avif)$/i),
            mime: z.string(),
            sha256: z.string(),
            bytes: z.number(),
          })
          .parse(result.rows[0])
      : null;
  }
  async addMedia(
    input: Omit<Media, "createdAt" | "references"> & {
      storageKey: string;
      sourceMetadata?: unknown;
    },
  ) {
    await this.db.execute(
      sql`INSERT INTO author_cms.media(id,storage_key,filename,mime,bytes,width,height,sha256,publishable,source_metadata) VALUES(${input.id}::uuid,${input.storageKey},${input.filename},${input.mime},${input.bytes},${input.width},${input.height},${input.sha256},${input.publishable},${JSON.stringify(input.sourceMetadata ?? null)}::jsonb)`,
    );
    return (await this.media()).find((entry) => entry.id === input.id)!;
  }
  async allowMedia(id: string, allowed: boolean) {
    return this.db.transaction(async (tx) => {
      const result = await tx.execute(
        sql`UPDATE author_cms.media SET publishable=${allowed} WHERE id=${id}::uuid RETURNING id`,
      );
      if (!result.rows.length) throw new CmsError(404, "图片不存在");
      await generation(tx, true);
      return (
        await records(
          tx,
          sql`${mediaSelect} WHERE m.id=${id}::uuid`,
          mediaSchema,
        )
      )[0]!;
    });
  }
  async catalog(): Promise<PublicCatalog> {
    return this.db.transaction(
      async (tx) => {
        const all = await taxonomies(tx);
        const published = await records(
          tx,
          sql`SELECT jsonb_build_object('id',c.id,'data',r.data,'updatedAt',r.created_at) AS record FROM author_cms.contents c JOIN author_cms.content_revisions r ON r.id=c.published_revision_id WHERE c.archived=false AND c.kind IN ('article','tutorial')`,
          publishedRowSchema,
        );
        const full = published
          .map((row) => projectPost(row.id, row.data, row.updatedAt, all))
          .sort(
            (a, b) =>
              Date.parse(b.publishedAt) - Date.parse(a.publishedAt) ||
              a.id.localeCompare(b.id),
          );
        const posts = full.map((post) => postSummarySchema.parse(post));
        const categories = all
          .filter((entry) => entry.kind === "category")
          .map((entry) => ({
            name: entry.name,
            slug: entry.slug,
            count: posts.filter((post) => post.category === entry.name).length,
          }))
          .filter((entry) => entry.count > 0);
        const tags = all
          .filter((entry) => entry.kind === "tag")
          .map((entry) => ({
            name: entry.name,
            slug: entry.slug,
            count: posts.filter((post) => post.tags.includes(entry.name))
              .length,
          }))
          .filter((entry) => entry.count > 0);
        const series = all
          .filter((entry) => entry.kind === "series")
          .map((entry) => {
            const members = posts
              .filter((post) => post.series?.slug === entry.slug)
              .sort((a, b) => (a.series?.order ?? 0) - (b.series?.order ?? 0));
            return {
              id: entry.id,
              name: entry.name,
              slug: entry.slug,
              description: entry.description,
              count: members.length,
              posts: members.map(({ title, slug, publishedAt }) => ({
                title,
                slug,
                publishedAt,
              })),
            };
          })
          .filter((entry) => entry.count > 0);
        return catalogSchema.parse({
          generation: await generation(tx),
          profile: (await profile(tx)).profile,
          posts,
          categories,
          tags,
          series,
        });
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async detail(slug: string) {
    return this.db.transaction(
      async (tx) => {
        const row = (
          await records(
            tx,
            sql`SELECT jsonb_build_object('id',c.id,'data',r.data,'updatedAt',r.created_at) AS record FROM author_cms.slug_aliases a JOIN author_cms.contents c ON c.id=a.content_id JOIN author_cms.content_revisions r ON r.id=c.published_revision_id WHERE a.slug=${slug} AND c.archived=false AND c.kind IN ('article','tutorial')`,
            publishedRowSchema,
          )
        )[0];
        if (!row) return null;
        return {
          generation: await generation(tx),
          canonicalSlug: row.data.slug,
          post: projectPost(
            row.id,
            row.data,
            row.updatedAt,
            await taxonomies(tx),
          ),
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async generation() {
    return generation(this.db);
  }
  async exportContent() {
    return this.db.transaction(
      async (tx) => {
        const tables = [
          "contents",
          "content_revisions",
          "taxonomies",
          "site_profile",
          "slug_aliases",
          "media",
          "published_media_refs",
          "public_state",
          "migration_mappings",
        ] as const;
        const data: Record<string, unknown[]> = {};
        for (const table of tables)
          data[table] = (
            await tx.execute(
              sql`SELECT * FROM ${sql.identifier("author_cms")}.${sql.identifier(table)}`,
            )
          ).rows;
        return {
          format: "blog-author-cms",
          version: 1,
          exportedAt: new Date().toISOString(),
          data,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
let store: ContentStore | undefined;
export function getStore() {
  return (store ??= new ContentStore(getPool()));
}
