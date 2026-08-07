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
  brandMeasurements: [],
};

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
}

async function openPage({ path: pathname, theme, viewport }) {
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

async function elementMeasurement(page, selector) {
  const locator = page.locator(selector).first();
  if ((await locator.count()) === 0 || !(await locator.isVisible())) return null;
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      box: {
        height: rect.height,
        width: rect.width,
        x: rect.x,
        y: rect.y,
      },
      material: {
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
        color: style.color,
        display: style.display,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        gridTemplateColumns: style.gridTemplateColumns,
        opacity: style.opacity,
        overflow: style.overflow,
        textOverflow: style.textOverflow,
        whiteSpace: style.whiteSpace,
      },
    };
  });
}

async function documentMeasurement(page) {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
  }));
}

async function capture({
  action,
  file,
  fullPage = true,
  path: pathname,
  selectors = [],
  theme,
  viewport,
}) {
  const session = await openPage({ path: pathname, theme, viewport });
  const { page } = session;
  if (action) {
    await action(page);
    await settle(page);
  }

  const selectorMeasurements = {};
  for (const selector of selectors) {
    selectorMeasurements[selector] = await elementMeasurement(page, selector);
  }

  await page.screenshot({
    animations: "disabled",
    fullPage,
    path: path.join(OUTPUT_DIRECTORY, file),
  });

  report.captures.push({
    consoleErrors: session.consoleErrors,
    document: await documentMeasurement(page),
    file,
    pageErrors: session.pageErrors,
    path: pathname,
    requestFailures: session.requestFailures,
    selectors: selectorMeasurements,
    status: session.status,
    theme,
    viewport,
  });
  await session.context.close();
}

async function measureBrand(width, compact = false) {
  const session = await openPage({
    path: "/",
    theme: "light",
    viewport: { height: 900, width },
  });
  const { page } = session;
  if (compact) {
    await page.evaluate(() => window.scrollTo(0, 101));
    await page.locator(".site-header").waitFor({ state: "visible" });
    await page.waitForFunction(
      () =>
        document.querySelector(".site-header")?.getAttribute("data-compact") ===
        "true",
    );
    await settle(page);
  }

  const measurement = await page.locator(".site-brand-name").evaluate((element) => {
    const brand = element.closest(".site-brand");
    const header = element.closest(".site-header");
    const navigation = document.querySelector(".desktop-navigation");
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const box = (target) => {
      if (!target) return null;
      const targetRect = target.getBoundingClientRect();
      return {
        height: targetRect.height,
        width: targetRect.width,
        x: targetRect.x,
        y: targetRect.y,
      };
    };
    return {
      accessibleLabel: brand?.getAttribute("aria-label") ?? null,
      brandBox: box(brand),
      clientWidth: element.clientWidth,
      compact: header?.getAttribute("data-compact") === "true",
      font: style.font,
      headerBox: box(header),
      isEllipsized: element.scrollWidth > element.clientWidth + 0.5,
      maxInlineSize: style.maxInlineSize,
      navigationBox:
        navigation && getComputedStyle(navigation).display !== "none"
          ? box(navigation)
          : null,
      opacity: style.opacity,
      overflow: style.overflow,
      rectWidth: rect.width,
      scrollWidth: element.scrollWidth,
      text: element.textContent?.trim() ?? "",
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace,
    };
  });
  report.brandMeasurements.push({ viewportWidth: width, ...measurement });
  await session.context.close();
}

const commonShellSelectors = [
  ".site-header",
  ".site-brand-name",
  ".site-footer",
];

for (const theme of ["light", "dark"]) {
  await capture({
    file: `writing-1440x1000-${theme}.png`,
    path: "/writing/",
    selectors: [...commonShellSelectors, ".page-shell", ".post-row"],
    theme,
    viewport: DESKTOP,
  });
  await capture({
    file: `writing-390x844-${theme}.png`,
    path: "/writing/",
    selectors: [...commonShellSelectors, ".page-shell", ".post-row"],
    theme,
    viewport: MOBILE,
  });
  await capture({
    file: `article-1440x1000-${theme}.png`,
    path: "/writing/validate-a-published-snapshot/",
    selectors: [
      ...commonShellSelectors,
      ".article-page",
      ".article-header",
      ".prose",
      ".code-frame",
      ".table-wrapper",
    ],
    theme,
    viewport: DESKTOP,
  });
  await capture({
    file: `article-390x844-${theme}.png`,
    path: "/writing/validate-a-published-snapshot/",
    selectors: [
      ...commonShellSelectors,
      ".article-page",
      ".article-header",
      ".prose",
      ".code-frame",
      ".table-wrapper",
    ],
    theme,
    viewport: MOBILE,
  });
}

