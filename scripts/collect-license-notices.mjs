import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const destination = process.argv[2];
if (
  !/^(frontend-v2|author-cms)\/\.next\/THIRD_PARTY_NOTICES\.txt$/.test(
    destination ?? "",
  )
) {
  throw new Error(
    "Expected an application's .next/THIRD_PARTY_NOTICES.txt path",
  );
}

const store = "node_modules/.pnpm";
const packages = new Map();
async function collect(folder) {
  const metadata = JSON.parse(
    await readFile(path.join(folder, "package.json"), "utf8"),
  );
  const key = `${metadata.name}@${metadata.version}`;
  if (packages.has(key)) return;
  const notices = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (
      entry.isFile() &&
      /^(licen[cs]e|copying|notice|ofl)(?:[._-]|$)/i.test(entry.name)
    ) {
      notices.push(
        `${entry.name}\n${await readFile(path.join(folder, entry.name), "utf8")}`,
      );
    }
  }
  // libvips ships its native dependency/license inventory in README.md.
  if (metadata.name.startsWith("@img/sharp-libvips-")) {
    notices.push(
      `README.md\n${await readFile(path.join(folder, "README.md"), "utf8")}`,
    );
  }
  packages.set(
    key,
    `${key}\nDeclared license: ${JSON.stringify(metadata.license ?? metadata.licenses ?? "not declared")}\n${notices.join("\n\n")}`,
  );
}

for (const item of await readdir(store, { withFileTypes: true })) {
  if (
    !item.isDirectory() ||
    item.name.startsWith(".") ||
    item.name === "node_modules"
  )
    continue;
  const modules = path.join(store, item.name, "node_modules");
  for (const entry of await readdir(modules, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folder = path.join(modules, entry.name);
    if (entry.name.startsWith("@")) {
      for (const scoped of await readdir(folder, { withFileTypes: true })) {
        if (scoped.isDirectory()) await collect(path.join(folder, scoped.name));
      }
    } else {
      await collect(folder);
    }
  }
}

const runtimeNotices = [];
if (destination.startsWith("author-cms/")) {
  for (const file of (await readdir("author-cms/licenses")).sort()) {
    if (file.endsWith(".txt"))
      runtimeNotices.push(
        `${file}\n${await readFile(path.join("author-cms/licenses", file), "utf8")}`,
      );
  }
}
await writeFile(
  destination,
  [
    "Third-party package metadata and supplied license/copyright notices.",
    "Collected from the locked installation; includes build-time dependencies.",
    ...[...packages.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => `\n${"=".repeat(72)}\n${value}`),
    ...runtimeNotices,
  ].join("\n") + "\n",
);
console.log(`Collected notices for ${packages.size} installed packages.`);
