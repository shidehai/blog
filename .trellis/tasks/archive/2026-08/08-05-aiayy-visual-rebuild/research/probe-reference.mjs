import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const REFERENCE_URL = "https://aiayy.cn/";
const allViewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1100, height: 900 },
];
const requestedViewport = process.argv[2];
const viewports = requestedViewport
  ? allViewports.filter(
      ({ width, height }) => `${width}x${height}` === requestedViewport,
    )
  : allViewports;

if (viewports.length === 0) {
  throw new Error(
    `Unknown viewport ${requestedViewport}; expected ${allViewports
      .map(({ width, height }) => `${width}x${height}`)
      .join(", ")}`,
  );
}

const geometrySelectors = {
  header: ".header-inner",
  headerContent: ".header-content",
  logo: ".logo",
  desktopNav: ".nav-desktop",
  headerActions: ".header-actions",
  main: ".main-content",
  home: ".home-view",
  bentoContainer: ".bento-container",
  heroRow: ".bento-row--hero",
  profileCard: ".card-profile",
  heroCard: ".card-hero",
  heroText: ".hero-text",
  heroImage: ".hero-image",
  infoRow: ".bento-row--info",
  clockCard: ".card-clock",
  statsCard: ".card-stats",
  threeDCard: ".card-3d",
  articlesCard: ".card-articles",
  firstArticle: ".article-item",
  bottomRow: ".bento-row--bottom",
  techCard: ".card-tech",
  projectsCard: ".card-projects",
};

const styleProperties = [
  "display",
  "position",
  "gridTemplateColumns",
  "columnGap",
  "rowGap",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "marginTop",
  "marginBottom",
  "backgroundColor",
  "backgroundImage",
  "color",
  "borderRadius",
  "borderWidth",
  "boxShadow",
  "transform",
  "transitionDuration",
  "transitionTimingFunction",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "outlineColor",
  "outlineStyle",
  "outlineWidth",
  "outlineOffset",
];

const round = (value) => Math.round(value * 100) / 100;

async function measure(page, selector, properties = styleProperties) {
  return page.evaluate(
    ({ selector, properties }) => {
      const element = document.querySelector(selector);
      if (!element) return null;

      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        box: {
          x: Math.round(rect.x * 100) / 100,
          y: Math.round(rect.y * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
          bottom: Math.round(rect.bottom * 100) / 100,
        },
        style: Object.fromEntries(
          properties.map((property) => [property, style[property]]),
        ),
      };
    },
    { selector, properties },
  );
}

async function platformFonts(page, selector) {
  const client = await page.context().newCDPSession(page);
  await client.send("DOM.enable");
  await client.send("CSS.enable");
  const { root } = await client.send("DOM.getDocument");
  const { nodeId } = await client.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector,
  });
  const result = nodeId
    ? await client.send("CSS.getPlatformFontsForNode", { nodeId })
    : { fonts: [] };
  await client.detach();
  return result.fonts;
}

