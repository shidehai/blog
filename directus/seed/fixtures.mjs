import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const COVER_ASSET_URL = new URL(
  "../../public/images/publishing-workbench-960.webp",
  import.meta.url,
);

export async function loadSeedCoverFixture() {
  const bytes = await readFile(COVER_ASSET_URL);
  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 12);

  return {
    bytes,
    filename: "fixture-cover.webp",
    mimeType: "image/webp",
    title: `示例封面（非真实内容，SHA-256 ${digest}）`,
  };
}
