import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const origin = "https://aiayy.cn/";
const outputRoot = new URL("./reference-source/", import.meta.url);
const chromeUserAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

await mkdir(new URL("./assets/", outputRoot), { recursive: true });
await mkdir(new URL("./fonts/", outputRoot), { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent: chromeUserAgent,
  colorScheme: "light",
});
const page = await context.newPage();
const loadedCodeUrls = new Set();

page.on("response", (response) => {
  const url = new URL(response.url());
  const contentType = response.headers()["content-type"] ?? "";
  const isCode =
    /(?:javascript|text\/css|text\/html)/i.test(contentType) ||
    /\.(?:m?js|css)$/i.test(url.pathname);
  const isAllowedOrigin =
    url.origin === "https://aiayy.cn" || url.origin === "https://fonts.googleapis.com";

  if (isCode && isAllowedOrigin) loadedCodeUrls.add(url.href);
});

await page.goto(origin, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(2_000);

for (const url of await page.evaluate(() => [
  ...[...document.querySelectorAll("script[src]")].map((node) => node.src),
  ...[...document.querySelectorAll("link[href]")]
    .filter((node) =>
      ["stylesheet", "modulepreload"].includes(node.rel),
    )
    .map((node) => node.href),
])) {
  loadedCodeUrls.add(url);
}

await context.close();
await browser.close();

const snapshots = [
  { url: origin, path: "index.html" },
  ...[...loadedCodeUrls]
    .filter((url) => url !== origin)
    .map((url) => {
      const parsed = new URL(url);
      if (parsed.origin === "https://fonts.googleapis.com") {
        return { url, path: "fonts/inter-google.css" };
      }
      return { url, path: `assets/${parsed.pathname.split("/").at(-1)}` };
    }),
];

const uniqueSnapshots = [
  ...new Map(snapshots.map((snapshot) => [snapshot.path, snapshot])).values(),
].sort((left, right) => left.path.localeCompare(right.path));

const manifestFiles = [];
for (const snapshot of uniqueSnapshots) {
  const response = await fetch(snapshot.url, {
    headers: {
      "User-Agent": chromeUserAgent,
      Accept: "text/css, text/html, application/javascript, */*;q=0.1",
      Referer: origin,
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${snapshot.url}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(new URL(snapshot.path, outputRoot), bytes);
  manifestFiles.push({
    path: snapshot.path,
    originUrl: snapshot.url,
    contentType: response.headers.get("content-type"),
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

const manifest = {
  origin,
  capturedAt: new Date().toISOString(),
  browserViewport: "1440x900",
  userAgent: chromeUserAgent,
  scope:
    "Public homepage HTML and CSS/JS resources loaded or linked by that page, plus external font-face declarations.",
  excluded:
    "Images, video/audio, API payloads, cookies, credentials, source maps, and font binaries.",
  files: manifestFiles,
};

await writeFile(
  new URL("manifest.json", outputRoot),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify(manifest, null, 2));
