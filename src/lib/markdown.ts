import GithubSlugger from "github-slugger";
import type {
  Element,
  ElementContent,
  Root as HastRoot,
  RootContent,
  Text as HastText,
} from "hast";
import type { Code, Heading, Image, Link, Root as MdastRoot } from "mdast";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { bundledLanguages, codeToHast, type BundledLanguage } from "shiki";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";

const UUID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const DIRECTUS_MEDIA = new RegExp(`^(?:directus://|/assets/)(${UUID})$`, "i");
const CALLOUTS = {
  IMPORTANT: { label: "重点", type: "important" },
  NOTE: { label: "说明", type: "note" },
  WARNING: { label: "注意", type: "warning" },
} as const;

export interface MarkdownMedia {
  height: number;
  id: string;
  mimeType: string;
  src: string;
  srcset?: string;
  width: number;
}

export interface MarkdownHeading {
  depth: number;
  id: string;
  text: string;
}

export interface OutlineHeading {
  id: string;
  level: 2 | 3;
  text: string;
}

export interface MarkdownLink {
  href: string;
  line: number | null;
}

export interface RenderedMarkdown {
  headings: readonly MarkdownHeading[];
  html: string;
  links: readonly MarkdownLink[];
  mediaIds: readonly string[];
  outline: readonly OutlineHeading[];
}

export interface RenderMarkdownOptions {
  media?: ReadonlyMap<string, MarkdownMedia>;
  source?: string;
}

export interface CodeMetadata {
  diff: boolean;
  filename: string | null;
  highlightedLines: ReadonlySet<number>;
}

interface StoredCodeMetadata extends CodeMetadata {
  language: string;
  sourceLine: number | null;
}

function lineLabel(source: string, line: number | null): string {
  return line === null ? source : `${source} line ${line}`;
}

function markdownError(
  source: string,
  line: number | null,
  message: string,
): Error {
  return new Error(`${lineLabel(source, line)}: ${message}`);
}

function nodeLine(node: {
  position?: { start: { line: number } } | undefined;
}): number | null {
  return node.position?.start.line ?? null;
}

function isBundledLanguage(value: string): value is BundledLanguage {
  return Object.hasOwn(bundledLanguages, value);
}

function normalizeLanguage(value: string, source: string, line: number | null) {
  const language = value.toLowerCase();
  if (["text", "plaintext", "txt"].includes(language)) return "text" as const;
  if (isBundledLanguage(language)) return language;
  throw markdownError(source, line, `unsupported code language "${value}"`);
}

export function parseCodeMetadata(
  input: string | null | undefined,
  lineCount: number,
): CodeMetadata {
  const meta = input?.trim() ?? "";
  if (!meta) {
    return { diff: false, filename: null, highlightedLines: new Set() };
  }

  let cursor = 0;
  let diff = false;
  let filename: string | null = null;
  let ranges: string | null = null;
  const token = /filename="([^"<>\r\n]+)"|\{([^{}\s]+)\}|diff/g;

  for (const match of meta.matchAll(token)) {
    if (match.index === undefined || meta.slice(cursor, match.index).trim()) {
      throw new Error(`invalid code metadata "${meta}"`);
    }
    cursor = match.index + match[0].length;

    if (match[1] !== undefined) {
      if (
        filename !== null ||
        match[1].trim() !== match[1] ||
        match[1].length > 120
      ) {
        throw new Error("code filename metadata is invalid or duplicated");
      }
      filename = match[1];
    } else if (match[2] !== undefined) {
      if (ranges !== null) throw new Error("code line ranges are duplicated");
      ranges = match[2];
    } else {
      if (diff) throw new Error("code diff metadata is duplicated");
      diff = true;
    }
  }

  if (meta.slice(cursor).trim())
    throw new Error(`invalid code metadata "${meta}"`);

  const highlightedLines = new Set<number>();
  if (ranges !== null) {
    if (!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(ranges)) {
      throw new Error(`invalid highlighted line range "{${ranges}}"`);
    }
    for (const range of ranges.split(",")) {
      const [startText, endText = startText] = range.split("-");
      const start = Number(startText);
      const end = Number(endText);
      if (start < 1 || end < start || end > lineCount) {
        throw new Error(
          `highlighted line range "${range}" is outside this ${lineCount}-line block`,
        );
      }
      for (let line = start; line <= end; line += 1) highlightedLines.add(line);
    }
  }

  return { diff, filename, highlightedLines };
}

export function parseDirectusMediaId(url: string): string | null {
  return DIRECTUS_MEDIA.exec(url)?.[1]?.toLowerCase() ?? null;
}

