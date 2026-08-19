import { createHash } from "node:crypto";

import { fromHtml } from "hast-util-from-html";
import type { Element, RootContent } from "hast";
import { JSDOM } from "jsdom";
import sanitizeHtml from "sanitize-html";
import { visit } from "unist-util-visit";

interface CssRuleLike {
  cssText: string;
}

class ServerCssStyleSheet {
  cssRules: CssRuleLike[] = [];

  insertRule(rule: string, index = this.cssRules.length): number {
    this.cssRules.splice(index, 0, { cssText: rule });
    return index;
  }

  replaceSync(styles: string): void {
    this.cssRules = [{ cssText: styles }];
  }
}

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
});
const serverWindow = dom.window;

for (const name of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "SVGElement",
  "Element",
  "Node",
  "DOMParser",
  "XMLSerializer",
  "MutationObserver",
] as const) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value:
      name === "window"
        ? serverWindow
        : name === "document"
          ? serverWindow.document
          : serverWindow[name],
  });
}
Object.defineProperty(globalThis, "getComputedStyle", {
  configurable: true,
  value: serverWindow.getComputedStyle.bind(serverWindow),
});

// Mermaid asks SVG text nodes for their browser-measured bounds. A stable
// character-based estimate is sufficient for build-time layout and avoids
// pulling a canvas or headless browser into the production build.
const estimateTextWidth = (value: string | null, fontSize: number): number =>
  Array.from(value ?? "").length * fontSize * 0.62;

interface SvgBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

function numericAttribute(element: SVGElement, name: string): number {
  return Number.parseFloat(element.getAttribute(name) ?? "0") || 0;
}

function transformBounds(
  bounds: SvgBounds,
  transform: string | null,
): SvgBounds {
  if (!transform) return bounds;
  let { height, width, x, y } = bounds;
  for (const match of transform.matchAll(
    /(matrix|scale|translate)\s*\(([^)]+)\)/giu,
  )) {
    const values = match[2]?.split(/[\s,]+/u).map(Number) ?? [];
    if (match[1]?.toLowerCase() === "translate") {
      x += values[0] ?? 0;
      y += values[1] ?? 0;
    } else if (match[1]?.toLowerCase() === "scale") {
      const scaleX = values[0] ?? 1;
      const scaleY = values[1] ?? scaleX;
      x *= scaleX;
      y *= scaleY;
      width *= Math.abs(scaleX);
      height *= Math.abs(scaleY);
    } else if (match[1]?.toLowerCase() === "matrix") {
      const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = values;
      const corners = [
        [x, y],
        [x + width, y],
        [x, y + height],
        [x + width, y + height],
      ].map(([cornerX = 0, cornerY = 0]) => ({
        x: a * cornerX + c * cornerY + e,
        y: b * cornerX + d * cornerY + f,
      }));
      const xs = corners.map((corner) => corner.x);
      const ys = corners.map((corner) => corner.y);
      x = Math.min(...xs);
      y = Math.min(...ys);
      width = Math.max(...xs) - x;
      height = Math.max(...ys) - y;
    }
  }
  return { height, width, x, y };
}

function mergeBounds(bounds: readonly SvgBounds[]): SvgBounds {
  if (!bounds.length) return { height: 0, width: 0, x: 0, y: 0 };
  const x = Math.min(...bounds.map((item) => item.x));
  const y = Math.min(...bounds.map((item) => item.y));
  const right = Math.max(...bounds.map((item) => item.x + item.width));
  const bottom = Math.max(...bounds.map((item) => item.y + item.height));
  return { height: bottom - y, width: right - x, x, y };
}

