import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import { IDS } from "../../directus/constants.mjs";
import {
  emitPublicMediaAsset,
  MAX_MEDIA_BYTES,
  parseDirectusMediaFile,
  resolvePreviewMediaAsset,
  resolvePublicMediaAsset,
} from "../../src/lib/media";

const FILE_ID = "15000000-0000-4000-8000-000000000001";
const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "blog-media-"));
  temporaryDirectories.push(directory);
  return directory;
}

function fileRecord(
  bytes: Uint8Array,
  overrides: Record<string, unknown> = {},
) {
  return {
    filename_download: "diagram.png",
    filesize: bytes.byteLength,
    folder: {
      id: IDS.folders.publishable,
      name: "publishable-assets",
    },
    height: 450,
    id: FILE_ID,
    type: "image/png",
    width: 800,
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("Directus media records", () => {
  it("enforces the publishable folder ID and expanded name for public builds", () => {
    const bytes = new Uint8Array([1]);

    expect(
      parseDirectusMediaFile(
        fileRecord(bytes, { folder: IDS.folders.publishable }),
      ).folder,
    ).toEqual({
      id: IDS.folders.publishable,
      name: "publishable-assets",
    });
    expect(() =>
      parseDirectusMediaFile(
        fileRecord(bytes, {
          folder: {
            id: IDS.folders.publishable,
            name: "private-draft-assets",
          },
        }),
      ),
    ).toThrow(`Directus file ${FILE_ID}: folder.name`);
    expect(() =>
      parseDirectusMediaFile(
        fileRecord(bytes, { folder: IDS.folders.private }),
      ),
    ).toThrow(`Directus file ${FILE_ID}: folder`);
    expect(
      parseDirectusMediaFile(
        fileRecord(bytes, { folder: IDS.folders.private }),
        "preview",
      ).folder.name,
    ).toBe("private-draft-assets");
  });

  it("rejects unsupported MIME types, oversized files, and missing raster dimensions", () => {
    const bytes = new Uint8Array([1]);

    expect(() =>
      parseDirectusMediaFile(fileRecord(bytes, { type: "application/pdf" })),
    ).toThrow(`Directus file ${FILE_ID}: type`);
    expect(() =>
      parseDirectusMediaFile(
        fileRecord(bytes, { filesize: MAX_MEDIA_BYTES + 1 }),
      ),
    ).toThrow(`Directus file ${FILE_ID}: filesize`);
    expect(() =>
      parseDirectusMediaFile(fileRecord(bytes, { height: null, width: null })),
    ).toThrow(`Directus file ${FILE_ID}: width`);
  });
});

describe("public media assets", () => {
  it("derives intrinsic dimensions and deterministic responsive WebP assets", async () => {
    const source = await sharp({
      create: {
        background: { alpha: 1, b: 180, g: 120, r: 40 },
        channels: 4,
        height: 450,
        width: 800,
      },
    })
      .png()
      .toBuffer();
    const firstDirectory = await temporaryDirectory();
    const secondDirectory = await temporaryDirectory();

    const first = await emitPublicMediaAsset(fileRecord(source), source, {
      outputDirectory: firstDirectory,
    });
    const second = await emitPublicMediaAsset(fileRecord(source), source, {
      outputDirectory: secondDirectory,
    });

    expect(first).toEqual(second);
    expect(first.mimeType).toBe("image/webp");
    expect(first.width).toBe(800);
    expect(first.height).toBe(450);
    expect(first.variants.map(({ width }) => width)).toEqual([640, 800]);
    expect(first.srcset).toContain(" 640w");
    expect(first.srcset).toContain(" 800w");
    expect(first.src).toMatch(
      new RegExp(`^/_media/${FILE_ID}-800w-[a-f0-9]{16}\\.webp$`),
    );
    expect((await readdir(firstDirectory)).sort()).toEqual(
      (await readdir(secondDirectory)).sort(),
    );

    const emitted = await sharp(
      join(firstDirectory, first.src.split("/").at(-1)!),
    ).metadata();
    expect({ height: emitted.height, width: emitted.width }).toEqual({
      height: 450,
      width: 800,
    });
    await expect(
      emitPublicMediaAsset(
        fileRecord(source, { filesize: source.byteLength + 1 }),
        source,
        { outputDirectory: firstDirectory },
      ),
    ).rejects.toThrow(`Directus file ${FILE_ID}: filesize`);
    await expect(
      emitPublicMediaAsset(
        fileRecord(source, {
          filename_download: "diagram.jpg",
          type: "image/jpeg",
        }),
        source,
        { outputDirectory: firstDirectory },
      ),
    ).rejects.toThrow(`Directus file ${FILE_ID}: type`);
  });

  it("sanitizes safe SVG and rejects executable SVG with file diagnostics", async () => {
    const safe = Buffer.from(`<?xml version="1.0"?>
<!-- removed from the public asset -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180">
  <title>安全图示</title>
  <rect id="surface" width="320" height="180" fill="#dce8f5" />
</svg>`);
    const directory = await temporaryDirectory();
    const result = await emitPublicMediaAsset(
      fileRecord(safe, {
        filename_download: "diagram.svg",
        height: 180,
        type: "image/svg+xml",
        width: 320,
      }),
      safe,
      { outputDirectory: directory },
    );
    const output = await readFile(
      join(directory, result.src.split("/").at(-1)!),
      "utf8",
    );

    expect(result).toMatchObject({
      height: 180,
      mimeType: "image/svg+xml",
      width: 320,
    });
    expect(output).toContain("<title>安全图示</title>");
    expect(output).not.toContain("<?xml");
    expect(output).not.toContain("<!--");

    const unsafe = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
    );
    await expect(
      emitPublicMediaAsset(
        fileRecord(unsafe, {
          filename_download: "unsafe.svg",
          height: 10,
          type: "image/svg+xml",
          width: 10,
        }),
        unsafe,
        { outputDirectory: directory },
      ),
    ).rejects.toThrow(`Directus file ${FILE_ID}: svg`);
  });

  it("fetches with a header token and returns only local hashed paths", async () => {
    const source = await sharp({
      create: {
        background: "#2463a5",
        channels: 3,
        height: 450,
        width: 800,
      },
    })
      .png()
      .toBuffer();
    const directory = await temporaryDirectory();
    const token = "private-build-token";
    let requestUrl = "";
    let authorization = "";
    const fetcher: typeof fetch = async (input, init) => {
      requestUrl = String(input);
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      return new Response(source, {
        headers: { "content-type": "image/png" },
      });
    };

    const result = await resolvePublicMediaAsset(fileRecord(source), {
      directusUrl: "https://cms.example.com/",
      fetch: fetcher,
      outputDirectory: directory,
      token,
    });

    expect(requestUrl).toBe(`https://cms.example.com/assets/${FILE_ID}`);
    expect(requestUrl).not.toContain(token);
    expect(authorization).toBe(`Bearer ${token}`);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(result.src).toMatch(/^\/_media\//);
  });

  it("returns validated private media bytes for the protected preview route", async () => {
    const source = await sharp({
      create: {
        background: "#2463a5",
        channels: 3,
        height: 450,
        width: 800,
      },
    })
      .png()
      .toBuffer();
    const result = await resolvePreviewMediaAsset(
      fileRecord(source, { folder: IDS.folders.private }),
      {
        directusUrl: "https://cms.example.com",
        fetch: async () =>
          new Response(source, { headers: { "content-type": "image/png" } }),
        token: "private-preview-token",
      },
    );

    expect(result).toMatchObject({
      height: 450,
      id: FILE_ID,
      mimeType: "image/png",
      width: 800,
    });
    expect(result.bytes).toEqual(source);
  });
});