function validateLink(href: string, source: string, line: number | null): void {
  if (href.startsWith("#")) return;
  if (href.startsWith("/") && !href.startsWith("//")) return;

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    throw markdownError(
      source,
      line,
      `link "${href}" must be root-relative or an absolute URL`,
    );
  }
  if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
    throw markdownError(
      source,
      line,
      `link protocol "${url.protocol}" is not allowed`,
    );
  }
}

function parser() {
  return unified().use(remarkParse).use(remarkGfm);
}

function mdast(markdown: string): MdastRoot {
  return parser().parse(markdown);
}

function plainTextFromTree(tree: MdastRoot, includeCode: boolean): string {
  const values: string[] = [];
  visit(tree, (node) => {
    if (node.type === "text" || node.type === "inlineCode") {
      values.push(node.value);
    } else if (includeCode && node.type === "code") {
      values.push(node.value);
    }
  });
  return values.join(" ").replace(/\s+/g, " ").trim();
}

export function markdownToPlainText(markdown: string): string {
  return plainTextFromTree(mdast(markdown), false);
}

export function deriveExcerpt(markdown: string, maximumLength = 120): string {
  const text = markdownToPlainText(markdown);
  const characters = Array.from(text);
  if (characters.length <= maximumLength) return text;
  return `${characters.slice(0, maximumLength).join("").trimEnd()}…`;
}

export function deriveReadingMinutes(markdown: string): number {
  const tree = mdast(markdown);
  const prose = plainTextFromTree(tree, false);
  const hanCount = prose.match(/\p{Script=Han}/gu)?.length ?? 0;
  const latinCount =
    prose.replace(/\p{Script=Han}/gu, " ").match(/[\p{L}\p{N}]+/gu)?.length ??
    0;
  let codeLines = 0;
  visit(tree, "code", (node: Code) => {
    codeLines += node.value.split("\n").length;
  });
  return Math.max(
    1,
    Math.ceil(hanCount / 300 + latinCount / 200 + codeLines / 20),
  );
}

export function extractDirectusMediaIds(
  markdown: string,
  source = "Markdown",
): readonly string[] {
  const ids = new Set<string>();
  visit(mdast(markdown), "image", (node: Image) => {
    const line = nodeLine(node);
    const id = parseDirectusMediaId(node.url);
    if (!id) {
      throw markdownError(
        source,
        line,
        `image "${node.url}" must use directus://<file-id> or /assets/<file-id>`,
      );
    }
    if (!node.alt?.trim()) {
      throw markdownError(
        source,
        line,
        `image ${id} requires alternative text`,
      );
    }
    ids.add(id);
  });
  return [...ids].sort();
}

function setCodeProperties(node: Code, metadata: StoredCodeMetadata): void {
  node.data = {
    ...node.data,
    hProperties: {
      dataCodeDiff: metadata.diff ? "true" : "false",
      dataCodeFilename: metadata.filename ?? "",
      dataCodeLanguage: metadata.language,
      dataCodeLines: [...metadata.highlightedLines].join(","),
      dataCodeSourceLine: metadata.sourceLine ?? "",
    },
  };
}

function validateMarkdown(
  source: string,
  links: MarkdownLink[],
  mediaIds: Set<string>,
) {
  return function transformer(tree: MdastRoot): void {
    visit(tree, "heading", (node: Heading) => {
      if (node.depth === 1) {
        throw markdownError(
          source,
          nodeLine(node),
          "body headings must start at level 2; the post title is the page heading",
        );
      }
    });
    visit(tree, "link", (node: Link) => {
      const line = nodeLine(node);
      validateLink(node.url, source, line);
      links.push({ href: node.url, line });
    });
    visit(tree, "image", (node: Image) => {
      const line = nodeLine(node);
      const id = parseDirectusMediaId(node.url);
      if (!id) {
        throw markdownError(
          source,
          line,
          `image "${node.url}" must use directus://<file-id> or /assets/<file-id>`,
        );
      }
      if (!node.alt?.trim()) {
        throw markdownError(
          source,
          line,
          `image ${id} requires alternative text`,
        );
      }
      mediaIds.add(id);
    });
    visit(tree, "code", (node: Code) => {
      const line = nodeLine(node);
      let metadata: CodeMetadata;
      try {
        metadata = parseCodeMetadata(node.meta, node.value.split("\n").length);
      } catch (error) {
        throw markdownError(
          source,
          line,
          error instanceof Error ? error.message : "invalid code metadata",
        );
      }
      const language = normalizeLanguage(node.lang ?? "text", source, line);
      setCodeProperties(node, { ...metadata, language, sourceLine: line });
    });
  };
}

function classNames(node: Element): string[] {
  const value = node.properties.className ?? node.properties.class;
  if (Array.isArray(value)) return value.map(String);
  return typeof value === "string" ? value.split(/\s+/).filter(Boolean) : [];
}