const browser = await chromium.launch({ headless: true });
const report = {
  reference: REFERENCE_URL,
  capturedAt: new Date().toISOString(),
  viewports: {},
};

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const fontResponses = [];

  page.on("response", (response) => {
    const contentType = response.headers()["content-type"] ?? "";
    if (/font|woff|truetype/i.test(contentType) || /\.(woff2?|ttf)(\?|$)/i.test(response.url())) {
      fontResponses.push({
        url: response.url(),
        status: response.status(),
        contentType,
      });
    }
  });

  await page.goto(REFERENCE_URL, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(2_000);

  const viewportKey = `${viewport.width}x${viewport.height}`;
  const geometry = {};
  for (const [name, selector] of Object.entries(geometrySelectors)) {
    geometry[name] = await measure(page, selector);
  }

  const type = {};
  for (const [name, selector] of Object.entries({
    body: "body",
    logo: ".logo-text",
    navigation: ".nav-link",
    cardLabel: ".card-label",
    profileName: ".profile-name",
    profileRole: ".profile-role",
    profileDescription: ".profile-desc",
    heroBadge: ".hero-badge",
    heroTitle: ".hero-title",
    heroDescription: ".hero-desc",
    clockTime: ".clock-time",
    statNumber: ".stat-num",
    articleTitle: ".article-title",
    articleExcerpt: ".article-excerpt",
    projectDescription: ".projects-desc",
  })) {
    type[name] = await measure(page, selector, [
      "fontFamily",
      "fontSize",
      "fontWeight",
      "lineHeight",
      "letterSpacing",
      "color",
      "textTransform",
    ]);
  }

  const entry = {
    geometry,
    type,
    computedBase: {
      html: await measure(page, "html", ["backgroundColor", "color", "fontSize"]),
      body: await measure(page, "body", ["backgroundColor", "color", "fontFamily", "fontSize", "lineHeight"]),
      app: await measure(page, "#app", ["backgroundColor", "color"]),
    },
  };

  if (viewport.width === 1440) {
    entry.fonts = {
      responses: fontResponses,
      declaredFaces: await page.evaluate(() =>
        [...document.fonts].map((face) => ({
          family: face.family,
          style: face.style,
          weight: face.weight,
          status: face.status,
        })),
      ),
      heroPlatformFonts: await platformFonts(page, ".hero-title"),
      bodyPlatformFonts: await platformFonts(page, ".profile-desc"),
    };

    entry.interactions = {};
    for (const [name, selector] of Object.entries({
      actionButton: ".action-btn",
      projectCard: ".card-projects",
      articleItem: ".article-item",
    })) {
      const before = await measure(page, selector);
      await page.locator(selector).first().hover();
      await page.waitForTimeout(400);
      const after = await measure(page, selector);
      entry.interactions[name] = { before, hover: after };
    }

    await page.mouse.move(1, 1);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    entry.interactions.keyboardFocus = {
      activeElement: await page.evaluate(() => ({
        tag: document.activeElement?.tagName,
        className:
          document.activeElement instanceof HTMLElement
            ? document.activeElement.className
            : null,
        focusVisible:
          document.activeElement instanceof HTMLElement
            ? document.activeElement.matches(":focus-visible")
            : false,
      })),
      style: await measure(page, ".nav-link.active"),
    };

    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(700);
    entry.scrolledHeader = {
      scrollY: round(await page.evaluate(() => window.scrollY)),
      className: await page.locator(".app-header").getAttribute("class"),
      header: await measure(page, ".header-inner"),
      logoAvatar: await measure(page, ".logo-avatar"),
      logoText: await measure(page, ".logo-text"),
      navLink: await measure(page, ".nav-link"),
      actionButton: await measure(page, ".action-btn"),
    };

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(700);
    await page.evaluate(() => document.body.classList.add("dark"));
    await page.waitForTimeout(500);
    entry.dark = {
      bodyClass: await page.locator("body").getAttribute("class"),
      body: await measure(page, "body", ["backgroundColor", "color"]),
      app: await measure(page, "#app", ["backgroundColor", "color"]),
      header: await measure(page, ".header-inner", ["backgroundColor", "boxShadow"]),
      card: await measure(page, ".neu-card", ["backgroundColor", "color", "boxShadow"]),
      article: await measure(page, ".article-item", ["backgroundColor", "color", "boxShadow"]),
      navActive: await measure(page, ".nav-link.active", ["backgroundColor", "color", "boxShadow"]),
    };

    await page.evaluate(() => document.body.classList.remove("dark"));
    await page.waitForTimeout(500);
    await page.screenshot({
      path: new URL("./reference-1440x900-light.png", import.meta.url).pathname,
      fullPage: false,
      animations: "disabled",
    });
  }

  report.viewports[viewportKey] = entry;
  await context.close();
  await writeFile(
    new URL(`./reference-computed-${viewportKey}.json`, import.meta.url),
    `${JSON.stringify(entry, null, 2)}\n`,
    "utf8",
  );
}

await browser.close();
let combinedViewports = report.viewports;
try {
  combinedViewports = Object.fromEntries(
    await Promise.all(
      allViewports.map(async ({ width, height }) => {
        const viewportKey = `${width}x${height}`;
        const entry = JSON.parse(
          await readFile(
            new URL(`./reference-computed-${viewportKey}.json`, import.meta.url),
            "utf8",
          ),
        );
        return [viewportKey, entry];
      }),
    ),
  );
} catch {
  // A partial run still writes the successfully captured viewport.
}
const combinedReport = { ...report, viewports: combinedViewports };
const serializedReport = `${JSON.stringify(combinedReport, null, 2)}\n`;
await writeFile(
  new URL("./reference-computed-measurements.json", import.meta.url),
  serializedReport,
  "utf8",
);
console.log(
  JSON.stringify({
    output: "reference-computed-measurements.json",
    capturedAt: combinedReport.capturedAt,
    viewports: Object.keys(combinedReport.viewports),
  }),
);
