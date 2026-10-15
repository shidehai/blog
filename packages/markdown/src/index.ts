import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import type { Root, Element, RootContent } from "hast";
import type { VFile } from "vfile";

export interface HeadingItem {
  id: string;
  text: string;
  level: number;
}
declare module "vfile" {
  interface DataMap {
    mediaBase: string;
    headings: HeadingItem[];
    mediaIds: string[];
  }
}
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}_]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}
function textOf(node: RootContent): string {
  if (node.type === "text") return node.value;
  return "children" in node ? node.children.map(textOf).join("") : "";
}
function safeImageSource(source: string): boolean {
  if (
    !source ||
    /[\\\u0000-\u0020\u007f]/.test(source) ||
    /%(?:5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(source)
  )
    return false;
  if (source.startsWith("/")) return !source.startsWith("//");
  try {
    const url = new URL(source, "https://markdown-local.invalid/");
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
function decorate() {
  return (tree: Root, file: VFile) => {
    const headings: HeadingItem[] = [];
    const counts = new Map<string, number>();
    const mediaIds = new Set<string>();
    const mediaBase =
      typeof file.data.mediaBase === "string" ? file.data.mediaBase : "/media";
    visit(tree, "element", (node: Element, index, parent) => {
      if (/^h[1-6]$/.test(node.tagName)) {
        const text = textOf(node);
        const base = slugify(text) || "heading";
        const count = (counts.get(base) ?? 0) + 1;
        counts.set(base, count);
        const id = count === 1 ? base : `${base}-${count}`;
        node.properties.id = id;
        const level = Number(node.tagName[1]);
        if (level >= 2 && level <= 4) headings.push({ id, text, level });
      }
      if (node.tagName === "img") {
        const source = String(node.properties.src ?? "");
        if (!safeImageSource(source)) {
          if (parent && index !== undefined)
            parent.children.splice(index, 1, {
              type: "text",
              value: String(node.properties.alt ?? ""),
            });
          return;
        }
        const match = source.match(/^\/media\/([\da-f-]{36})$/i);
        if (match?.[1]) {
          mediaIds.add(match[1]);
          node.properties.src = `${mediaBase}/${match[1]}`;
        }
        node.properties.loading = "lazy";
        node.properties.decoding = "async";
      }
      if (
        node.tagName === "a" &&
        /^https?:\/\//.test(String(node.properties.href ?? ""))
      )
        node.properties.rel = ["noopener", "noreferrer"];
      if (node.tagName === "pre") {
        node.properties.className = ["chroma"];
        node.properties.tabIndex = 0;
        node.children.push({
          type: "element",
          tagName: "button",
          properties: {
            type: "button",
            className: ["code-copy"],
            ariaLabel: "复制代码",
          },
          children: [{ type: "text", value: "复制" }],
        });
      }
      if (node.tagName === "blockquote") {
        const first = node.children.find(
          (child): child is Element =>
            child.type === "element" && child.tagName === "p",
        );
        const text = first?.children[0];
        const match =
          text?.type === "text"
            ? text.value.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/)
            : null;
        if (match && text?.type === "text") {
          const labels: Record<string, string> = {
            NOTE: "提示说明",
            TIP: "最佳实践",
            IMPORTANT: "重要原则",
            WARNING: "注意",
            CAUTION: "警告",
          };
          text.value = text.value.slice(match[0].length);
          node.properties.className = [
            "alert-box",
            `alert-${match[1]!.toLowerCase()}`,
          ];
          node.children.unshift({
            type: "element",
            tagName: "strong",
            properties: {},
            children: [{ type: "text", value: labels[match[1]!]! }],
          });
        }
      }
    });
    file.data.headings = headings;
    file.data.mediaIds = [...mediaIds];
  };
}
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      code: [
        ...(defaultSchema.attributes?.code ?? []),
        ["className", /^language-./],
      ],
    },
  })
  .use(rehypeHighlight, { detect: false, ignoreMissing: true })
  .use(decorate)
  .use(rehypeStringify);
export function renderMarkdown(
  content: string,
  mediaBase = "/media",
): { html: string; headings: HeadingItem[]; mediaIds: string[] } {
  const file = processor.processSync({ value: content, data: { mediaBase } });
  return {
    html: String(file),
    headings: file.data.headings ?? [],
    mediaIds: file.data.mediaIds ?? [],
  };
}
export function extractHeadings(content: string): HeadingItem[] {
  return renderMarkdown(content).headings;
}
export function collectMediaIds(content: string): string[] {
  return renderMarkdown(content).mediaIds;
}
export function deriveReadingMinutes(content: string): number {
  const chinese = (content.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const words = (content.match(/[a-zA-Z0-9_-]+/g) ?? []).length;
  return Math.max(1, Math.ceil(chinese / 300 + words / 200));
}
export function deriveWordCount(content: string): number {
  return (content.match(/[\u4e00-\u9fff]|[a-zA-Z0-9_-]+/g) ?? []).length;
}
export function deriveExcerpt(content: string, length = 160): string {
  const plain = content
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/`{1,3}.*?`{1,3}/gs, "")
    .replace(/#{1,6}\s+|^>\s*|^[-*+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > length ? `${plain.slice(0, length)}...` : plain;
}
