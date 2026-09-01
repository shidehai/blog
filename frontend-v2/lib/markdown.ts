import type { HeadingItem } from "./types";

export function deriveReadingMinutes(content: string): number {
  if (!content) return 1;
  const chineseCount = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (content.match(/[a-zA-Z0-9_-]+/g) || []).length;
  // Estimate: 300 Chinese chars/min, 200 English words/min
  const minutes = Math.ceil(chineseCount / 300 + englishWords / 200);
  return Math.max(1, minutes);
}

export function deriveExcerpt(content: string, length = 160): string {
  if (!content) return "";
  const plain = content
    .replace(/!\[.*?\]\(.*?\)/g, "") // remove images
    .replace(/\[(.*?)\]\(.*?\)/g, "$1") // replace links with text
    .replace(/`{1,3}.*?`{1,3}/gs, "") // remove code
    .replace(/#{1,6}\s+/g, "") // remove headers
    .replace(/>\s+/g, "") // remove blockquotes
    .replace(/[-*+]\s+/g, "") // remove lists
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > length ? plain.slice(0, length) + "..." : plain;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function extractHeadings(markdown: string): HeadingItem[] {
  const headings: HeadingItem[] = [];
  const lines = markdown.split("\n");
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```") || line.trim().startsWith("~~~")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{2,4})\s+(.+)$/);
    if (match && match[1] && match[2]) {
      const level = match[1].length;
      const rawText = match[2].replace(/\[(.*?)\]\(.*?\)/g, "$1").trim();
      const id = slugify(rawText) || `heading-${headings.length}`;
      headings.push({ id, text: rawText, level });
    }
  }

  return headings;
}
