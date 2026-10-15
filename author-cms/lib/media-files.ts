import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, link, unlink, readFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import { z } from "zod";
import { CmsError } from "./errors";
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const formats: Record<string, { mime: string; extension: string }> = {
  jpeg: { mime: "image/jpeg", extension: "jpg" },
  png: { mime: "image/png", extension: "png" },
  webp: { mime: "image/webp", extension: "webp" },
  gif: { mime: "image/gif", extension: "gif" },
  avif: { mime: "image/avif", extension: "avif" },
  heif: { mime: "image/avif", extension: "avif" },
};
async function syncDirectory(root: string) {
  const directory = await open(root, "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}
export async function persistMediaBytes(
  root: string,
  storageKey: string,
  bytes: Buffer,
) {
  if (
    !/^(?:originals\/)?[a-f\d-]{36}\.(jpg|png|webp|gif|avif|svg)$/i.test(
      storageKey,
    )
  )
    throw new Error("图片存储标识无效");
  await mkdir(root, { recursive: true, mode: 0o700 });
  if (!(await lstat(root)).isDirectory())
    throw new Error("CMS 媒体目录必须是普通目录");
  const folder = path.dirname(path.join(root, storageKey));
  await mkdir(folder, { recursive: true, mode: 0o700 });
  if (!(await lstat(folder)).isDirectory())
    throw new Error("CMS 媒体目录必须是普通目录");
  const temporary = path.join(folder, `.${randomUUID()}.tmp`);
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } catch (error) {
    await unlink(temporary);
    throw error;
  } finally {
    await handle.close();
  }
  try {
    await link(temporary, path.join(root, storageKey));
  } finally {
    await unlink(temporary);
  }
  await syncDirectory(folder);
  if (folder !== root) await syncDirectory(root);
}
export async function persistImage(
  root: string,
  bytes: Buffer,
  filename: string,
  id: string = randomUUID(),
  reuseExisting = false,
) {
  z.uuid().parse(id);
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES)
    throw new CmsError(413, "图片大小需在 20 MB 以内。");
  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, {
      limitInputPixels: 40_000_000,
      animated: false,
    }).metadata();
  } catch {
    throw new CmsError(
      422,
      "无法读取图片，请选择 PNG、JPEG、WebP、GIF 或 AVIF 文件。",
    );
  }
  const format = metadata.format ? formats[metadata.format] : undefined;
  if (
    !format ||
    !metadata.width ||
    !metadata.height ||
    (metadata.format === "heif" && metadata.compression !== "av1")
  )
    throw new CmsError(422, "支持 PNG、JPEG、WebP、GIF 和 AVIF 图片。");
  const storageKey = `${id}.${format.extension}`;
  const saved = {
    id,
    storageKey,
    filename:
      filename.replace(/[\u0000-\u001f/\\]/g, "_").slice(0, 255) ||
      `image.${format.extension}`,
    mime: format.mime,
    bytes: bytes.length,
    width: metadata.width,
    height: metadata.height,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    publishable: true,
  };
  try {
    await persistMediaBytes(root, storageKey, bytes);
  } catch (error) {
    if (!(
      reuseExisting &&
      error instanceof Error &&
      "code" in error &&
      error.code === "EEXIST"
    ))
      throw error;
    await readVerifiedMedia(root, {
      storage_key: storageKey,
      bytes: saved.bytes,
      sha256: saved.sha256,
    });
  }
  return saved;
}
export async function readVerifiedMedia(
  root: string,
  file: { storage_key: string; bytes: number; sha256: string },
) {
  if (!/^[\da-f-]{36}\.(jpg|png|webp|gif|avif)$/i.test(file.storage_key))
    throw new CmsError(422, "图片存储标识无效");
  const filename = path.join(root, file.storage_key);
  const info = await lstat(filename).catch(() => null);
  if (
    !info?.isFile() ||
    info.size !== file.bytes ||
    info.size > MAX_IMAGE_BYTES
  )
    throw new CmsError(422, "图片原文件缺失或损坏，请恢复原文件后重试。");
  const bytes = await readFile(filename);
  if (createHash("sha256").update(bytes).digest("hex") !== file.sha256)
    throw new CmsError(422, "图片校验失败，请恢复原文件后重试。");
  return bytes;
}
