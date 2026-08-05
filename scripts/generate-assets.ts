import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";

const outputDirectory = join(process.cwd(), "public", "images");

function diagram(width: number, height: number): Buffer {
  const scale = width / 1600;
  const panelY = height * 0.31;
  const panelHeight = height * 0.38;
  const nodes = [
    { label: "DIRECTUS", note: "WRITE", x: 120, color: "#78b7f0" },
    { label: "VALIDATE", note: "CHECK", x: 500, color: "#75d2bd" },
    { label: "ASTRO", note: "BUILD", x: 880, color: "#88aef7" },
    { label: "DEPLOY", note: "RELEASE", x: 1260, color: "#e8c978" },
  ];
  const scaled = (value: number) => Math.round(value * scale);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#111820"/>
  <rect x="${scaled(64)}" y="${Math.round(panelY)}" width="${scaled(1472)}" height="${Math.round(panelHeight)}" rx="${scaled(12)}" fill="#1b2733"/>
  <path d="M ${scaled(250)} ${height / 2} H ${scaled(1350)}" fill="none" stroke="#52677a" stroke-width="${scaled(4)}"/>
  ${nodes
    .map(
      ({
        label,
        note,
        x,
        color,
      }) => `<g transform="translate(${scaled(x)} ${Math.round(panelY + panelHeight / 2 - scaled(84))})">
    <rect width="${scaled(220)}" height="${scaled(168)}" rx="${scaled(10)}" fill="#243545" stroke="${color}" stroke-width="${scaled(3)}"/>
    <circle cx="${scaled(34)}" cy="${scaled(34)}" r="${scaled(10)}" fill="${color}"/>
    <text x="${scaled(28)}" y="${scaled(96)}" fill="#f0f5f9" font-family="sans-serif" font-size="${scaled(27)}" font-weight="700">${label}</text>
    <text x="${scaled(28)}" y="${scaled(132)}" fill="#a8b7c4" font-family="sans-serif" font-size="${scaled(17)}">${note}</text>
  </g>`,
    )
    .join("\n")}
  <text x="${scaled(72)}" y="${scaled(92)}" fill="#f0f5f9" font-family="sans-serif" font-size="${scaled(42)}" font-weight="700">PUBLISHING WORKBENCH</text>
  <text x="${scaled(74)}" y="${scaled(132)}" fill="#92a6b7" font-family="sans-serif" font-size="${scaled(20)}">DEVELOPMENT FIXTURE / VALIDATED STATIC DELIVERY</text>
  <text x="${scaled(72)}" y="${height - scaled(62)}" fill="#78b7f0" font-family="monospace" font-size="${scaled(18)}">SNAPSHOT → MEDIA → ROUTES → SEARCH → IMAGE DIGEST</text>
</svg>`);
}

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  ...[640, 960, 1600].map((width) =>
    sharp(diagram(width, Math.round((width * 9) / 16)))
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
  sharp(diagram(1200, 630))
    .png({ compressionLevel: 9 })
    .toFile(join(outputDirectory, "default-social.png")),
]);

console.log("Generated publication assets");
