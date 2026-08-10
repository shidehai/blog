import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import sharp from "sharp";
import { describe, expect, test } from "vitest";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

function projectPath(...parts: string[]): string {
  return join(projectRoot, ...parts);
}

async function opaqueColors(path: string): Promise<Set<string>> {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const colors = new Set<string>();

  for (let offset = 0; offset < data.length; offset += info.channels) {
    if (data[offset + 3] !== 255) continue;
    colors.add(
      `#${[data[offset], data[offset + 1], data[offset + 2]]
        .map((channel) => channel?.toString(16).padStart(2, "0"))
        .join("")}`,
    );
  }

  return colors;
}

describe("brand and font assets", () => {
  test("ships the observed Inter v20 Latin subset with its official license", async () => {
    const font = await readFile(
      projectPath("public", "fonts", "inter-v20-latin.woff2"),
    );
    const stylesheet = await readFile(
      projectPath("src", "styles", "fonts.css"),
      "utf8",
    );
    const metadataHead = await readFile(
      projectPath("src", "components", "MetadataHead.astro"),
      "utf8",
    );
    const license = await readFile(
      projectPath("public", "fonts", "OFL.txt"),
      "utf8",
    );

    expect(createHash("sha256").update(font).digest("hex")).toBe(
      "3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62",
    );
    expect(font.subarray(0, 4).toString("ascii")).toBe("wOF2");
    expect(stylesheet).toContain('font-family: "Inter"');
    expect(stylesheet).toContain("font-weight: 300 900");
    expect(stylesheet).toContain(
      'url("/fonts/inter-v20-latin.woff2") format("woff2")',
    );
    expect(stylesheet).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/);
    expect(metadataHead).toContain('href="/fonts/inter-v20-latin.woff2"');
    expect(metadataHead).toContain('type="font/woff2"');
    expect(metadataHead).toContain('crossorigin="anonymous"');
    expect(metadataHead).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/);
    expect(license).toContain(
      "Copyright 2020 The Inter Project Authors (https://github.com/rsms/inter)",
    );
    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });

  test("keeps every generated brand asset at its public contract dimensions", async () => {
    const expectedDimensions = new Map<string, [number, number]>([
      ["favicon-32x32.png", [32, 32]],
      ["apple-touch-icon.png", [180, 180]],
      ["icon-192.png", [192, 192]],
      ["icon-512.png", [512, 512]],
      ["images/publishing-workbench-640.webp", [640, 360]],
      ["images/publishing-workbench-960.webp", [960, 540]],
      ["images/publishing-workbench.webp", [1600, 900]],
      ["images/ai-reliability-boundaries-640.webp", [640, 360]],
      ["images/ai-reliability-boundaries-960.webp", [960, 540]],
      ["images/ai-reliability-boundaries.webp", [1600, 900]],
      ["images/default-social.png", [1200, 630]],
    ]);

    for (const [relativePath, [width, height]] of expectedDimensions) {
      await expect(
        sharp(projectPath("public", relativePath)).metadata(),
      ).resolves.toMatchObject({ height, width });
    }
  });

  test("does not alter digest-addressed content media", async () => {
    const expectedDigests = new Map<string, string>([
      [
        "publishing-workbench-640.webp",
        "cbe710b8479c3c8ab61738bcc1621c9d1b1e87c210ad13612db7ba9c257a0cd3",
      ],
      [
        "publishing-workbench-960.webp",
        "d2e58e6a40b971a0fcfdf0a8225e2de2283f7691f0e63df02491596e505a0fa9",
      ],
      [
        "publishing-workbench.webp",
        "e5938adeb553bef5acc3ed200482895613cf84f1bb5fbbc8a5097617324b1875",
      ],
      [
        "ai-reliability-boundaries-640.webp",
        "acf0d2e76202551d4fb5c5af9ad4237d1f4bc96b93fb0a8fcf2f3ab8598410e5",
      ],
      [
        "ai-reliability-boundaries-960.webp",
        "ff8294f4b7b7c9b0c9c3e4d5450772f62d92dc51ce89b61600669db1e1652af9",
      ],
      [
        "ai-reliability-boundaries.webp",
        "a42601eaf1a2a89697f2666bfa261feceef6e20acd980c38b9803f146086395d",
      ],
    ]);

    for (const [filename, digest] of expectedDigests) {
      const asset = await readFile(projectPath("public", "images", filename));
      expect(createHash("sha256").update(asset).digest("hex")).toBe(digest);
    }
  });

  test("uses the approved palette in rasterized identity and social artwork", async () => {
    const iconColors = await opaqueColors(
      projectPath("public", "icon-192.png"),
    );
    const socialColors = await opaqueColors(
      projectPath("public", "images", "default-social.png"),
    );

    for (const color of ["#e8e6e3", "#4a8fe7", "#ffffff", "#3a3a4a"]) {
      expect(iconColors.has(color), `${color} missing from icon`).toBe(true);
    }
    for (const color of [
      "#1e1e2a",
      "#16161f",
      "#242433",
      "#e0e0ec",
      "#a0a0b4",
      "#4a8fe7",
    ]) {
      expect(
        socialColors.has(color),
        `${color} missing from social image`,
      ).toBe(true);
    }
  });
});
