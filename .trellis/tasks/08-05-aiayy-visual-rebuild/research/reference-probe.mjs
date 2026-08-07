import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve(
  ".trellis/tasks/08-05-aiayy-visual-rebuild/research",
);
const viewports = [
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x1000", width: 1440, height: 1000 },
];

const selectors = [
  "body",
  "#app",
  ".announcement-bar",
  ".announcement-close",
  ".app-header",
  ".header-inner",
  ".header-content",
  ".logo",
  ".logo-avatar",
  ".logo-text",
  ".nav-desktop",
  ".nav-mobile",
  ".header-actions",
  ".action-btn",
  ".theme-toggle",
  ".mobile-menu-btn",
  ".main-content",
  ".home-view",
  ".bento-container",
  ".bento-row--hero",
  ".card-profile",
  ".card-hero",
  ".hero-text",
  ".hero-image",
  ".hero-title",
  ".bento-row--info",
  ".card-clock",
  ".card-stats",
  ".card-3d",
  ".card-articles",
  ".articles-header",
  ".tab-group",
  ".neu-tab",
  ".article-item",
  ".article-excerpt",
  ".bento-row--bottom",
  ".tech-grid",
  ".card-projects",
  ".app-footer",
  ".footer-content",
  ".footer-bottom",
];

const roundedRect = (rect) =>
  rect
    ? Object.fromEntries(
        ["x", "y", "width", "height", "top", "right", "bottom", "left"].map(
          (key) => [key, Math.round(rect[key] * 100) / 100],
        ),
      )
    : null;

async function waitForHome(page) {
  await page.goto("https://aiayy.cn/", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.locator(".home-view").waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForFunction(
    () => document.querySelectorAll(".article-item").length >= 3,
    undefined,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(500);
}

async function axeSnapshot(page) {
  const axe = await new AxeBuilder({ page }).analyze();
  return {
    violations: axe.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      help: violation.help,
      helpUrl: violation.helpUrl,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        html: node.html,
        failureSummary: node.failureSummary,
      })),
    })),
    incomplete: axe.incomplete.map((item) => ({
      id: item.id,
      impact: item.impact,
      description: item.description,
      nodes: item.nodes.slice(0, 10).map((node) => ({
        target: node.target,
        html: node.html,
      })),
    })),
  };
}

async function pageSnapshot(page, label) {
  return page.evaluate(
    ({ label, selectors }) => {
      const snap = (element) => {
        if (!element) return null;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const keys = [
          "display",
          "visibility",
          "position",
          "gridTemplateColumns",
          "flexDirection",
          "order",
          "width",
          "height",
          "minHeight",
          "padding",
          "margin",
          "gap",
          "borderRadius",
          "color",
          "backgroundColor",
          "backgroundImage",
          "boxShadow",
          "fontFamily",
          "fontSize",
          "fontWeight",
          "lineHeight",
          "letterSpacing",
          "overflow",
          "overflowX",
          "overflowY",
          "whiteSpace",
          "textOverflow",
          "webkitLineClamp",
          "transitionProperty",
          "transitionDuration",
          "transitionTimingFunction",
          "transform",
          "opacity",
          "outlineStyle",
          "outlineWidth",
          "outlineColor",
          "zIndex",
          "cursor",
          "pointerEvents",
        ];
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || null,
          class: element.className || null,
          text: element.textContent?.replace(/\s+/g, " ").trim().slice(0, 160) || null,
          role: element.getAttribute("role"),
          ariaLabel: element.getAttribute("aria-label"),
          ariaExpanded: element.getAttribute("aria-expanded"),
          ariaControls: element.getAttribute("aria-controls"),
          title: element.getAttribute("title"),
          href: element.getAttribute("href"),
          tabIndex: element.tabIndex,
          rect: Object.fromEntries(
            ["x", "y", "width", "height", "top", "right", "bottom", "left"].map(
              (key) => [key, Math.round(rect[key] * 100) / 100],
            ),
          ),
          client: { width: element.clientWidth, height: element.clientHeight },
          scroll: { width: element.scrollWidth, height: element.scrollHeight },
          style: Object.fromEntries(keys.map((key) => [key, style[key]])),
        };
      };

      const children = (selector) =>
        [...(document.querySelector(selector)?.children || [])].map((element) =>
          snap(element),
        );

      const interactive = [
        ...document.querySelectorAll(
          'a[href], button, input, select, textarea, [role="button"], [tabindex]',
        ),
      ]
        .filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0;
        })
        .map((element) => snap(element));

      const overflow = [...document.querySelectorAll("body *")]
        .filter(
          (element) =>
            element.scrollWidth > element.clientWidth + 1 ||
            element.getBoundingClientRect().right > document.documentElement.clientWidth + 1 ||
            element.getBoundingClientRect().left < -1,
        )
        .slice(0, 80)
        .map((element) => snap(element));

      return {
        label,
        url: location.href,
        title: document.title,
        viewport: {
          innerWidth,
          innerHeight,
          devicePixelRatio,
          matches640: matchMedia("(width <= 640px)").matches,
          matches768: matchMedia("(width <= 768px)").matches,
          matches1024: matchMedia("(width <= 1024px)").matches,
          reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
          darkPreference: matchMedia("(prefers-color-scheme: dark)").matches,
        },
        bodyClass: document.body.className,
        themeMode: localStorage.getItem("themeMode"),
        scrollPosition: { x: scrollX, y: scrollY },
        documentSize: {
          clientWidth: document.documentElement.clientWidth,
          clientHeight: document.documentElement.clientHeight,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
        },
        selectors: Object.fromEntries(
          selectors.map((selector) => [selector, snap(document.querySelector(selector))]),
        ),
        childOrder: {
          app: children("#app"),
          bento: children(".bento-container"),
          hero: children(".bento-row--hero"),
          info: children(".bento-row--info"),
          bottom: children(".bento-row--bottom"),
          mobileNav: children(".nav-mobile"),
        },
        landmarks: [...document.querySelectorAll("header, nav, main, footer, aside")].map(
          (element) => snap(element),
        ),
        headings: [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(
          (element) => snap(element),
        ),
        interactive,
        undersizedTargets: interactive.filter(
          ({ rect }) => rect.width < 44 || rect.height < 44,
        ),
        overflow,
      };
    },
    { label, selectors },
  );
}