function svgBounds(element: SVGElement): SvgBounds {
  const tagName = element.tagName.toLowerCase();
  if (tagName === "text" || tagName === "tspan") {
    const fontSize = numericAttribute(element, "font-size") || 16;
    const width = estimateTextWidth(element.textContent, fontSize);
    const anchor = element.getAttribute("text-anchor");
    const anchorOffset =
      anchor === "middle" ? width / 2 : anchor === "end" ? width : 0;
    return {
      height: fontSize * 1.2,
      width,
      x: numericAttribute(element, "x") - anchorOffset,
      y: numericAttribute(element, "y") - fontSize,
    };
  }
  if (tagName === "rect") {
    return {
      height: numericAttribute(element, "height"),
      width: numericAttribute(element, "width"),
      x: numericAttribute(element, "x"),
      y: numericAttribute(element, "y"),
    };
  }
  if (tagName === "circle") {
    const radius = numericAttribute(element, "r");
    return {
      height: radius * 2,
      width: radius * 2,
      x: numericAttribute(element, "cx") - radius,
      y: numericAttribute(element, "cy") - radius,
    };
  }
  if (tagName === "ellipse") {
    const radiusX = numericAttribute(element, "rx");
    const radiusY = numericAttribute(element, "ry");
    return {
      height: radiusY * 2,
      width: radiusX * 2,
      x: numericAttribute(element, "cx") - radiusX,
      y: numericAttribute(element, "cy") - radiusY,
    };
  }
  if (tagName === "line") {
    const x1 = numericAttribute(element, "x1");
    const x2 = numericAttribute(element, "x2");
    const y1 = numericAttribute(element, "y1");
    const y2 = numericAttribute(element, "y2");
    return {
      height: Math.abs(y2 - y1),
      width: Math.abs(x2 - x1),
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
    };
  }

  const children = Array.from(element.children)
    .filter(
      (child): child is SVGElement => child instanceof serverWindow.SVGElement,
    )
    .map((child) =>
      transformBounds(svgBounds(child), child.getAttribute("transform")),
    )
    .filter((bounds) => bounds.width > 0 || bounds.height > 0);
  return mergeBounds(children);
}

Object.defineProperty(serverWindow.SVGElement.prototype, "getBBox", {
  configurable: true,
  value() {
    return svgBounds(this);
  },
});
Object.defineProperty(
  serverWindow.SVGElement.prototype,
  "getComputedTextLength",
  {
    configurable: true,
    value() {
      const fontSize =
        Number.parseFloat(this.getAttribute("font-size") ?? "16") || 16;
      return estimateTextWidth(this.textContent, fontSize);
    },
  },
);

// Mermaid 11 uses constructable stylesheets while assembling SVG styles. The
// server DOM does not expose that browser API in every Node release, so provide
// the small surface it calls during build-time rendering when necessary.
if (typeof globalThis.CSSStyleSheet === "undefined") {
  Object.defineProperty(globalThis, "CSSStyleSheet", {
    configurable: true,
    value: ServerCssStyleSheet,
  });
}

const { default: mermaid } = await import("mermaid");

mermaid.initialize({
  flowchart: { htmlLabels: false, nodeSpacing: 56, rankSpacing: 72 },
  fontFamily: "Inter, sans-serif",
  htmlLabels: false,
  securityLevel: "strict",
  startOnLoad: false,
  suppressErrorRendering: true,
  theme: "base",
  themeVariables: {
    background: "#e8e6e3",
    lineColor: "#2367ba",
    primaryBorderColor: "#aaa8ad",
    primaryColor: "#efedeb",
    primaryTextColor: "#3a3a4a",
    secondaryColor: "#dcdad7",
    tertiaryColor: "#e8e6e3",
  },
});

const SVG_TAGS = [
  "circle",
  "clipPath",
  "defs",
  "desc",
  "ellipse",
  "feDropShadow",
  "fedropshadow",
  "filter",
  "g",
  "line",
  "linearGradient",
  "marker",
  "path",
  "polygon",
  "polyline",
  "rect",
  "stop",
  "style",
  "svg",
  "symbol",
  "text",
  "title",
  "tspan",
] as const;

const SVG_ATTRIBUTES = [
  "alignment-baseline",
  "aria-describedby",
  "aria-label",
  "aria-labelledby",
  "aria-roledescription",
  "class",
  "clip-path",
  "clip-rule",
  "cx",
  "cy",
  "d",
  "data-edge",
  "data-et",
  "data-from",
  "data-id",
  "data-look",
  "data-points",
  "data-to",
  "data-type",
  "dominant-baseline",
  "dx",
  "dy",
  "fill",
  "fill-rule",
  "flood-color",
  "flood-opacity",
  "focusable",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "gradientUnits",
  "height",
  "id",
  "marker-end",
  "marker-start",
  "markerHeight",
  "markerUnits",
  "markerWidth",
  "name",
  "offset",
  "orient",
  "points",
  "preserveAspectRatio",
  "r",
  "refX",
  "refY",
  "role",
  "rx",
  "ry",
  "stdDeviation",
  "stop-color",
  "stop-opacity",
  "stroke",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-width",
  "style",
  "text-anchor",
  "transform",
  "viewBox",
  "width",
  "x",
  "x1",
  "x2",
  "xmlns",
  "y",
  "y1",
  "y2",
] as const;