function addClass(node: Element, ...names: string[]): void {
  node.properties.className = [...new Set([...classNames(node), ...names])];
  delete node.properties.class;
}

function elementText(node: Element | HastRoot): string {
  const values: string[] = [];
  visit(node, "text", (child: HastText) => values.push(child.value));
  return values.join("");
}

function text(value: string): HastText {
  return { type: "text", value };
}

function element(
  tagName: string,
  properties: Element["properties"] = {},
  children: ElementContent[] = [],
): Element {
  return { type: "element", tagName, properties, children };
}

function trimCalloutMarker(paragraph: Element, marker: string): void {
  let remaining = marker.length;
  visit(paragraph, "text", (node: HastText) => {
    if (remaining === 0) return SKIP;
    const removed = Math.min(remaining, node.value.length);
    node.value = node.value.slice(removed);
    remaining -= removed;
    return undefined;
  });
  visit(paragraph, "text", (node: HastText) => {
    node.value = node.value.replace(/^\s+/, "");
    return SKIP;
  });
}

function readStringProperty(node: Element, name: string): string {
  const value = node.properties[name];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

function storedCodeMetadata(node: Element): StoredCodeMetadata {
  return {
    diff: readStringProperty(node, "dataCodeDiff") === "true",
    filename: readStringProperty(node, "dataCodeFilename") || null,
    highlightedLines: new Set(
      readStringProperty(node, "dataCodeLines")
        .split(",")
        .filter(Boolean)
        .map(Number),
    ),
    language: readStringProperty(node, "dataCodeLanguage") || "text",
    sourceLine: Number(readStringProperty(node, "dataCodeSourceLine")) || null,
  };
}

function transformDocument(
  source: string,
  outline: OutlineHeading[],
  headings: MarkdownHeading[],
  media: ReadonlyMap<string, MarkdownMedia>,
) {
  return function transformer(tree: HastRoot): void {
    const slugger = new GithubSlugger();

    visit(tree, "element", (node, index, parent) => {
      const headingMatch = /^h([1-6])$/.exec(node.tagName);
      if (headingMatch && node.properties.id !== "footnote-label") {
        const depth = Number(headingMatch[1]);
        const headingText = elementText(node).trim();
        const id = slugger.slug(headingText || "section");
        node.properties.id = id;
        headings.push({ depth, id, text: headingText });
        if (depth === 2 || depth === 3) {
          outline.push({ id, level: depth, text: headingText });
        }
      }

      if (node.tagName === "a") {
        const href = readStringProperty(node, "href");
        if (/^https?:\/\//i.test(href)) {
          node.properties.target = "_blank";
          node.properties.rel = ["noopener", "noreferrer"];
        }
      }

      if (
        node.tagName === "input" &&
        readStringProperty(node, "type") === "checkbox" &&
        node.properties.disabled === true
      ) {
        node.properties.ariaLabel =
          node.properties.checked === true ? "已完成" : "未完成";
      }

      if (node.tagName === "blockquote") {
        const paragraph = node.children.find(
          (child): child is Element =>
            child.type === "element" && child.tagName === "p",
        );
        if (paragraph) {
          const marker = /^\[!([A-Z]+)\]/.exec(elementText(paragraph));
          if (marker) {
            const definition = CALLOUTS[marker[1] as keyof typeof CALLOUTS];
            if (!definition) {
              throw markdownError(
                source,
                null,
                `unsupported callout type "${marker[1]}"`,
              );
            }
            trimCalloutMarker(paragraph, marker[0]);
            const body = node.children;
            node.tagName = "aside";
            node.properties = {
              ariaLabel: definition.label,
              className: ["callout", `callout--${definition.type}`],
            };
            node.children = [
              element("strong", { className: ["annotation-label"] }, [
                text(definition.label),
              ]),
              element("div", { className: ["callout-body"] }, body),
            ];
          }
        }
      }

      if (node.tagName === "table" && parent && index !== undefined) {
        parent.children[index] = element(
          "div",
          {
            ariaLabel: "数据表",
            className: ["table-wrapper"],
            role: "region",
            tabIndex: 0,
          },
          [node],
        );
        return SKIP;
      }

      if (
        node.tagName === "section" &&
        node.properties.dataFootnotes !== undefined
      ) {
        addClass(node, "footnotes");
      }

      if (node.tagName === "img" && parent && index !== undefined) {
        const sourceUrl = readStringProperty(node, "src");
        const id = parseDirectusMediaId(sourceUrl);
        if (!id) return;
        const resolved = media.get(id);
        if (!resolved) {
          throw markdownError(
            source,
            nodeLine(node),
            `media ${id} has not been resolved`,
          );
        }

        const alt = readStringProperty(node, "alt");
        const caption = readStringProperty(node, "title");
        const image = element("img", {
          alt,
          decoding: "async",
          height: resolved.height,
          loading: "lazy",
          src: resolved.src,
          ...(resolved.srcset
            ? {
                sizes: "(max-width: 48rem) 100vw, 48rem",
                srcSet: resolved.srcset,
              }
            : {}),
          width: resolved.width,
        });
        if (
          parent.type === "element" &&
          parent.tagName === "p" &&
          parent.children.length === 1
        ) {
          parent.tagName = "figure";
          parent.properties = {
            className: ["responsive-figure"],
            dataMediaId: id,
          };
          parent.children = [
            image,
            ...(caption ? [element("figcaption", {}, [text(caption)])] : []),
          ];
        } else {
          image.properties.dataMediaId = id;
          if (caption) image.properties.title = caption;
          parent.children[index] = image;
        }
        return SKIP;
      }
      return undefined;
    });
  };
}

function isElement(node: RootContent): node is Element {
  return node.type === "element";
}

function highlightCode(source: string) {
  return async function transformer(tree: HastRoot): Promise<void> {
    const blocks: Array<{
      code: Element;
      index: number;
      parent: Element | HastRoot;
    }> = [];
    visit(tree, "element", (node, index, parent) => {
      const onlyChild = node.children[0];
      if (
        node.tagName !== "pre" ||
        !parent ||
        index === undefined ||
        node.children.length !== 1 ||
        !onlyChild ||
        !isElement(onlyChild) ||
        onlyChild.tagName !== "code"
      ) {
        return undefined;
      }
      blocks.push({ code: onlyChild, index, parent });
      return undefined;
    });

    for (const block of blocks) {
      const metadata = storedCodeMetadata(block.code);
      const language = normalizeLanguage(
        metadata.language,
        source,
        metadata.sourceLine,
      );
      const code = elementText(block.code).replace(/\n$/, "");
      const sourceLines = code.split("\n");
      let highlighted: HastRoot;
      try {
        highlighted = await codeToHast(code, {
          lang: language,
          theme: "github-dark-default",
          transformers: [
            {
              line(node, line) {
                if (metadata.highlightedLines.has(line)) {
                  this.addClassToHast(node, "is-highlighted");
                }
                if (
                  metadata.diff &&
                  /^\+(?!\+\+)/.test(sourceLines[line - 1] ?? "")
                ) {
                  this.addClassToHast(node, "diff-add");
                }
                if (
                  metadata.diff &&
                  /^-(?!--)/.test(sourceLines[line - 1] ?? "")
                ) {
                  this.addClassToHast(node, "diff-remove");
                }
              },
            },
          ],
        });
      } catch {
        throw markdownError(
          source,
          metadata.sourceLine,
          `could not highlight language "${language}"`,
        );
      }

      const pre = highlighted.children.find(isElement);
      if (!pre)
        throw markdownError(
          source,
          metadata.sourceLine,
          "code rendering failed",
        );
      pre.properties.tabIndex = 0;
      const label = metadata.filename ?? language;
      block.parent.children[block.index] = element(
        "figure",
        { className: ["code-frame"], dataCodeBlock: true },
        [
          element("figcaption", { className: ["code-frame-header"] }, [
            element("span", {}, [text(label)]),
            element(
              "button",
              {
                ariaLabel: `复制 ${label}`,
                className: ["code-copy", "control--raised"],
                dataCopyCode: true,
                type: "button",
              },
              [element("span", { dataCopyLabel: true }, [text("复制")])],
            ),
          ]),
          pre,
        ],
      );
    }
  };
}

export async function renderMarkdown(
  markdown: string,
  options: RenderMarkdownOptions = {},
): Promise<RenderedMarkdown> {
  const source = options.source ?? "Markdown";
  const headings: MarkdownHeading[] = [];
  const links: MarkdownLink[] = [];
  const mediaIds = new Set<string>();
  const outline: OutlineHeading[] = [];
  const media = options.media ?? new Map<string, MarkdownMedia>();

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(validateMarkdown, source, links, mediaIds)
    .use(remarkRehype, {
      allowDangerousHtml: false,
      footnoteBackLabel: (_referenceIndex, rereferenceIndex) =>
        rereferenceIndex > 1
          ? `返回脚注（第 ${rereferenceIndex} 次引用）`
          : "返回脚注",
      footnoteLabel: "脚注",
    })
    .use(transformDocument, source, outline, headings, media)
    .use(highlightCode, source)
    .use(rehypeStringify)
    .process(markdown);

  return {
    headings,
    html: String(file),
    links,
    mediaIds: [...mediaIds].sort(),
    outline,
  };
}
