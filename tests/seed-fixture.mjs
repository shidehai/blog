import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadSeedCoverFixture } from "../directus/seed/fixtures.mjs";

const expectedDigest =
  "666002f894f46da14b86f0bb2b9e963e1f69907cf714b089b939afd6fe8fc26b";
const fixture = await loadSeedCoverFixture();

assert.ok(Buffer.isBuffer(fixture.bytes));
assert.equal(fixture.bytes.length, 18500);
assert.equal(fixture.bytes.toString("ascii", 0, 4), "RIFF");
assert.equal(fixture.bytes.toString("ascii", 8, 12), "WEBP");
assert.equal(fixture.bytes.readUInt32LE(4) + 8, fixture.bytes.length);
assert.equal(
  createHash("sha256").update(fixture.bytes).digest("hex"),
  expectedDigest,
);
assert.equal(fixture.filename, "ai-reliability-boundaries-960.webp");
assert.equal(fixture.mimeType, "image/webp");
assert.equal(
  fixture.title,
  `AI 应用五层可靠性边界（SHA-256 ${expectedDigest.slice(0, 12)}）`,
);

console.log("Seed cover fixture checks passed.");
