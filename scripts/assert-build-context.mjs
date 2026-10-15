import { readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const privateRoots = new Set([
  ".data",
  ".git",
  ".trellis",
  ".agents",
  ".codex",
  ".claude",
  "data",
  "backups",
  "exports",
  "directus",
]);
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (
      (entry.name === ".env" || entry.name.startsWith(".env.")) &&
      entry.name !== ".env.example"
    ) {
      throw new Error("Image context contains private runtime configuration");
    }
    if (directory === root && privateRoots.has(entry.name)) {
      throw new Error("Image context contains private or retired project data");
    }
    if (entry.isDirectory() && entry.name !== "node_modules") {
      await inspect(path.join(directory, entry.name));
    }
  }
}
await inspect(root);
console.log("build context isolation status=success");