const LOCAL_SVG_REFERENCE = /url\(\s*#[A-Za-z_][\w:.-]*\s*\)/giu;
const SVG_RESOURCE_PROPERTIES = new Set([
  "clipPath",
  "fill",
  "markerEnd",
  "markerStart",
  "stroke",
  "style",
]);

function isElement(node: RootContent): node is Element {
  return node.type === "element";
}

function diagramLabel(code: string): string {
  const header = code.trimStart().split(/\r?\n/u, 1)[0]?.toLowerCase() ?? "";
  return header.startsWith("sequencediagram") ? "时序图" : "流程图";
}

function assertLocalResource(value: string, context: string): void {
  const withoutLocalReferences = value.replace(LOCAL_SVG_REFERENCE, "");
  if (
    /(?:@import|expression\s*\(|javascript:|data:|https?:)/iu.test(value) ||
    /url\s*\(/iu.test(withoutLocalReferences)
  ) {
    throw new Error(`unsafe Mermaid SVG ${context} resource`);
  }
}

function assertLocalSvgResources(svg: Element): void {
  visit(svg, "element", (node: Element) => {
    for (const [name, property] of Object.entries(node.properties)) {
      if (!SVG_RESOURCE_PROPERTIES.has(name) || property === undefined)
        continue;
      const value = Array.isArray(property)
        ? property.map(String).join(" ")
        : String(property);
      assertLocalResource(value, name);
    }

    if (node.tagName === "style") {
      const styles = node.children
        .filter((child) => child.type === "text")
        .map((child) => child.value)
        .join("");
      assertLocalResource(styles, "style");
    }
  });
}

function sanitizeSvg(svg: string): string {
  return sanitizeHtml(svg, {
    allowProtocolRelative: false,
    allowVulnerableTags: true,
    allowedAttributes: { "*": [...SVG_ATTRIBUTES] },
    allowedSchemes: [],
    allowedTags: [...SVG_TAGS],
    disallowedTagsMode: "completelyDiscard",
    nestingLimit: 64,
    parseStyleAttributes: false,
    parser: {
      decodeEntities: true,
      lowerCaseAttributeNames: false,
      lowerCaseTags: false,
      xmlMode: true,
    },
  });
}

let renderQueue: Promise<void> = Promise.resolve();

async function renderDiagram(code: string, id: string): Promise<Element> {
  const label = diagramLabel(code);
  const { svg } = await mermaid.render(id, code);
  const tree = fromHtml(sanitizeSvg(svg), { fragment: true });
  const svgNode = tree.children.find(
    (node): node is Element => isElement(node) && node.tagName === "svg",
  );

  if (!svgNode) throw new Error("Mermaid did not produce an SVG element");
  assertLocalSvgResources(svgNode);

  const titleId = `${id}-title`;
  const existingClasses = svgNode.properties.className;
  svgNode.properties.className = [
    ...(Array.isArray(existingClasses) ? existingClasses.map(String) : []),
    "mermaid-svg",
  ];
  svgNode.properties.ariaLabelledBy = [titleId];
  svgNode.properties.focusable = "false";
  svgNode.properties.role = "img";
  svgNode.children.unshift({
    children: [{ type: "text", value: label }],
    properties: { id: titleId },
    tagName: "title",
    type: "element",
  });

  return {
    children: [svgNode],
    properties: {
      className: ["mermaid-diagram", "surface--inset"],
      dataMermaid: true,
    },
    tagName: "figure",
    type: "element",
  };
}

export async function renderMermaidToHast(
  code: string,
  identity: string,
): Promise<Element> {
  const id = `mermaid-${createHash("sha256")
    .update(`${identity}\0${code}`)
    .digest("hex")
    .slice(0, 12)}`;
  const pending = renderQueue.then(() => renderDiagram(code, id));
  renderQueue = pending.then(
    () => undefined,
    () => undefined,
  );
  return pending;
}
