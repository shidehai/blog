import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, lstat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Pool } from "pg";
import { ContentStore } from "./store";
import { readVerifiedMedia, persistMediaBytes } from "./media-files";
export const contentTables = [
  "contents",
  "content_revisions",
  "taxonomies",
  "site_profile",
  "slug_aliases",
  "media",
  "published_media_refs",
  "public_state",
  "migration_mappings",
  "source_archives",
] as const;
const rowSchema = z.record(z.string(), z.unknown());
const tableDataSchema = z.object(
  Object.fromEntries(
    contentTables.map((table) => [table, z.array(rowSchema)]),
  ) as Record<(typeof contentTables)[number], z.ZodArray<typeof rowSchema>>,
);
const fileSchema = z.object({
  key: z.string().regex(/^(?:originals\/)?[a-f\d-]{36}\.[a-z0-9]{1,8}$/i),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f\d]{64}$/),
});
export const bundleSchema = z.object({
  format: z.literal("blog-author-cms-bundle"),
  version: z.literal(1),
  exportedAt: z.string(),
  data: tableDataSchema,
  files: z.array(fileSchema),
});
export type Bundle = z.infer<typeof bundleSchema>;
export function checksum(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
export async function databaseData(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const data: Record<string, unknown[]> = {};
    for (const table of contentTables)
      data[table] = (
        await client.query(`SELECT * FROM author_cms.${table} ORDER BY 1`)
      ).rows;
    await client.query("COMMIT");
    return tableDataSchema.parse(JSON.parse(JSON.stringify(data)));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function exportBundle(
  pool: Pool,
  mediaRoot: string,
  destination: string,
) {
  await mkdir(destination, { mode: 0o700 });
  await mkdir(path.join(destination, "media"), { mode: 0o700 });
  await mkdir(path.join(destination, "markdown"), { mode: 0o700 });
  const data = await databaseData(pool),
    files: Bundle["files"] = [];
  for (const raw of data.media) {
    const file = z
      .object({
        storage_key: z.string(),
        bytes: z.number(),
        sha256: z.string(),
        source_metadata: z.unknown().nullable(),
      })
      .parse(raw);
    const bytes = await readVerifiedMedia(mediaRoot, file);
    await writeFile(path.join(destination, "media", file.storage_key), bytes, {
      flag: "wx",
      mode: 0o600,
    });
    files.push({
      key: file.storage_key,
      bytes: bytes.length,
      sha256: checksum(bytes),
    });
    const original = z
      .object({
        original: z.object({
          key: z.string(),
          sha256: z.string(),
          bytes: z.number(),
        }),
      })
      .safeParse(file.source_metadata);
    if (original.success) {
      const entry = fileSchema.parse(original.data.original);
      const source = await readBundleFile(mediaRoot, entry);
      await mkdir(path.join(destination, "media", "originals"), {
        recursive: true,
        mode: 0o700,
      });
      await writeFile(path.join(destination, "media", entry.key), source, {
        flag: "wx",
        mode: 0o600,
      });
      files.push(entry);
    }
  }
  for (const item of await new ContentStore(pool).list())
    await writeFile(
      path.join(destination, "markdown", `${item.id}.md`),
      item.draft.content,
      { flag: "wx", mode: 0o600 },
    );
  const bundle = bundleSchema.parse({
    format: "blog-author-cms-bundle",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
    files,
  });
  const text = JSON.stringify(bundle, null, 2) + "\n";
  await writeFile(path.join(destination, "bundle.json"), text, {
    flag: "wx",
    mode: 0o600,
  });
  await writeFile(
    path.join(destination, "bundle.sha256"),
    `${checksum(text)}\n`,
    { flag: "wx", mode: 0o600 },
  );
  return bundle;
}
async function readBundleFile(root: string, input: z.infer<typeof fileSchema>) {
  const file = fileSchema.parse(input);
  const source = path.join(root, file.key);
  if (!(await lstat(source)).isFile()) throw new Error("导出包包含非普通文件");
  const bytes = await readFile(source);
  if (bytes.length !== file.bytes || checksum(bytes) !== file.sha256)
    throw new Error("导出包图片校验失败");
  return bytes;
}
export async function readBundle(folder: string) {
  const text = await readFile(path.join(folder, "bundle.json"), "utf8");
  if (
    checksum(text) !==
    (await readFile(path.join(folder, "bundle.sha256"), "utf8")).trim()
  )
    throw new Error("导出包清单校验失败");
  const bundle = bundleSchema.parse(JSON.parse(text));
  for (const file of bundle.files)
    await readBundleFile(path.join(folder, "media"), file);
  return bundle;
}
export async function restoreData(pool: Pool, data: Bundle["data"]) {
  const parsed = tableDataSchema.parse(data);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(795233)");
    for (const table of contentTables) {
      if (table === "public_state") continue;
      const count = (
        await client.query(
          `SELECT count(*)::int AS count FROM author_cms.${table}`,
        )
      ).rows[0]?.count;
      if (count !== 0)
        throw new Error("目标 CMS 必须没有内容；恢复不会覆盖已有写作。");
    }
    await client.query("DELETE FROM author_cms.public_state");
    for (const table of contentTables) {
      const allowed = new Set(
        (
          await client.query<{ column_name: string }>(
            "SELECT column_name FROM information_schema.columns WHERE table_schema='author_cms' AND table_name=$1",
            [table],
          )
        ).rows.map((row) => row.column_name),
      );
      for (const row of parsed[table]) {
        const columns = Object.keys(row);
        if (!columns.length || columns.some((key) => !allowed.has(key)))
          throw new Error("导出包含未知字段，请先升级对应数据库迁移");
        const values = columns.map((key) => {
          const value = row[key];
          return typeof value === "object" && value !== null
            ? JSON.stringify(value)
            : value;
        });
        await client.query(
          `INSERT INTO author_cms.${table} (${columns.map((key) => `"${key}"`).join(",")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(",")})`,
          values,
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function restoreBundle(
  pool: Pool,
  mediaRoot: string,
  folder: string,
) {
  const bundle = await readBundle(folder);
  const mediaKeys = new Set(bundle.files.map((file) => file.key));
  for (const raw of bundle.data.media) {
    const file = z
      .object({
        storage_key: z.string(),
        bytes: z.number(),
        sha256: z.string(),
      })
      .parse(raw);
    if (!mediaKeys.has(file.storage_key))
      throw new Error("导出包缺少媒体原文件");
    const manifest = bundle.files.find(
      (entry) => entry.key === file.storage_key,
    )!;
    if (manifest.sha256 !== file.sha256 || manifest.bytes !== file.bytes)
      throw new Error("数据库与媒体清单不一致");
  }
  await mkdir(mediaRoot, { recursive: true, mode: 0o700 });
  for (const file of bundle.files) {
    const bytes = await readBundleFile(path.join(folder, "media"), file);
    try {
      await persistMediaBytes(mediaRoot, file.key, bytes);
    } catch (error) {
      if (!(
        error instanceof Error &&
        "code" in error &&
        error.code === "EEXIST"
      ))
        throw error;
      await readBundleFile(mediaRoot, file);
    }
  }
  await restoreData(pool, bundle.data);
  return bundle;
}
