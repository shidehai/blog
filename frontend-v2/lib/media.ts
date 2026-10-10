import { createHash } from "node:crypto";
import { z } from "zod";
import { IDS } from "../../directus/constants.mjs";
import { normalizeDirectusUrl, type DirectusCredentials } from "./env";
import {
  findUnsupportedMarkdownImageSources,
  mapMarkdownImages,
  withMarkdownImageSource,
} from "./markdown-images";
import { publishMedia, type MediaPaths } from "./media-files";

export const MEDIA_FILE_LIMIT = 20 * 1024 * 1024;
export const MEDIA_TOTAL_LIMIT = 100 * 1024 * 1024;
export const MEDIA_REQUEST_TIMEOUT = 15_000;
const METADATA_LIMIT = 64 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
} as const;
const mimeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);
const metadataSchema = z.object({
  id: z.string().regex(UUID),
  folder: z.literal(IDS.folders.publishable),
  type: mimeSchema,
  filesize: z
    .union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
    .refine(
      (size) =>
        Number.isSafeInteger(size) && size > 0 && size <= MEDIA_FILE_LIMIT,
    ),
});
type Metadata = z.infer<typeof metadataSchema>;

export interface PublicMediaContent {
  posts: ReadonlyArray<{ body: string; cover_image: string | null }>;
  avatar: string | null;
}
export interface PublicMediaMap {
  resolve(source: string): string;
  rewriteBody(markdown: string): string;
}
export interface MediaOptions {
  paths?: MediaPaths;
  /** Tests may shorten deadlines, never raise production bounds. */
  timeoutMs?: number;
}

function refuse(operation: string): never {
  throw new Error(`[media] ${operation}`);
}

