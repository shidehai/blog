import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";

const publicDirectory = join(process.cwd(), "public");
const outputDirectory = join(publicDirectory, "images");
const workbenchPalette = {
  background: "#111820",
  panel: "#1b2733",
  connector: "#52677a",
  node: "#243545",
  nodeAccents: ["#78b7f0", "#75d2bd", "#88aef7", "#e8c978"],
  ink: "#f0f5f9",
  muted: "#a8b7c4",
  subtitle: "#92a6b7",
  signal: "#78b7f0",
} as const;
const socialPalette = {
  background: "#1e1e2a",
  panel: "#16161f",
  connector: "#a0a0b4",
  node: "#242433",
  nodeAccents: ["#4a8fe7", "#e0e0ec", "#a0a0b4", "#e8e6e3"],
  ink: "#e0e0ec",
  muted: "#a0a0b4",
  subtitle: "#a0a0b4",
  signal: "#4a8fe7",
} as const;
const brandIconTargets = [
  ["favicon-32x32.png", 32],
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
] as const;

function diagram(
  width: number,
  height: number,
  palette: typeof workbenchPalette | typeof socialPalette,
): Buffer {
  const scale = width / 1600;
  const panelY = height * 0.31;
  const panelHeight = height * 0.38;
  const nodes = [
    { label: "DIRECTUS", note: "WRITE", x: 120, color: palette.nodeAccents[0] },
    { label: "VALIDATE", note: "CHECK", x: 500, color: palette.nodeAccents[1] },
    { label: "ASTRO", note: "BUILD", x: 880, color: palette.nodeAccents[2] },
    {
      label: "DEPLOY",
      note: "RELEASE",
      x: 1260,
      color: palette.nodeAccents[3],
    },
  ];
  const scaled = (value: number) => Math.round(value * scale);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${palette.background}"/>
  <rect x="${scaled(64)}" y="${Math.round(panelY)}" width="${scaled(1472)}" height="${Math.round(panelHeight)}" rx="${scaled(12)}" fill="${palette.panel}"/>
  <path d="M ${scaled(250)} ${height / 2} H ${scaled(1350)}" fill="none" stroke="${palette.connector}" stroke-width="${scaled(4)}"/>
  ${nodes
    .map(
      ({
        label,
        note,
        x,
        color,
      }) => `<g transform="translate(${scaled(x)} ${Math.round(panelY + panelHeight / 2 - scaled(84))})">
    <rect width="${scaled(220)}" height="${scaled(168)}" rx="${scaled(10)}" fill="${palette.node}" stroke="${color}" stroke-width="${scaled(3)}"/>
    <circle cx="${scaled(34)}" cy="${scaled(34)}" r="${scaled(10)}" fill="${color}"/>
    <text x="${scaled(28)}" y="${scaled(96)}" fill="${palette.ink}" font-family="sans-serif" font-size="${scaled(27)}" font-weight="700">${label}</text>
    <text x="${scaled(28)}" y="${scaled(132)}" fill="${palette.muted}" font-family="sans-serif" font-size="${scaled(17)}">${note}</text>
  </g>`,
    )
    .join("\n")}
  <text x="${scaled(72)}" y="${scaled(92)}" fill="${palette.ink}" font-family="sans-serif" font-size="${scaled(42)}" font-weight="700">PUBLISHING WORKBENCH</text>
  <text x="${scaled(74)}" y="${scaled(132)}" fill="${palette.subtitle}" font-family="sans-serif" font-size="${scaled(20)}">DEVELOPMENT FIXTURE / VALIDATED STATIC DELIVERY</text>
  <text x="${scaled(72)}" y="${height - scaled(62)}" fill="${palette.signal}" font-family="monospace" font-size="${scaled(18)}">SNAPSHOT → MEDIA → ROUTES → SEARCH → IMAGE DIGEST</text>
</svg>`);
}

await mkdir(outputDirectory, { recursive: true });
const mark = await readFile(join(publicDirectory, "favicon.svg"));
await Promise.all([
  ...[640, 960, 1600].map((width) =>
    sharp(diagram(width, Math.round((width * 9) / 16), workbenchPalette))
      .webp({ effort: 4, quality: 88 })
      .toFile(
        join(
          outputDirectory,
          width === 1600
            ? "publishing-workbench.webp"
            : `publishing-workbench-${width}.webp`,
        ),
      ),
  ),
  sharp(diagram(1200, 630, socialPalette))
    .png({ compressionLevel: 9 })
    .toFile(join(outputDirectory, "default-social.png")),
  ...brandIconTargets.map(([filename, size]) =>
    sharp(mark)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(join(publicDirectory, filename)),
  ),
]);

console.log("Generated publication assets");
