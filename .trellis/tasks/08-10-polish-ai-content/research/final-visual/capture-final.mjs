import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = "http://127.0.0.1:4321";
const OUTPUT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const THEME_STORAGE_KEY = "pkj-theme";
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

const browser = await chromium.launch({ headless: true });
const report = {
  baseUrl: BASE_URL,
  capturedAt: new Date().toISOString(),
  captures: [],
};

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) =>
        image.complete ? image.decode().catch(() => undefined) : undefined,
      ),
    );
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
}

async function openPage(pathname, theme, viewport) {
  const context = await browser.newContext({
    colorScheme: theme,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    viewport,
  });
  await context.addInitScript(
    ({ key, selectedTheme }) => {
      try {
        localStorage.setItem(key, selectedTheme);
      } catch {
        // The script runs again after navigation with a storage origin.
      }
    },
    { key: THEME_STORAGE_KEY, selectedTheme: theme },
  );

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    requestFailures.push({
      error: request.failure()?.errorText ?? "unknown",
      url: request.url(),
    });
  });

  const response = await page.goto(`${BASE_URL}${pathname}`, {
    waitUntil: "networkidle",
  });
  await settle(page);
  return {
    consoleErrors,
    context,
    page,
    pageErrors,
    requestFailures,
    status: response?.status() ?? null,
  };
}

async function capture({
  action,
  file,
  fullPage = true,
  pathname,
  theme,
  viewport,
}) {
  const session = await openPage(pathname, theme, viewport);
  if (action) {
    await action(session.page);
    await settle(session.page);
  }

  const measurements = await session.page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    images: Array.from(document.images, (image) => ({
      alt: image.alt,
      naturalHeight: image.naturalHeight,
      naturalWidth: image.naturalWidth,
      src: image.currentSrc,
    })),
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  await session.page.screenshot({
    animations: "disabled",
    fullPage,
    path: path.join(OUTPUT_DIRECTORY, file),
  });
  report.captures.push({
    consoleErrors: session.consoleErrors,
    file,
    measurements,
    pageErrors: session.pageErrors,
    pathname,
    requestFailures: session.requestFailures,
    status: session.status,
    theme,
    viewport,
  });
  await session.context.close();
}

const baselineCaptures = [
  ["home-desktop-light.png", "/", "light", DESKTOP],
  ["home-desktop-dark.png", "/", "dark", DESKTOP],
  ["home-mobile-light.png", "/", "light", MOBILE],
  ["home-mobile-dark.png", "/", "dark", MOBILE],
  ["writing-desktop-light.png", "/writing/", "light", DESKTOP],
  ["writing-mobile-dark.png", "/writing/", "dark", MOBILE],
  ["notes-mobile-dark.png", "/notes/", "dark", MOBILE],
  ["topics-desktop-light.png", "/topics/", "light", DESKTOP],
  [
    "topic-mobile-light.png",
    "/topics/retrieval-augmented-generation/",
    "light",
    MOBILE,
  ],
  ["archive-desktop-light.png", "/archive/", "light", DESKTOP],
  ["archive-mobile-dark.png", "/archive/", "dark", MOBILE],
  [
    "tutorial-desktop-dark.png",
    "/writing/typescript-observable-rag-pipeline/",
    "dark",
    DESKTOP,
  ],
  [
    "tutorial-mobile-light.png",
    "/writing/typescript-observable-rag-pipeline/",
    "light",
    MOBILE,
  ],
  [
    "article-desktop-light.png",
    "/writing/production-llm-reliability-boundaries/",
    "light",
    DESKTOP,
  ],
  [
    "article-mobile-dark.png",
    "/writing/production-llm-reliability-boundaries/",
    "dark",
    MOBILE,
  ],
  [
    "note-desktop-dark.png",
    "/notes/temperature-is-not-confidence/",
    "dark",
    DESKTOP,
  ],
  [
    "note-mobile-light.png",
    "/notes/temperature-is-not-confidence/",
    "light",
    MOBILE,
  ],
  ["about-mobile-dark.png", "/about/", "dark", MOBILE],
];

for (const [file, pathname, theme, viewport] of baselineCaptures) {
  await capture({ file, pathname, theme, viewport });
}

for (const [file, theme, viewport] of [
  ["search-desktop-light.png", "light", DESKTOP],
  ["search-mobile-dark.png", "dark", MOBILE],
]) {
  await capture({
    action: async (page) => {
      await page.locator("[data-search-input]").fill("RAG");
      await page.locator(".search-result").first().waitFor({ state: "visible" });
    },
    file,
    pathname: "/search/",
    theme,
    viewport,
  });
}

for (const theme of ["light", "dark"]) {
  await capture({
    action: async (page) => {
      await page.locator("[data-mobile-navigation-trigger]").click();
      await page.locator("#mobile-navigation").waitFor({ state: "visible" });
    },
    file: `menu-mobile-${theme}.png`,
    fullPage: false,
    pathname: "/",
    theme,
    viewport: MOBILE,
  });
}

await capture({
  action: async (page) => {
    const outline = page.locator("details.article-outline-mobile");
    await outline.locator("summary").click();
    await outline.locator("[data-outline-link]").first().waitFor({
      state: "visible",
    });
  },
  file: "tutorial-outline-mobile-dark.png",
  fullPage: false,
  pathname: "/writing/typescript-observable-rag-pipeline/",
  theme: "dark",
  viewport: MOBILE,
});

await writeFile(
  path.join(OUTPUT_DIRECTORY, "verification-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);
await browser.close();