/** Classify references without ever fetching an author's source URL. */
function referencedId(source: string, base: string): string | undefined {
  if (UUID.test(source)) return source.toLowerCase();
  if (/^directus:/i.test(source)) {
    const id = source.match(/^directus:\/\/([^/?#]+)$/i)?.[1];
    return id && UUID.test(id)
      ? id.toLowerCase()
      : refuse("Invalid CMS image reference");
  }
  if (source.startsWith("//") || source.startsWith("/_cms/")) {
    return refuse("Invalid CMS image reference");
  }

  const configured = new URL(base);
  const assetsPath = `${configured.pathname.replace(/\/$/, "")}/assets/`;
  let path: string;
  if (source === "/assets" || source.startsWith("/assets/")) {
    path = source;
  } else {
    let candidate: URL;
    try {
      candidate = new URL(source);
    } catch {
      // Ordinary relative authored images remain site-local.
      return undefined;
    }
    if (candidate.origin !== configured.origin) return undefined;
    const rawPath = source.match(/^[a-z]+:\/\/[^/]+(\/[^?#]*)/i)?.[1] ?? "/";
    if (
      (rawPath.startsWith(assetsPath) ||
        candidate.pathname.startsWith(assetsPath)) &&
      (source.includes("%") || /\/\.\.?(?:\/|$)/.test(rawPath))
    ) {
      return refuse("Invalid CMS image reference");
    }
    if (!candidate.pathname.startsWith(assetsPath)) return undefined;
    if (
      candidate.username ||
      candidate.password ||
      candidate.search ||
      candidate.hash
    ) {
      return refuse(
        "CMS image queries, fragments and credentials are unsupported",
      );
    }
    // Check the original path too: URL normalization must not hide traversal.
    if (source.includes("%") || /\/\.\.?\//.test(source)) {
      return refuse("Invalid CMS image reference");
    }
    path = `/assets/${candidate.pathname.slice(assetsPath.length)}`;
  }
  const match = path.match(
    /^\/assets\/([^/?#]+)(?:\/([A-Za-z0-9][A-Za-z0-9._-]*))?$/,
  );
  const id = match?.[1];
  return id && UUID.test(id)
    ? id.toLowerCase()
    : refuse("Invalid CMS image reference");
}

async function readBounded(
  response: Response,
  limit: number,
  deadline: Promise<never>,
) {
  const reader = response.body?.getReader();
  if (!reader) return refuse("Missing media response body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      length += value.byteLength;
      if (length > limit)
        return refuse("Media response exceeds its byte limit");
      chunks.push(value);
    }
    return Buffer.concat(chunks, length);
  } catch {
    void reader.cancel().catch(() => {});
    return refuse("Failed bounded media response read");
  } finally {
    reader.releaseLock();
  }
}

async function mediaRequest<T>(
  credentials: DirectusCredentials,
  path: string,
  timeout: number,
  consume: (response: Response, deadline: Promise<never>) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("[media] Request deadline exceeded"));
    }, timeout);
  });
  try {
    const response = await Promise.race([
      fetch(`${credentials.url}${path}`, {
        headers: { Authorization: `Bearer ${credentials.token}` },
        redirect: "error",
        signal: controller.signal,
      }),
      deadline,
    ]);
    if (!response.ok || response.redirected)
      return refuse("Media request refused");
    return await consume(response, deadline);
  } catch {
    return refuse("Failed authenticated public media request");
  } finally {
    clearTimeout(timer!);
    controller.abort();
  }
}

function metadataFor(
  credentials: DirectusCredentials,
  id: string,
  timeout: number,
) {
  return mediaRequest(
    credentials,
    `/files/${id}?fields=id,folder,type,filesize`,
    timeout,
    async (response, deadline) => {
      const bytes = await readBounded(response, METADATA_LIMIT, deadline);
      const parsed = z
        .object({ data: metadataSchema })
        .parse(JSON.parse(bytes.toString("utf8"))).data;
      if (parsed.id.toLowerCase() !== id)
        return refuse("File metadata identity mismatch");
      return { ...parsed, id };
    },
  );
}

function validSignature(bytes: Uint8Array, type: Metadata["type"]): boolean {
  const starts = (signature: number[]) =>
    signature.every((value, index) => bytes[index] === value);
  if (type === "image/jpeg") return starts([0xff, 0xd8, 0xff]);
  if (type === "image/png")
    return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const header = Buffer.from(bytes.subarray(0, 12)).toString("latin1");
  if (type === "image/webp")
    return header.startsWith("RIFF") && header.slice(8) === "WEBP";
  if (type === "image/avif") {
    const buffer = Buffer.from(bytes);
    if (buffer.length < 16 || buffer.toString("latin1", 4, 8) !== "ftyp")
      return false;
    const shortSize = buffer.readUInt32BE(0);
    const extended = shortSize === 1;
    if (extended && buffer.length < 24) return false;
    const size = extended ? Number(buffer.readBigUInt64BE(8)) : shortSize;
    const brandsStart = extended ? 16 : 8;
    if (
      !Number.isSafeInteger(size) ||
      size < brandsStart + 8 ||
      size > Math.min(buffer.length, 64 * 1024) ||
      (size - brandsStart) % 4 !== 0
    )
      return false;
    const isAvif = (offset: number) =>
      /^(?:avif|avis)$/.test(buffer.toString("latin1", offset, offset + 4));
    if (isAvif(brandsStart)) return true;
    for (let offset = brandsStart + 8; offset < size; offset += 4)
      if (isAvif(offset)) return true;
    return false;
  }
  return header.startsWith("GIF87a") || header.startsWith("GIF89a");
}

function originalFor(
  credentials: DirectusCredentials,
  metadata: Metadata,
  timeout: number,
) {
  return mediaRequest(
    credentials,
    `/assets/${metadata.id}`,
    timeout,
    async (response, deadline) => {
      const mime = response.headers
        .get("content-type")
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase();
      if (mime !== metadata.type)
        return refuse("Original MIME does not match metadata");
      const declared = response.headers.get("content-length");
      if (
        declared !== null &&
        (!/^\d+$/.test(declared) || Number(declared) !== metadata.filesize)
      ) {
        return refuse("Original Content-Length does not match metadata");
      }
      const bytes = await readBounded(
        response,
        Math.min(MEDIA_FILE_LIMIT, metadata.filesize),
        deadline,
      );
      if (
        bytes.byteLength !== metadata.filesize ||
        !validSignature(bytes, metadata.type)
      ) {
        return refuse(
          "Original size or raster signature does not match metadata",
        );
      }
      return bytes;
    },
  );
}

export async function materializePublicMedia(
  content: PublicMediaContent,
  credentials: DirectusCredentials,
  options: MediaOptions = {},
): Promise<PublicMediaMap> {
  const base = normalizeDirectusUrl(credentials.url);
  const approvedCredentials = { ...credentials, url: base };
  const timeout = Math.min(
    MEDIA_REQUEST_TIMEOUT,
    Math.max(1, options.timeoutMs ?? MEDIA_REQUEST_TIMEOUT),
  );
  const ids = new Set<string>();
  const collect = (source: string) => {
    const id = referencedId(source, base);
    if (id) ids.add(id);
  };
  const collectRelation = (source: string) => {
    const id = referencedId(source, base);
    if (id) {
      ids.add(id);
      return;
    }
    if (source.startsWith("/")) return;
    try {
      const url = new URL(source);
      if (url.protocol === "http:" || url.protocol === "https:") return;
    } catch {
      // A nonempty CMS relation must be a UUID or an explicit local/external URL.
    }
    return refuse("Invalid CMS image relation");
  };
  if (content.avatar) collectRelation(content.avatar);
  for (const post of content.posts) {
    if (post.cover_image) collectRelation(post.cover_image);
    mapMarkdownImages(post.body, (image) => {
      collect(image.source);
      return image.raw;
    });
    for (const source of findUnsupportedMarkdownImageSources(post.body)) {
      if (referencedId(source, base))
        return refuse("Unsupported CMS body image syntax");
    }
  }

  // Whole-batch preflight: no original bytes before every reference is public.
  const metadata: Metadata[] = [];
  let total = 0;
  for (const id of ids) {
    const file = await metadataFor(approvedCredentials, id, timeout);
    total += file.filesize;
    if (total > MEDIA_TOTAL_LIMIT)
      return refuse("Public media exceeds the total byte limit");
    metadata.push(file);
  }
  const originals: Array<{ metadata: Metadata; bytes: Buffer }> = [];
  for (const file of metadata) {
    originals.push({
      metadata: file,
      bytes: await originalFor(approvedCredentials, file, timeout),
    });
  }
  // Detect folder revocation/metadata changes before any file becomes public.
  for (const file of metadata) {
    const current = await metadataFor(approvedCredentials, file.id, timeout);
    if (current.type !== file.type || current.filesize !== file.filesize) {
      return refuse("File metadata changed while building public media");
    }
  }
  const resolved = new Map<string, string>();
  for (const { metadata: file, bytes } of originals) {
    const digest = createHash("sha256").update(bytes).digest("hex");
    const filename = `${digest}.${MIME_EXTENSIONS[file.type]}`;
    await publishMedia(filename, bytes, options.paths);
    resolved.set(file.id, `/_cms/${filename}`);
  }
  const resolve = (source: string) => {
    const id = referencedId(source, base);
    if (!id) return source;
    return resolved.get(id) ?? refuse("Unresolved public media reference");
  };
  return {
    resolve,
    rewriteBody: (markdown) =>
      mapMarkdownImages(markdown, (image) =>
        withMarkdownImageSource(image, resolve(image.source)),
      ),
  };
}
