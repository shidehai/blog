import { randomUUID } from "node:crypto";
import { readFile, mkdir, lstat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import {
  draftSchema,
  emptyDraft,
  siteProfileSchema,
  DEFAULT_PROFILE,
  type ContentDraft,
} from "@blog/content-contracts";
import { collectMediaIds } from "@blog/markdown";
import {
  mapMarkdownImages,
  withMarkdownImageSource,
  findUnsupportedMarkdownImageSources,
} from "../../frontend-v2/lib/markdown-images";
import { checksum, restoreData, type Bundle } from "./transfer";
import { persistImage, persistMediaBytes } from "./media-files";
import type { Pool } from "pg";
// Fixed folder identity in the archived source format, independent of retired
// bootstrap, permissions or service code. All other folders remain private.
const sourcePublishableFolderId = "11111111-1111-4111-8111-111111111111";
export const sourceTables = [
  "posts",
  "topics",
  "categories",
  "tags",
  "series",
  "posts_tags",
  "posts_topics",
  "site_settings",
  "social_links",
  "directus_files",
  "directus_versions",
  "directus_revisions",
  "directus_activity",
] as const;
const raw = z.record(z.string(), z.unknown());
export const sourceSchema = z.object({
  format: z.literal("directus-content-source"),
  version: z.literal(1),
  exportedAt: z.string(),
  tables: z.object(
    Object.fromEntries(
      sourceTables.map((table) => [table, z.array(raw)]),
    ) as Record<(typeof sourceTables)[number], z.ZodArray<typeof raw>>,
  ),
});
export type Source = z.infer<typeof sourceSchema>;
type HistoryRecord = {
  source: "versions" | "revisions" | "activities";
  id: string;
  collection: string;
  item: string | null;
  activityId: string | null;
  action: string | null;
  timestamp: string | null;
  disposition:
    "converted" | "recovered-archived" | "archive-only" | "event-only";
  targetId?: string;
  targetRevisionId?: string;
  code?: string;
  reason?: string;
  missingFields?: string[];
};
class HistoryGap extends Error {
  constructor(
    readonly code: string,
    reason: string,
    readonly missingFields: string[] = [],
  ) {
    super(reason);
  }
}
const text = (value: unknown) => (typeof value === "string" ? value : "");
const uuid = (value: unknown) => z.uuid().parse(value);
const optionalId = (value: unknown) =>
  value === null || value === undefined
    ? null
    : uuid(typeof value === "object" && "id" in value ? value.id : value);
function date(value: unknown, fallback: string) {
  return value
    ? new Date(z.union([z.string(), z.date()]).parse(value)).toISOString()
    : fallback;
}
export async function exportSource(pool: Pool): Promise<Source> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const tables: Record<string, unknown[]> = {};
    for (const table of sourceTables) {
      let query = `SELECT * FROM public.${table}`;
      if (table === "directus_files")
        query =
          "SELECT id,storage,filename_disk,filename_download,folder,type,filesize,width,height,description,created_on,modified_on FROM public.directus_files";
      if (table === "directus_versions" || table === "directus_revisions")
        query += ` WHERE collection IN ('posts','topics','categories','tags','series','posts_tags','posts_topics','site_settings','social_links')`;
      if (table === "directus_activity")
        query =
          "SELECT id,action,collection,item,timestamp FROM public.directus_activity WHERE collection IN ('posts','topics','categories','tags','series','posts_tags','posts_topics','site_settings','social_links')";
      tables[table] = (await client.query(query)).rows;
    }
    await client.query("COMMIT");
    return sourceSchema.parse(
      JSON.parse(
        JSON.stringify({
          format: "directus-content-source",
          version: 1,
          exportedAt: new Date().toISOString(),
          tables,
        }),
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function importSource(
  pool: Pool,
  mediaRoot: string,
  sourceInput: unknown,
  uploads: string,
  sourceOrigin: string,
) {
  const source = sourceSchema.parse(sourceInput),
    batch = checksum(JSON.stringify(source)),
    s = source.tables;
  const replay = (
    await pool.query<{ data: unknown }>(
      "SELECT data FROM author_cms.source_archives WHERE batch_id=$1",
      [batch],
    )
  ).rows[0];
  if (replay)
    return z.object({ report: z.unknown() }).parse(replay.data).report;
  const existing = (
    await pool.query("SELECT count(*)::int AS count FROM author_cms.contents")
  ).rows[0]?.count;
  if (existing !== 0)
    throw new Error("源数据导入只允许空目标；已有作者写入时不能覆盖。");
  const data: Bundle["data"] = {
    contents: [],
    content_revisions: [],
    taxonomies: [],
    site_profile: [],
    slug_aliases: [],
    media: [],
    published_media_refs: [],
    public_state: [{ id: 1, generation: 1 }],
    migration_mappings: [],
    source_archives: [],
  };
  const limitations: HistoryRecord[] = [],
    history: HistoryRecord[] = [],
    contentMap = new Map<string, string>(),
    mediaIds = new Set<string>();
  const activities = new Map(
    s.directus_activity.map((row) => [String(row.id), row]),
  );
  const historyRecord = (
    kind: HistoryRecord["source"],
    row: Record<string, unknown>,
  ): HistoryRecord => {
    const activity =
      kind === "activities" ? row : activities.get(String(row.activity));
    return {
      source: kind,
      id: String(row.id),
      collection: text(row.collection),
      item:
        row.item === null || row.item === undefined ? null : String(row.item),
      activityId: activity ? String(activity.id) : null,
      action: activity ? text(activity.action) || null : null,
      timestamp:
        kind === "versions" && (row.date_updated || row.date_created)
          ? date(row.date_updated ?? row.date_created, source.exportedAt)
          : activity?.timestamp
            ? date(activity.timestamp, source.exportedAt)
            : null,
      disposition: "archive-only",
    };
  };
  const recordGap = (entry: HistoryRecord, error: unknown) => {
    const gap =
      error instanceof HistoryGap
        ? error
        : new HistoryGap(
            "invalid-history-snapshot",
            "该历史记录不能完整转换为草稿，原始数据保存在源档案中",
          );
    const record: HistoryRecord = {
      ...entry,
      disposition: "archive-only",
      code: gap.code,
      reason: gap.message,
      missingFields: gap.missingFields,
    };
    limitations.push(record);
    history.push(record);
  };
  const mappings = (
    kind: string,
    id: unknown,
    target: string,
    value: unknown,
  ) =>
    data.migration_mappings.push({
      source: kind,
      source_id: String(id),
      target_id: target,
      checksum: checksum(JSON.stringify(value)),
    });
  for (const kind of ["categories", "tags", "series"] as const)
    for (const row of s[kind]) {
      const id = uuid(row.id);
      data.taxonomies.push({
        id,
        kind:
          kind === "categories"
            ? "category"
            : kind === "tags"
              ? "tag"
              : "series",
        name: z.string().min(1).parse(row.name),
        slug: z.string().min(1).parse(row.slug),
        description: text(row.description),
      });
      mappings(kind, row.id, id, row);
    }
  await mkdir(mediaRoot, { recursive: true, mode: 0o700 });
  for (const row of s.directus_files) {
    const id = uuid(row.id),
      key = z
        .string()
        .regex(/^[a-z\d_.-]+$/i)
        .parse(row.filename_disk);
    if (key.startsWith(".")) throw new Error("源文件标识无效");
    const filename = path.join(uploads, key);
    if (!(await lstat(filename)).isFile())
      throw new Error("源媒体包含非普通文件");
    const original = await readFile(filename);
    let display: Buffer = original;
    let metadata: unknown = null;
    if (row.type === "image/svg+xml") {
      const svg = original.toString("utf8");
      if (/(?:href\s*=\s*["']\s*(?!#|data:)|<!ENTITY|<!DOCTYPE)/i.test(svg))
        throw new Error("SVG 含外部资源，需生成安全显示副本后重试");
      display = await sharp(original, { limitInputPixels: 40_000_000 })
        .png()
        .toBuffer();
      const originalKey = `originals/${id}.svg`;
      try {
        await persistMediaBytes(mediaRoot, originalKey, original);
      } catch (error) {
        if (!(
          error instanceof Error &&
          "code" in error &&
          error.code === "EEXIST"
        ))
          throw error;
        if (
          checksum(await readFile(path.join(mediaRoot, originalKey))) !==
          checksum(original)
        )
          throw new Error("原文件冲突");
      }
      metadata = {
        original: {
          key: originalKey,
          sha256: checksum(original),
          bytes: original.length,
        },
        directus: row,
      };
    } else metadata = { directus: row };
    const saved = await persistImage(
      mediaRoot,
      display,
      text(row.filename_download) || key,
      id,
      true,
    );
    data.media.push({
      id,
      storage_key: saved.storageKey,
      filename: saved.filename,
      mime: saved.mime,
      bytes: saved.bytes,
      width: saved.width,
      height: saved.height,
      sha256: saved.sha256,
      publishable: row.folder === sourcePublishableFolderId,
      source_metadata: metadata,
      created_at: date(row.created_on, source.exportedAt),
    });
    mediaIds.add(id);
    mappings("files", id, id, { ...row, sha256: checksum(original) });
  }
  const rewrite = (markdown: string) => {
    const origin = new URL(sourceOrigin).origin;
    const resolve = (url: string) => {
      const source = url.startsWith(origin + "/assets/")
        ? url.slice(origin.length)
        : url;
      const match = source.match(
        /^(?:directus:\/\/|\/assets\/)([a-f\d-]{36})$/i,
      );
      if (!match) return url;
      const id = match[1]!;
      if (!mediaIds.has(id)) throw new Error("正文引用未盘点的源媒体");
      return `/media/${id}`;
    };
    const result = mapMarkdownImages(markdown, (image) =>
      withMarkdownImageSource(image, resolve(image.source)),
    );
    if (
      findUnsupportedMarkdownImageSources(result).some(
        (url) => resolve(url) !== url,
      )
    )
      throw new Error(
        "源 HTML / 引用式图片需要迁移为标准图片语法；原始正文仍被保留。",
      );
    return result;
  };
  function relations(
    row: Record<string, unknown>,
    name: "tags" | "topics",
    itemId: string,
    history = false,
  ): string[] {
    const column = name === "tags" ? "tags_id" : "topics_id",
      junction = name === "tags" ? s.posts_tags : s.posts_topics;
    if (history) {
      if (!Array.isArray(row[name]))
        throw new HistoryGap(
          "incomplete-history-relations",
          "历史关系必须是独立完整的数组快照，不能借用当前关系或操作 delta",
          [name],
        );
      return [
        ...new Set(
          row[name].map((value) => {
            const entry = raw.safeParse(value);
            if (!entry.success || !entry.data[column])
              throw new HistoryGap(
                "incomplete-history-relations",
                "历史关系只有 junction ID，缺少目标稳定标识；不能借用当前关系",
                [`${name}.${column}`],
              );
            return optionalId(entry.data[column])!;
          }),
        ),
      ];
    }
    const base = junction.filter((entry) => entry.posts_id === itemId);
    if (row[name] === undefined) {
      return base.map((entry) => uuid(entry[column]));
    }
    const value = row[name];
    let entries = base;
    const operation = z
      .object({
        create: z.array(raw).optional(),
        update: z.array(raw).optional(),
        delete: z.array(z.union([z.string(), z.number()])).optional(),
      })
      .strict()
      .safeParse(value);
    if (operation.success) {
      entries = base.filter(
        (entry) =>
          !operation.data.delete?.includes(
            z.union([z.string(), z.number()]).parse(entry.id),
          ),
      );
      for (const update of operation.data.update ?? []) {
        const index = entries.findIndex((entry) => entry.id === update.id);
        if (index < 0) throw new Error("版本引用的关系记录已不存在");
        entries[index] = { ...entries[index], ...update };
      }
      entries = [...entries, ...(operation.data.create ?? [])];
    } else if (Array.isArray(value))
      entries = value.map((entry) =>
        typeof entry === "object" && entry !== null
          ? raw.parse(entry)
          : { id: entry },
      );
    else throw new Error("关系 delta 不能完整重建");
    return [
      ...new Set(
        entries.map(
          (entry) =>
            optionalId(
              entry[column] ??
                base.find((base) => base.id === entry.id)?.[column],
            ) ??
            (() => {
              throw new Error("版本关系缺少稳定标识");
            })(),
        ),
      ),
    ];
  }
  function convert(
    row: Record<string, unknown>,
    collection: string,
    sourceId: string,
    history = false,
  ): ContentDraft {
    const topic = collection === "topics";
    if (history) {
      const missing = (
        topic ? ["name", "slug"] : ["kind", "title", "slug", "body"]
      ).filter((key) => row[key] === undefined);
      if (missing.length)
        throw new HistoryGap(
          "partial-content-snapshot",
          "历史正文/专题字段不完整，不能用当前字段补齐",
          missing,
        );
      if (!topic) {
        const missingRelations = ["tags", "topics"].filter(
          (key) => !Array.isArray(row[key]),
        );
        if (missingRelations.length)
          throw new HistoryGap(
            "incomplete-history-relations",
            "历史快照缺少完整的标签/专题关系，不能用当前关系补齐",
            missingRelations,
          );
      }
    }
    const base = emptyDraft(
      topic
        ? "topic"
        : z.enum(["article", "tutorial", "note"]).parse(row.kind ?? "article"),
    );
    return draftSchema.parse({
      ...base,
      title: text(topic ? row.name : row.title),
      slug: text(row.slug),
      summary: text(topic ? row.description : row.summary),
      content: rewrite(text(row.body)),
      categoryId: optionalId(row.category),
      seriesId: optionalId(row.series),
      seriesOrder: row.series_order ?? null,
      tagIds: topic ? [] : relations(row, "tags", sourceId, history),
      topicIds: topic ? [] : relations(row, "topics", sourceId, history),
      coverId: optionalId(row.cover_image),
      featured: row.featured === true,
      publishedAt: row.published_at
        ? date(row.published_at, source.exportedAt)
        : null,
      extra: { legacy: row },
    });
  }
  const addRevision = (
    contentId: string,
    draft: ContentDraft,
    origin: string,
    at: string,
  ) => {
    const id = randomUUID();
    data.content_revisions.push({
      id,
      content_id: contentId,
      data: draft,
      source: origin,
      created_at: at,
    });
    return id;
  };
  for (const collection of ["posts", "topics"] as const)
    for (const row of s[collection]) {
      const id = uuid(row.id);
      contentMap.set(`${collection}:${id}`, id);
      const draft = convert(row, collection, id);
      const created = date(row.date_created, source.exportedAt),
        updated = date(row.date_updated, created);
      const revision = addRevision(id, draft, "directus-main", updated);
      const published =
        collection === "posts" &&
        row.status === "published" &&
        ["article", "tutorial"].includes(draft.kind);
      data.contents.push({
        id,
        kind: draft.kind,
        draft_slug: draft.slug || null,
        version: 1,
        draft_revision_id: revision,
        published_revision_id: published ? revision : null,
        archived: row.status === "archived",
        created_at: created,
        updated_at: updated,
      });
      if (published) {
        data.slug_aliases.push({ slug: draft.slug, content_id: id });
        for (const media of [
          ...collectMediaIds(draft.content),
          ...(draft.coverId ? [draft.coverId] : []),
        ]) {
          if (
            !data.media.some(
              (row) => row.id === media && row.publishable === true,
            )
          )
            throw new Error("公开内容引用了缺失或受保护的源文件");
          data.published_media_refs.push({ media_id: media, source_id: id });
        }
      }
      mappings(collection, id, id, row);
    }
  for (const version of s.directus_versions) {
    const record = historyRecord("versions", version);
    const collection = text(version.collection);
    if (!["posts", "topics"].includes(collection)) {
      recordGap(
        record,
        new HistoryGap(
          "non-content-version",
          "该集合的版本保存在源档案中，不作为正文草稿恢复",
        ),
      );
      continue;
    }
    const item = text(version.item),
      delta = raw.parse(version.delta ?? {}),
      base = s[collection === "posts" ? "posts" : "topics"].find(
        (row) => row.id === item,
      );
    const id = contentMap.get(`${collection}:${item}`) ?? randomUUID();
    try {
      const draft = convert({ ...base, ...delta }, collection, item);
      const revision = addRevision(
        id,
        draft,
        `directus-version:${text(version.name) || text(version.key)}`,
        date(version.date_updated ?? version.date_created, source.exportedAt),
      );
      if (!base) {
        data.contents.push({
          id,
          kind: draft.kind,
          draft_slug: null,
          version: 1,
          draft_revision_id: revision,
          published_revision_id: null,
          archived: false,
          created_at: date(version.date_created, source.exportedAt),
          updated_at: date(version.date_updated, source.exportedAt),
        });
        contentMap.set(`${collection}:version:${String(version.id)}`, id);
      } else if (version.key === "draft") {
        const content = data.contents.find((row) => row.id === id)!;
        content.draft_revision_id = revision;
        content.draft_slug = null;
      }
      mappings("versions", version.id, id, version);
      history.push({
        ...record,
        disposition: "converted",
        targetId: id,
        targetRevisionId: revision,
      });
    } catch (error) {
      recordGap(record, error);
    }
  }
  const recovered = new Set<string>();
  const orderedActivities = [...s.directus_activity].sort(
    (a, b) =>
      date(a.timestamp, source.exportedAt).localeCompare(
        date(b.timestamp, source.exportedAt),
      ) || String(a.id).localeCompare(String(b.id), "en", { numeric: true }),
  );
  const latestActions = new Map(
    orderedActivities.map((row) => [
      `${text(row.collection)}:${String(row.item)}`,
      row,
    ]),
  );
  const orderedRevisions = [...s.directus_revisions].sort((a, b) => {
    const at = (row: Record<string, unknown>) =>
      date(activities.get(String(row.activity))?.timestamp, source.exportedAt);
    return (
      at(a).localeCompare(at(b)) ||
      String(a.id).localeCompare(String(b.id), "en", { numeric: true })
    );
  });
  for (const revision of orderedRevisions) {
    const record = historyRecord("revisions", revision);
    const key = `${record.collection}:${record.item}`;
    let id = contentMap.get(key);
    if (!["posts", "topics"].includes(record.collection)) {
      const junction = ["posts_topics", "posts_tags"].includes(
        record.collection,
      );
      const snapshot = raw.safeParse(revision.data);
      const columns =
        record.collection === "posts_topics"
          ? ["posts_id", "topics_id"]
          : ["posts_id", "tags_id"];
      recordGap(
        record,
        new HistoryGap(
          junction ? "junction-history" : "non-content-history",
          junction
            ? "关联表历史不转换为正文修订；缺失端点不能从当前关系推断"
            : "站点/分类等非正文历史保存在源档案中，没有对应的正文恢复界面",
          junction
            ? columns.filter(
                (column) =>
                  !snapshot.success || snapshot.data[column] === undefined,
              )
            : [],
        ),
      );
      continue;
    }
    try {
      const snapshot = raw.parse(revision.data);
      if (revision.version)
        throw new HistoryGap(
          "version-delta",
          "该记录属于版本 delta，缺少独立历史基线，保存在源档案中",
        );
      if (snapshot.id !== record.item)
        throw new HistoryGap(
          "history-identity-mismatch",
          "历史快照缺少匹配的内容 ID",
          ["id"],
        );
      if (
        (!id || recovered.has(key)) &&
        (latestActions.get(key)?.action !== "delete" || !record.timestamp)
      )
        throw new HistoryGap(
          "unbound-content-history",
          "历史记录无当前内容，且缺少带时间的删除证明；不自动复活内容",
        );
      const draft = convert(snapshot, record.collection, record.item!, true);
      if (!id) {
        id = uuid(record.item);
        if (data.contents.some((row) => row.id === id))
          throw new HistoryGap(
            "history-identity-conflict",
            "历史内容 ID 与其他集合冲突，保存在源档案中",
          );
        recovered.add(key);
      }
      const revisionId = addRevision(
        id,
        draft,
        `directus-revision:${String(revision.id)}`,
        record.timestamp ?? source.exportedAt,
      );
      if (recovered.has(key)) {
        const content = data.contents.find((row) => row.id === id);
        if (content) {
          content.draft_revision_id = revisionId;
          content.updated_at = record.timestamp;
        } else
          data.contents.push({
            id,
            kind: draft.kind,
            draft_slug: null,
            version: 1,
            draft_revision_id: revisionId,
            published_revision_id: null,
            archived: true,
            created_at: record.timestamp,
            updated_at: record.timestamp,
          });
        contentMap.set(key, id);
      }
      mappings("revisions", revision.id, id, revision);
      history.push({
        ...record,
        disposition: recovered.has(key) ? "recovered-archived" : "converted",
        targetId: id,
        targetRevisionId: revisionId,
      });
    } catch (error) {
      recordGap(record, error);
    }
  }
  const revisionActivities = new Set(
    s.directus_revisions.map((row) => String(row.activity)),
  );
  for (const activity of orderedActivities) {
    if (revisionActivities.has(String(activity.id))) continue;
    const record = historyRecord("activities", activity);
    const current = sourceTables.some(
      (table) =>
        table === record.collection &&
        s[table].some((row) => String(row.id) === record.item),
    );
    const hasSnapshot = s.directus_revisions.some(
      (row) =>
        row.collection === record.collection &&
        String(row.item) === record.item &&
        raw.safeParse(row.data).success,
    );
    if (record.action === "delete" && (current || hasSnapshot)) {
      history.push({
        ...record,
        disposition: "event-only",
        code: "delete-event",
        reason: "删除操作仅保留活动元数据，历史快照另行对账",
      });
    } else
      recordGap(
        record,
        new HistoryGap(
          record.action === "delete"
            ? "deleted-item-without-snapshot"
            : "activity-without-revision",
          record.action === "delete"
            ? "只有删除活动，没有该内容的原始快照，无法重建被删除字段"
            : "该写入活动没有对应修订，保存在源档案中",
          ["data"],
        ),
      );
  }
  const settings = s.site_settings[0];
  if (settings) {
    const social = (icon: string) =>
      text(s.social_links.find((link) => link.icon === icon)?.url);
    const avatar = optionalId(settings.avatar);
    const profile = siteProfileSchema.parse({
      ...DEFAULT_PROFILE,
      name: text(settings.author_name) || DEFAULT_PROFILE.name,
      title: text(settings.tagline),
      bio: text(settings.biography) || text(settings.homepage_intro),
      avatar: avatar ? `/media/${avatar}` : "",
      socials: {
        github: social("github"),
        email: social("email"),
        about: "/about",
      },
    });
    data.site_profile.push({ id: 1, data: profile, version: 1 });
    if (avatar) {
      if (
        !data.media.some((row) => row.id === avatar && row.publishable === true)
      )
        throw new Error("头像引用受保护或缺失的源媒体");
      data.published_media_refs.push({
        media_id: avatar,
        source_id: "profile",
      });
    }
  }
  // Deduplicate references used both in the body and cover.
  data.published_media_refs = data.published_media_refs.filter(
    (row, index, all) =>
      all.findIndex(
        (other) =>
          other.media_id === row.media_id && other.source_id === row.source_id,
      ) === index,
  );
  const report = {
    batchId: batch,
    sourceCounts: Object.fromEntries(
      sourceTables.map((table) => [table, s[table].length]),
    ),
    targetCounts: {
      ...Object.fromEntries(
        Object.entries(data).map(([table, rows]) => [table, rows.length]),
      ),
      source_archives: 1,
    },
    addresses: data.slug_aliases,
    mediaChecksums: data.media.map((row) => ({
      id: row.id,
      sha256: row.sha256,
    })),
    historyReconciliation: {
      version: 1,
      counts: {
        versions: s.directus_versions.length,
        revisions: s.directus_revisions.length,
        activitiesWithoutRevision: history.filter(
          (row) => row.source === "activities",
        ).length,
        converted: history.filter((row) => row.disposition === "converted")
          .length,
        recoveredArchivedRevisions: history.filter(
          (row) => row.disposition === "recovered-archived",
        ).length,
        recoveredArchivedContents: recovered.size,
        archiveOnly: limitations.length,
        eventOnly: history.filter((row) => row.disposition === "event-only")
          .length,
      },
      records: history,
      policy:
        "只恢复独立完整快照；历史关系不借用当前值。已删除内容仅归档恢复，不自动发布或占用地址。原档案保留不等于可编辑历史已重建。",
    },
    limitations,
    readyForCutover: limitations.length === 0,
    rawSourcePreserved: true,
  };
  data.source_archives.push({
    batch_id: batch,
    data: { source, report },
    created_at: source.exportedAt,
  });
  await restoreData(pool, data);
  return report;
}