async function transitionSamples(page, selector, delays) {
  const output = [];
  let previous = 0;
  for (const delay of delays) {
    await page.waitForTimeout(delay - previous);
    previous = delay;
    output.push({ delay, value: await pageSnapshot(page, `${selector}-${delay}ms`) });
  }
  return output.map(({ delay, value }) => ({
    delay,
    bodyClass: value.bodyClass,
    element: value.selectors[selector],
    header: value.selectors[".header-inner"],
  }));
}

async function probeViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme: "light",
    reducedMotion: "no-preference",
    locale: "zh-CN",
  });
  await context.addInitScript(() => localStorage.setItem("themeMode", "light"));
  const page = await context.newPage();
  const failedRequests = [];
  const pageErrors = [];
  page.on("requestfailed", (request) =>
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText }),
  );
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await waitForHome(page);
  const report = {
    viewport,
    failedRequests,
    pageErrors,
    initial: await pageSnapshot(page, "initial-light"),
  };
  await page.screenshot({
    path: path.join(outputDir, `reference-${viewport.name}-light.png`),
    fullPage: true,
  });
  report.axeLight = await axeSnapshot(page);

  const mobileButton = page.locator(".mobile-menu-btn");
  if (await mobileButton.isVisible()) {
    report.mobileButtonBefore = await mobileButton.evaluate((element) => ({
      ariaExpanded: element.getAttribute("aria-expanded"),
      ariaControls: element.getAttribute("aria-controls"),
      html: element.outerHTML,
    }));
    await mobileButton.click();
    report.mobileMenuTimeline = await transitionSamples(page, ".nav-mobile", [0, 100, 320]);
    report.mobileOpen = await pageSnapshot(page, "mobile-menu-open");
    await page.screenshot({
      path: path.join(outputDir, `reference-${viewport.name}-menu-open.png`),
      fullPage: false,
    });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(350);
    report.escapeClosedMenu = !(await page.locator(".nav-mobile").isVisible());
    await page.mouse.click(viewport.width - 4, viewport.height - 4);
    await page.waitForTimeout(350);
    report.outsideClickClosedMenu = !(await page.locator(".nav-mobile").isVisible());
    if (await page.locator(".nav-mobile").isVisible()) {
      await mobileButton.click();
      await page.waitForTimeout(350);
    }
  }

  await page.evaluate(() => scrollTo(0, 150));
  report.scrolledTimeline = await transitionSamples(page, ".header-inner", [0, 100, 550]);
  report.scrolled = await pageSnapshot(page, "scrolled-light");
  await page.screenshot({
    path: path.join(outputDir, `reference-${viewport.name}-scrolled.png`),
    fullPage: false,
  });

  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(600);
  const themeButton = page.locator(".theme-toggle");
  report.themeButtonBefore = await themeButton.evaluate((element) => element.outerHTML);
  await themeButton.click();
  report.themeTimeline = await transitionSamples(page, "body", [0, 100, 350]);
  report.dark = await pageSnapshot(page, "dark");
  await page.screenshot({
    path: path.join(outputDir, `reference-${viewport.name}-dark.png`),
    fullPage: true,
  });

  report.themeCycle = [];
  for (let index = 0; index < 3; index += 1) {
    report.themeCycle.push(
      await themeButton.evaluate((element) => ({
        bodyClass: document.body.className,
        mode: localStorage.getItem("themeMode"),
        title: element.getAttribute("title"),
        ariaLabel: element.getAttribute("aria-label"),
      })),
    );
    await themeButton.click();
    await page.waitForTimeout(350);
  }

  await themeButton.focus();
  report.themeFocus = await themeButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outline: style.outline,
      boxShadow: style.boxShadow,
      activeElement: document.activeElement === element,
    };
  });

  report.axeDark = await axeSnapshot(page);

  if (viewport.width === 1440) {
    report.boundaryMatrix = [];
    for (const width of [640, 641, 768, 769, 1024, 1025]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(80);
      report.boundaryMatrix.push(
        await page.evaluate((boundaryWidth) => {
          const style = (selector) => {
            const computed = getComputedStyle(document.querySelector(selector));
            return {
              display: computed.display,
              gridTemplateColumns: computed.gridTemplateColumns,
              flexDirection: computed.flexDirection,
              width: computed.width,
              gap: computed.gap,
            };
          };
          return {
            boundaryWidth,
            navDesktop: style(".nav-desktop"),
            mobileMenuButton: style(".mobile-menu-btn"),
            heroRow: style(".bento-row--hero"),
            infoRow: style(".bento-row--info"),
            bottomRow: style(".bento-row--bottom"),
            techGrid: style(".tech-grid"),
            articleHeader: style(".articles-header"),
          };
        }, width),
      );
    }
  }

  await context.close();
  return report;
}

const browser = await chromium.launch({ headless: true });
try {
  const report = [];
  for (const viewport of viewports) {
    report.push(await probeViewport(browser, viewport));
  }
  await writeFile(
    path.join(outputDir, "reference-runtime-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
} finally {
  await browser.close();
}
