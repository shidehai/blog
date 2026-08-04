import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import sanitizeHtml from "sanitize-html";
import sharp, { type Metadata, type OutputInfo } from "sharp";
import { z } from "zod";

import { IDS } from "../../directus/constants.mjs";

export const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
export const MAX_MEDIA_PIXELS = 100_000_000;
export const PUBLIC_MEDIA_PATH = "/_media";
export const RESPONSIVE_MEDIA_WIDTHS = [640, 960, 1440] as const;
export const SUPPORTED_MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/svg+xml",
] as const;

const PUBLISHABLE_FOLDER = {
  id: IDS.folders.publishable,
  name: "publishable-assets",
} as const;
const PRIVATE_FOLDER = {
  id: IDS.folders.private,
  name: "private-draft-assets",
} as const;
const FOLDER_NAMES = new Map([
  [PUBLISHABLE_FOLDER.id, PUBLISHABLE_FOLDER.name],
  [PRIVATE_FOLDER.id, PRIVATE_FOLDER.name],
]);

const SVG_TAGS = [
  "svg",
  "g",
  "defs",
  "title",
  "desc",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask",
] as const;
const SVG_ATTRIBUTES = [
  "id",
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "dx",
  "dy",
  "d",
  "points",
  "pathLength",
  "width",
  "height",
  "transform",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-opacity",
  "clip-path",
  "clip-rule",
  "mask",
  "opacity",
  "offset",
  "stop-color",
  "stop-opacity",
  "gradientUnits",
  "gradientTransform",
  "spreadMethod",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "vector-effect",
  "xml:space",
] as const;
const SVG_ROOT_ATTRIBUTES = [
  "xmlns",
  "viewBox",
  "width",
  "height",
  "preserveAspectRatio",
  "role",
  "aria-label",
  "aria-hidden",
  "focusable",
] as const;
const SVG_TAG_SET = new Set<string>(SVG_TAGS);
const SVG_ATTRIBUTE_SET = new Set<string>([
  ...SVG_ATTRIBUTES,
  ...SVG_ROOT_ATTRIBUTES,
]);
const SVG_ROOT_ONLY_ATTRIBUTE_SET = new Set([
  "xmlns",
  "viewBox",
  "preserveAspectRatio",
  "role",
  "aria-label",
  "aria-hidden",
  "focusable",
]);
const SVG_REFERENCE_ATTRIBUTES = new Set([
  "fill",
  "stroke",
  "clip-path",
  "mask",
]);
const SAFE_SVG_REFERENCE = /^url\(#[A-Za-z_][\w:.-]*\)$/;

type SupportedMediaMimeType = (typeof SUPPORTED_MEDIA_MIME_TYPES)[number];
export type MediaScope = "public" | "preview";

export interface DirectusMediaFile {
  filename: string;
  filesize: number;
  folder: { id: string; name: string };
  height: number | null;
  id: string;
  mimeType: SupportedMediaMimeType;
  width: number | null;
}

export interface PublicMediaVariant {
  height: number;
  mimeType: "image/webp" | "image/svg+xml";
  src: string;
  width: number;
}

export interface PublicMediaAsset {
  height: number;
  id: string;
  mimeType: PublicMediaVariant["mimeType"];
  src: string;
  srcset?: string;
  variants: readonly PublicMediaVariant[];
  width: number;
}

export interface PreviewMediaAsset {
  bytes: Buffer;
  height: number;
  id: string;
  mimeType: SupportedMediaMimeType;
  width: number;
}

export interface EmitPublicMediaOptions {
  outputDirectory: string;
}

export interface ResolvePublicMediaOptions extends EmitPublicMediaOptions {
  directusUrl: string;
  fetch?: typeof fetch;
  token: string;
}

const fileSizeSchema = z
  .union([z.number().int(), z.string().regex(/^\d+$/)])
  .transform(Number)
  .pipe(z.number().int().positive().max(MAX_MEDIA_BYTES));
const dimensionSchema = z.number().int().positive().nullable();
const folderSchema = z.union([
  z.uuid(),
  z.object({ id: z.uuid(), name: z.string().trim().min(1) }).strict(),
]);
const directusMediaFileSchema = z
  .object({
    filename_download: z.string().trim().min(1),
    filesize: fileSizeSchema,
    folder: folderSchema,
    height: dimensionSchema,
    id: z.uuid(),
    type: z.enum(SUPPORTED_MEDIA_MIME_TYPES),
    width: dimensionSchema,
  })
  .superRefine((file, context) => {
    const hasWidth = file.width !== null;
    const hasHeight = file.height !== null;
    if (hasWidth !== hasHeight) {
      context.addIssue({
        code: "custom",
        message: "must be present together with width",
        path: ["height"],
      });
    }
    if (file.type !== "image/svg+xml" && (!hasWidth || !hasHeight)) {
      context.addIssue({
        code: "custom",
        message: "is required for raster media",
        path: [!hasWidth ? "width" : "height"],
      });
    }
  });

function inputRecordId(input: unknown): string {
  if (
    typeof input === "object" &&
    input !== null &&
    "id" in input &&
    typeof input.id === "string"
  ) {
    return input.id;
  }
  return "unknown";
}

function fileError(fileId: string, field: string, message: string): Error {
  return new Error(`Invalid Directus file ${fileId}: ${field}: ${message}`);
}

export function parseDirectusMediaFile(
  input: unknown,
  scope: MediaScope = "public",
): DirectusMediaFile {
  const result = directusMediaFileSchema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "record"}: ${issue.message}`)
      .join("; ");
    throw new Error(
      `Invalid Directus file ${inputRecordId(input)}: ${details}`,
    );
  }

  const raw = result.data;
  const folderId = typeof raw.folder === "string" ? raw.folder : raw.folder.id;
  const folderName = FOLDER_NAMES.get(folderId);
  if (!folderName) {
    throw fileError(raw.id, "folder.id", "is not an approved media folder");
  }
  if (typeof raw.folder !== "string" && raw.folder.name !== folderName) {
    throw fileError(
      raw.id,
      "folder.name",
      `must be "${folderName}" for folder ${folderId}`,
    );
  }
  if (scope !== "preview" && folderId !== PUBLISHABLE_FOLDER.id) {
    throw fileError(
      raw.id,
      "folder",
      `must be ${PUBLISHABLE_FOLDER.name} (${PUBLISHABLE_FOLDER.id}) for a public build`,
    );
  }

  return {
    filename: raw.filename_download,
    filesize: raw.filesize,
    folder: { id: folderId, name: folderName },
    height: raw.height,
    id: raw.id,
    mimeType: raw.type,
    width: raw.width,
  };
}

async function readLimitedBody(
  response: Response,
  fileId: string,
): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      let part: ReadableStreamReadResult<Uint8Array>;
      try {
        part = await reader.read();
      } catch {
        throw fileError(fileId, "asset", "response body could not be read");
      }
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_MEDIA_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw fileError(
          fileId,
          "filesize",
          `download exceeds ${MAX_MEDIA_BYTES} bytes`,
        );
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    total,
  );
}

function directusAssetUrl(base: string, fileId: string): URL {
  let url: URL;
  try {
    url = new URL(base.endsWith("/") ? base : `${base}/`);
  } catch {
    throw fileError(fileId, "directusUrl", "must be an absolute URL");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw fileError(
      fileId,
      "directusUrl",
      "must use http or https without credentials, query, or fragment",
    );
  }
  return new URL(`assets/${fileId}`, url);
}

async function fetchDirectusMediaBytes(
  file: DirectusMediaFile,
  options: Pick<ResolvePublicMediaOptions, "directusUrl" | "fetch" | "token">,
): Promise<Buffer> {
  if (!options.token || options.token.trim() !== options.token) {
    throw fileError(
      file.id,
      "token",
      "is required and must not contain padding",
    );
  }
  const assetUrl = directusAssetUrl(options.directusUrl, file.id);
  let response: Response;
  try {
    response = await (options.fetch ?? globalThis.fetch)(assetUrl, {
      cache: "no-store",
      headers: {
        Accept: file.mimeType,
        Authorization: `Bearer ${options.token}`,
      },
      redirect: "error",
    });
  } catch {
    throw fileError(file.id, "asset", "fetch failed");
  }
  if (!response.ok) {
    throw fileError(file.id, "asset", `fetch returned HTTP ${response.status}`);
  }

  const responseType = response.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (responseType !== file.mimeType) {
    throw fileError(
      file.id,
      "type",
      `response MIME type must be ${file.mimeType}`,
    );
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      throw fileError(file.id, "filesize", "response length is invalid");
    }
    if (Number(contentLength) > MAX_MEDIA_BYTES) {
      throw fileError(
        file.id,
        "filesize",
        `response exceeds ${MAX_MEDIA_BYTES} bytes`,
      );
    }
  }

  const bytes = await readLimitedBody(response, file.id);
  if (bytes.byteLength !== file.filesize) {
    throw fileError(
      file.id,
      "filesize",
      `metadata declares ${file.filesize} bytes but the asset contains ${bytes.byteLength}`,
    );
  }
  return bytes;
}

function validateAssetBytes(
  file: DirectusMediaFile,
  input: Uint8Array,
): Buffer {
  const bytes = Buffer.from(input);
  if (bytes.byteLength > MAX_MEDIA_BYTES) {
    throw fileError(
      file.id,
      "filesize",
      `asset exceeds ${MAX_MEDIA_BYTES} bytes`,
    );
  }
  if (bytes.byteLength !== file.filesize) {
    throw fileError(
      file.id,
      "filesize",
      `metadata declares ${file.filesize} bytes but the asset contains ${bytes.byteLength}`,
    );
  }
  return bytes;
}

function validateSvgAttribute(
  fileId: string,
  name: string,
  value: string,
): void {
  if (
    [...value].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 || codePoint === 127;
    })
  ) {
    throw fileError(fileId, `svg.${name}`, "contains control characters");
  }
  if (name === "xmlns") {
    if (value !== "http://www.w3.org/2000/svg") {
      throw fileError(fileId, "svg.xmlns", "must use the SVG namespace");
    }
    return;
  }
  if (name === "id" && !/^[A-Za-z_][\w:.-]*$/.test(value)) {
    throw fileError(fileId, "svg.id", "is not a safe fragment identifier");
  }
  if (
    SVG_REFERENCE_ATTRIBUTES.has(name) &&
    /url\s*\(/i.test(value) &&
    !SAFE_SVG_REFERENCE.test(value)
  ) {
    throw fileError(
      fileId,
      `svg.${name}`,
      "may reference only a local SVG fragment",
    );
  }
}

export function sanitizeSvg(input: Uint8Array, fileId: string): Buffer {
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(input);
  } catch {
    throw fileError(fileId, "svg", "must be valid UTF-8");
  }
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(source)) {
    throw fileError(fileId, "svg", "document declarations are not allowed");
  }

  const stack: string[] = [];
  let rootSeen = false;
  const sanitized = sanitizeHtml(source, {
    allowedAttributes: {
      "*": [...SVG_ATTRIBUTES],
      svg: [...SVG_ROOT_ATTRIBUTES],
    },
    allowedSchemes: [],
    allowedTags: [...SVG_TAGS],
    allowProtocolRelative: false,
    disallowedTagsMode: "completelyDiscard",
    enforceHtmlBoundary: false,
    nestingLimit: 64,
    parseStyleAttributes: false,
    parser: {
      decodeEntities: true,
      lowerCaseAttributeNames: false,
      lowerCaseTags: false,
      xmlMode: true,
    },
    onOpenTag(name, attributes) {
      if (!SVG_TAG_SET.has(name)) {
        throw fileError(fileId, "svg", `element <${name}> is not allowed`);
      }
      if (stack.length === 0) {
        if (name !== "svg" || rootSeen) {
          throw fileError(fileId, "svg", "must contain exactly one root <svg>");
        }
        rootSeen = true;
        if (attributes.xmlns !== "http://www.w3.org/2000/svg") {
          throw fileError(fileId, "svg.xmlns", "must use the SVG namespace");
        }
      } else if (name === "svg") {
        throw fileError(fileId, "svg", "nested <svg> elements are not allowed");
      }
      if (stack.length >= 64) {
        throw fileError(fileId, "svg", "nesting exceeds 64 elements");
      }
      for (const [attribute, value] of Object.entries(attributes)) {
        if (!SVG_ATTRIBUTE_SET.has(attribute)) {
          throw fileError(
            fileId,
            `svg.${attribute}`,
            "attribute is not allowed",
          );
        }
        if (stack.length !== 0 && SVG_ROOT_ONLY_ATTRIBUTE_SET.has(attribute)) {
          throw fileError(
            fileId,
            `svg.${attribute}`,
            "root attribute is not allowed on child elements",
          );
        }
        validateSvgAttribute(fileId, attribute, value);
      }
      stack.push(name);
    },
    onCloseTag(name) {
      if (stack.pop() !== name) {
        throw fileError(fileId, "svg", "markup is not well formed");
      }
    },
  });

  if (
    !rootSeen ||
    stack.length !== 0 ||
    !/^<svg(?:\s[^>]*)?>[\s\S]*<\/svg>$/.test(sanitized)
  ) {
    throw fileError(fileId, "svg", "must contain exactly one root <svg>");
  }
  return Buffer.from(sanitized, "utf8");
}

async function imageMetadata(
  file: DirectusMediaFile,
  bytes: Buffer,
): Promise<Metadata> {
  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, {
      animated: true,
      failOn: "warning",
      limitInputPixels: MAX_MEDIA_PIXELS,
      sequentialRead: true,
    }).metadata();
  } catch {
    throw fileError(file.id, "asset", "cannot be decoded as a safe image");
  }
  if (metadata.mediaType !== file.mimeType) {
    throw fileError(
      file.id,
      "type",
      `metadata declares ${file.mimeType} but the asset is ${metadata.mediaType ?? "unknown"}`,
    );
  }
  return metadata;
}

function intrinsicDimensions(metadata: Metadata): {
  height: number;
  rawHeight: number;
  rawWidth: number;
  width: number;
} {
  return {
    height: metadata.pageHeight ?? metadata.autoOrient.height,
    rawHeight: metadata.pageHeight ?? metadata.height,
    rawWidth: metadata.width,
    width: metadata.autoOrient.width,
  };
}

function validateDeclaredDimensions(
  file: DirectusMediaFile,
  metadata: Metadata,
): void {
  if (file.width === null || file.height === null) return;
  const dimensions = intrinsicDimensions(metadata);
  const matchesRaw =
    file.width === dimensions.rawWidth && file.height === dimensions.rawHeight;
  const matchesOriented =
    file.width === dimensions.width && file.height === dimensions.height;
  if (!matchesRaw && !matchesOriented) {
    throw fileError(
      file.id,
      "width/height",
      `metadata declares ${file.width}x${file.height} but the asset is ${dimensions.width}x${dimensions.height}`,
    );
  }
}

function responsiveWidths(sourceWidth: number): number[] {
  const widths: number[] = RESPONSIVE_MEDIA_WIDTHS.filter(
    (width) => width <= sourceWidth,
  );
  widths.push(
    Math.min(sourceWidth, RESPONSIVE_MEDIA_WIDTHS.at(-1) ?? sourceWidth),
  );
  return [...new Set(widths)].sort((left, right) => left - right);
}

function hashedName(
  fileId: string,
  bytes: Buffer,
  label: string,
  extension: "svg" | "webp",
): string {
  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  return `${fileId}-${label}-${digest}.${extension}`;
}

async function rasterVariants(
  file: DirectusMediaFile,
  bytes: Buffer,
  metadata: Metadata,
): Promise<Array<{ bytes: Buffer; filename: string } & PublicMediaVariant>> {
  const sourceWidth = intrinsicDimensions(metadata).width;
  const variants: Array<
    {
      bytes: Buffer;
      filename: string;
    } & PublicMediaVariant
  > = [];

  for (const width of responsiveWidths(sourceWidth)) {
    let output: { data: Buffer; info: OutputInfo };
    try {
      output = await sharp(bytes, {
        animated: true,
        failOn: "warning",
        limitInputPixels: MAX_MEDIA_PIXELS,
        sequentialRead: true,
      })
        .autoOrient()
        .resize({ fit: "inside", width, withoutEnlargement: true })
        .webp({ alphaQuality: 90, effort: 4, quality: 82 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw fileError(
        file.id,
        "asset",
        `could not generate ${width}px variant`,
      );
    }
    const height = output.info.pageHeight ?? output.info.height;
    const filename = hashedName(
      file.id,
      output.data,
      `${output.info.width}w`,
      "webp",
    );
    variants.push({
      bytes: output.data,
      filename,
      height,
      mimeType: "image/webp",
      src: `${PUBLIC_MEDIA_PATH}/${filename}`,
      width: output.info.width,
    });
  }
  return variants;
}

function assertOutputDirectory(outputDirectory: string): void {
  if (!outputDirectory.trim()) {
    throw new Error("Media outputDirectory must not be empty");
  }
}

export async function emitPublicMediaAsset(
  input: unknown,
  assetBytes: Uint8Array,
  options: EmitPublicMediaOptions,
): Promise<PublicMediaAsset> {
  const file = parseDirectusMediaFile(input, "public");
  const original = validateAssetBytes(file, assetBytes);
  assertOutputDirectory(options.outputDirectory);

  if (file.mimeType === "image/svg+xml") {
    const bytes = sanitizeSvg(original, file.id);
    const metadata = await imageMetadata(file, bytes);
    validateDeclaredDimensions(file, metadata);
    const { height, width } = intrinsicDimensions(metadata);
    const filename = hashedName(file.id, bytes, "image", "svg");
    const variant = {
      height,
      mimeType: "image/svg+xml" as const,
      src: `${PUBLIC_MEDIA_PATH}/${filename}`,
      width,
    };
    await mkdir(options.outputDirectory, { recursive: true });
    await writeFile(join(options.outputDirectory, filename), bytes);
    return {
      ...variant,
      id: file.id,
      variants: [variant],
    };
  }

  const metadata = await imageMetadata(file, original);
  validateDeclaredDimensions(file, metadata);
  const generated = await rasterVariants(file, original, metadata);
  await mkdir(options.outputDirectory, { recursive: true });
  await Promise.all(
    generated.map((variant) =>
      writeFile(join(options.outputDirectory, variant.filename), variant.bytes),
    ),
  );
  const variants = generated.map<PublicMediaVariant>(
    ({ height, mimeType, src, width }) => ({ height, mimeType, src, width }),
  );
  const largest = variants.at(-1);
  if (!largest) throw fileError(file.id, "asset", "produced no image variants");
  return {
    ...largest,
    id: file.id,
    ...(variants.length > 1
      ? {
          srcset: variants
            .map(({ src, width }) => `${src} ${width}w`)
            .join(", "),
        }
      : {}),
    variants,
  };
}

export async function resolvePublicMediaAsset(
  input: unknown,
  options: ResolvePublicMediaOptions,
): Promise<PublicMediaAsset> {
  const file = parseDirectusMediaFile(input, "public");
  const bytes = await fetchDirectusMediaBytes(file, options);
  return emitPublicMediaAsset(input, bytes, options);
}

export async function resolvePreviewMediaAsset(
  input: unknown,
  options: Pick<ResolvePublicMediaOptions, "directusUrl" | "fetch" | "token">,
): Promise<PreviewMediaAsset> {
  const file = parseDirectusMediaFile(input, "preview");
  const original = await fetchDirectusMediaBytes(file, options);
  const bytes =
    file.mimeType === "image/svg+xml"
      ? sanitizeSvg(original, file.id)
      : original;
  const metadata = await imageMetadata(file, bytes);
  validateDeclaredDimensions(file, metadata);
  const { height, width } = intrinsicDimensions(metadata);
  return { bytes, height, id: file.id, mimeType: file.mimeType, width };
}
