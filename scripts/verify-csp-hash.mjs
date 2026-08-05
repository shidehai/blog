import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const [siteDirectory = "dist/client", caddyPath = "deploy/Caddyfile"] =
  process.argv.slice(2);

const [entries, caddy] = await Promise.all([
  readdir(siteDirectory, { recursive: true }),
  readFile(caddyPath, "utf8"),
]);

const inlineScripts = [];
for (const entry of entries) {
  if (!entry.endsWith(".html")) continue;
  const html = await readFile(join(siteDirectory, entry), "utf8");
  for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attributes = match[1] ?? "";
    const body = match[2] ?? "";
    if (/\bsrc\s*=/.test(attributes)) continue;
    if (/application\/ld\+json/.test(attributes)) continue;
    if (!body.trim()) continue;
    inlineScripts.push(body);
  }
}

if (inlineScripts.length === 0) {
  throw new Error("Generated site does not contain executable inline scripts");
}

const generatedHashes = new Set(
  inlineScripts.map(
    (script) =>
      `sha256-${createHash("sha256").update(script).digest("base64")}`,
  ),
);
const configuredHashes = new Set(
  [...caddy.matchAll(/'(?<hash>sha256-[A-Za-z0-9+/=]+)'/g)].flatMap((match) =>
    match.groups?.hash ? [match.groups.hash] : [],
  ),
);

for (const hash of generatedHashes) {
  const occurrences = caddy.split(`'${hash}'`).length - 1;
  if (occurrences !== 2) {
    throw new Error(
      `Caddyfile must contain ${hash} in public and preview CSP (found ${occurrences})`,
    );
  }
}
for (const hash of configuredHashes) {
  if (!generatedHashes.has(hash)) {
    throw new Error(`Caddyfile contains stale inline-script hash: ${hash}`);
  }
}

console.log(`csp hash status=success hashes=${generatedHashes.size}`);