await capture({
  file: "search-default-1440x1000-light.png",
  path: "/search/",
  selectors: [
    ...commonShellSelectors,
    ".search-page",
    ".search-workbench",
    "[data-search-default]",
  ],
  theme: "light",
  viewport: DESKTOP,
});
await capture({
  action: async (page) => {
    await page.locator("[data-search-input]").fill("\u9759\u6001\u53d1\u5e03");
    await page.locator(".search-result").first().waitFor({ state: "visible" });
  },
  file: "search-result-1440x1000-light.png",
  path: "/search/",
  selectors: [
    ...commonShellSelectors,
    ".search-page",
    ".search-workbench",
    ".search-result",
  ],
  theme: "light",
  viewport: DESKTOP,
});
await capture({
  action: async (page) => {
    await page.locator("[data-search-input]").fill("zzqxjkvw7391nomatch");
    await page.locator(".search-empty").waitFor({ state: "visible" });
  },
  file: "search-empty-390x844-light.png",
  path: "/search/",
  selectors: [
    ...commonShellSelectors,
    ".search-page",
    ".search-workbench",
    ".search-empty",
  ],
  theme: "light",
  viewport: MOBILE,
});
await capture({
  action: async (page) => {
    await page.locator("[data-search-input]").fill("\u9759\u6001\u53d1\u5e03");
    await page.locator(".search-result").first().waitFor({ state: "visible" });
  },
  file: "search-result-390x844-dark.png",
  path: "/search/",
  selectors: [
    ...commonShellSelectors,
    ".search-page",
    ".search-workbench",
    ".search-result",
  ],
  theme: "dark",
  viewport: MOBILE,
});

for (const route of [
  { label: "about", path: "/about/" },
  { label: "404", path: "/missing-visual-candidate/" },
]) {
  await capture({
    file: `${route.label}-1440x1000-light.png`,
    path: route.path,
    selectors: [...commonShellSelectors, "main > :first-child"],
    theme: "light",
    viewport: DESKTOP,
  });
  await capture({
    file: `${route.label}-390x844-dark.png`,
    path: route.path,
    selectors: [...commonShellSelectors, "main > :first-child"],
    theme: "dark",
    viewport: MOBILE,
  });
}

await capture({
  action: async (page) => {
    await page.locator("[data-mobile-navigation-trigger]").click();
    await page.locator("#mobile-navigation").waitFor({ state: "visible" });
  },
  file: "shell-menu-390x844-light.png",
  fullPage: false,
  path: "/",
  selectors: [
    ".site-header",
    ".site-brand-name",
    "#mobile-navigation",
    ".mobile-navigation-link",
  ],
  theme: "light",
  viewport: MOBILE,
});
await capture({
  action: async (page) => {
    await page.evaluate(() => window.scrollTo(0, 101));
    await page.waitForFunction(
      () =>
        document.querySelector(".site-header")?.getAttribute("data-compact") ===
        "true",
    );
  },
  file: "shell-compact-1440x1000-light.png",
  fullPage: false,
  path: "/",
  selectors: [".site-header", ".site-brand-name", ".theme-control"],
  theme: "light",
  viewport: DESKTOP,
});
await capture({
  file: "shell-resting-1440x1000-light.png",
  fullPage: false,
  path: "/",
  selectors: [
    ".site-header",
    ".site-brand",
    ".site-brand-name",
    ".desktop-navigation",
  ],
  theme: "light",
  viewport: DESKTOP,
});

for (const width of [1440, 1200, 1100, 1025, 1024, 768, 390, 320]) {
  await measureBrand(width);
}
await measureBrand(1440, true);

await writeFile(
  path.join(OUTPUT_DIRECTORY, "verification-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);
await browser.close();
