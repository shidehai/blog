import { readdir, readFile, appendFile } from "node:fs/promises";
import path from "node:path";

const [root, destination] = process.argv.slice(2);
if (!root || !destination)
  throw new Error("Expected font directory and notices destination");
const notices = new Set();
let copyrights = 0;
for (const name of (await readdir(root)).sort()) {
  if (!/\.(ttc|otf|ttf)$/i.test(name)) continue;
  const bytes = await readFile(path.join(root, name));
  const faces =
    bytes.toString("ascii", 0, 4) === "ttcf"
      ? Array.from({ length: bytes.readUInt32BE(8) }, (_, index) =>
          bytes.readUInt32BE(12 + index * 4),
        )
      : [0];
  for (const face of faces) {
    const tableCount = bytes.readUInt16BE(face + 4);
    for (let table = 0; table < tableCount; table++) {
      const record = face + 12 + table * 16;
      if (bytes.toString("ascii", record, record + 4) !== "name") continue;
      const offset = bytes.readUInt32BE(record + 8);
      const count = bytes.readUInt16BE(offset + 2);
      const strings = offset + bytes.readUInt16BE(offset + 4);
      for (let entry = 0; entry < count; entry++) {
        const position = offset + 6 + entry * 12;
        const platform = bytes.readUInt16BE(position);
        const nameId = bytes.readUInt16BE(position + 6);
        // SFNT name IDs 0 and 13 are copyright and license; Unicode/Windows are UTF-16BE.
        if (![0, 3].includes(platform) || ![0, 13].includes(nameId)) continue;
        const length = bytes.readUInt16BE(position + 8);
        const start = strings + bytes.readUInt16BE(position + 10);
        if (start + length > bytes.length || length % 2)
          throw new Error("Invalid installed font name table");
        const value = Buffer.from(bytes.subarray(start, start + length))
          .swap16()
          .toString("utf16le")
          .trim();
        if (value) {
          notices.add(value);
          if (nameId === 0) copyrights++;
        }
      }
    }
  }
}
if (!copyrights)
  throw new Error("Installed font copyright notices were not found");
await appendFile(
  destination,
  `\nRuntime Noto CJK font copyright and license metadata\n${[...notices].join("\n\n")}\n`,
);
console.log("Collected runtime font copyright and license metadata.");
