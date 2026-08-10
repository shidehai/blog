import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const COVER_ASSET_URL = new URL(
  "../../public/images/ai-reliability-boundaries-960.webp",
  import.meta.url,
);

export async function loadSeedCoverFixture() {
  const bytes = await readFile(COVER_ASSET_URL);
  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 12);

  return {
    bytes,
    filename: "ai-reliability-boundaries-960.webp",
    mimeType: "image/webp",
    title: `AI 应用五层可靠性边界（SHA-256 ${digest}）`,
  };
}
