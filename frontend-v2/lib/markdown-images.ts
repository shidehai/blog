export interface MarkdownImage {
  raw: string;
  source: string;
  alt: string;
  title?: string;
  /** Source span within raw, excluding any angle brackets. */
  sourceStart: number;
  sourceEnd: number;
}

function isEscaped(text: string, index: number): boolean {
  let slashes = 0;
  while (index > 0 && text[--index] === "\\") slashes++;
  return slashes % 2 === 1;
}

function unescapeMarkdown(text: string): string {
  return text.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, "$1");
}

export interface MarkdownCode {
  raw: string;
  content: string;
  kind: "fenced" | "inline";
  language?: string;
}

interface CodeRange {
  start: number;
  end: number;
  contentStart: number;
  contentEnd: number;
  kind: "fenced" | "inline";
  language?: string;
}

function codeRanges(markdown: string): CodeRange[] {
  const ranges: CodeRange[] = [];
  let index = 0;
  while (index < markdown.length) {
    if (index === 0 || markdown[index - 1] === "\n") {
      const lineEnd = markdown.indexOf("\n", index);
      const line = markdown
        .slice(index, lineEnd < 0 ? undefined : lineEnd)
        .replace(/\r$/, "");
      const fence = /^ {0,3}(?:> ?)*(`{3,}|~{3,})(.*)$/.exec(line);
      if (fence && !(fence[1]![0] === "`" && fence[2]!.includes("`"))) {
        const marker = fence[1]!;
        let end = lineEnd < 0 ? markdown.length : lineEnd + 1;
        const contentStart = end;
        let contentEnd = markdown.length;
        while (end < markdown.length) {
          const closingStart = end;
          const nextLineEnd = markdown.indexOf("\n", end);
          const nextLine = markdown.slice(
            end,
            nextLineEnd < 0 ? undefined : nextLineEnd,
          );
          const closing = /^ {0,3}(?:> ?)*(`+|~+)\s*$/.exec(nextLine);
          end = nextLineEnd < 0 ? markdown.length : nextLineEnd + 1;
          if (
            closing &&
            closing[1]![0] === marker[0] &&
            closing[1]!.length >= marker.length
          ) {
            contentEnd = closingStart;
            break;
          }
        }
        ranges.push({
          start: index,
          end,
          contentStart,
          contentEnd,
          kind: "fenced",
          language: /^[a-zA-Z0-9_-]*/.exec(fence[2]!.trim())?.[0] || "text",
        });
        index = end;
        continue;
      }
    }
    if (markdown[index] === "`" && !isEscaped(markdown, index)) {
      let openingEnd = index + 1;
      while (markdown[openingEnd] === "`") openingEnd++;
      let cursor = openingEnd;
      let closingEnd = -1;
      let contentEnd = -1;
      while (cursor < markdown.length) {
        const start = markdown.indexOf("`", cursor);
        if (start < 0) break;
        if (/\r?\n[ \t]*\r?\n/.test(markdown.slice(openingEnd, start))) break;
        cursor = start + 1;
        while (markdown[cursor] === "`") cursor++;
        if (cursor - start === openingEnd - index) {
          closingEnd = cursor;
          contentEnd = start;
          break;
        }
      }
      if (closingEnd >= 0) {
        ranges.push({
          start: index,
          end: closingEnd,
          contentStart: openingEnd,
          contentEnd,
          kind: "inline",
        });
        index = closingEnd;
        continue;
      }
      index = openingEnd;
      continue;
    }
    index++;
  }
  return ranges;
}

/** Renderer and image scanner use the same exact code boundaries. */
export function mapMarkdownCode(
  markdown: string,
  callback: (code: MarkdownCode) => string,
): string {
  let output = "";
  let copied = 0;
  for (const range of codeRanges(markdown)) {
    output +=
      markdown.slice(copied, range.start) +
      callback({
        raw: markdown.slice(range.start, range.end),
        content: markdown.slice(range.contentStart, range.contentEnd),
        kind: range.kind,
        ...(range.language === undefined ? {} : { language: range.language }),
      });
    copied = range.end;
  }
  return output + markdown.slice(copied);
}

/** Mask code without changing offsets or joining neighboring prose. */
function proseOnly(markdown: string): string {
  let output = "";
  let copied = 0;
  for (const { start, end } of codeRanges(markdown)) {
    output +=
      markdown.slice(copied, start) +
      markdown.slice(start, end).replace(/[^\r\n]/g, " ");
    copied = end;
  }
  return output + markdown.slice(copied);
}

function bracketEnd(text: string, opening: number): number {
  let depth = 1;
  for (let index = opening + 1; index < text.length; index++) {
    const character = text[index];
    if (character === "\r" || character === "\n") return -1;
    if (character === "\\") {
      index++;
    } else if (character === "[") {
      depth++;
    } else if (character === "]" && --depth === 0) {
      return index;
    }
  }
  return -1;
}

function inlineImageAt(
  markdown: string,
  prose: string,
  start: number,
): MarkdownImage | null {
  const altEnd = bracketEnd(prose, start + 1);
  if (altEnd < 0 || prose[altEnd + 1] !== "(") return null;
  let cursor = altEnd + 2;
  while (prose[cursor] === " " || prose[cursor] === "\t") cursor++;
  const angled = prose[cursor] === "<";
  if (angled) cursor++;
  const sourceStart = cursor;
  let depth = 0;
  while (cursor < prose.length) {
    const character = prose[cursor]!;
    if (character === "\\") {
      cursor += 2;
      continue;
    }
    if (character === "\n" || character === "\r") return null;
    if (angled) {
      if (character === ">") break;
      if (character === "<") return null;
    } else {
      if (character === "(") depth++;
      if (character === ")") {
        if (depth === 0) break;
        depth--;
      }
      if (/\s/.test(character)) break;
    }
    cursor++;
  }
  const sourceEnd = cursor;
  if (angled) {
    if (prose[cursor] !== ">") return null;
    cursor++;
  }
  const spaceStart = cursor;
  while (prose[cursor] === " " || prose[cursor] === "\t") cursor++;
  let title: string | undefined;
  if (cursor > spaceStart && (prose[cursor] === '"' || prose[cursor] === "'")) {
    const quote = prose[cursor++];
    const titleStart = cursor;
    while (cursor < prose.length && prose[cursor] !== quote) {
      if (prose[cursor] === "\n" || prose[cursor] === "\r") return null;
      cursor += prose[cursor] === "\\" ? 2 : 1;
    }
    if (prose[cursor] !== quote) return null;
    title = unescapeMarkdown(markdown.slice(titleStart, cursor));
    cursor++;
    while (prose[cursor] === " " || prose[cursor] === "\t") cursor++;
  }
  if (prose[cursor] !== ")") return null;
  return {
    raw: markdown.slice(start, cursor + 1),
    source: unescapeMarkdown(markdown.slice(sourceStart, sourceEnd)),
    alt: unescapeMarkdown(markdown.slice(start + 2, altEnd)),
    ...(title === undefined ? {} : { title }),
    sourceStart: sourceStart - start,
    sourceEnd: sourceEnd - start,
  };
}

export function mapMarkdownImages(
  markdown: string,
  callback: (image: MarkdownImage) => string,
): string {
  const prose = proseOnly(markdown);
  let output = "";
  let copied = 0;
  let cursor = 0;
  while ((cursor = prose.indexOf("![", cursor)) >= 0) {
    const image = isEscaped(markdown, cursor)
      ? null
      : inlineImageAt(markdown, prose, cursor);
    if (!image) {
      cursor += 2;
      continue;
    }
    output += markdown.slice(copied, cursor) + callback(image);
    cursor += image.raw.length;
    copied = cursor;
  }
  return output + markdown.slice(copied);
}

export function withMarkdownImageSource(
  image: MarkdownImage,
  source: string,
): string {
  return (
    image.raw.slice(0, image.sourceStart) +
    source +
    image.raw.slice(image.sourceEnd)
  );
}

function htmlAttributeValue(value: string): string {
  const entities: Record<string, string> = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    colon: ":",
    sol: "/",
    bsol: "\\",
    period: ".",
    quest: "?",
    equals: "=",
    num: "#",
    Tab: "\t",
    NewLine: "\n",
  };
  return value.replace(
    /&(#(?:x[\da-f]+|\d+);?|[a-z]+;)/gi,
    (entity, encodedName: string) => {
      const name = encodedName.replace(/;$/, "");
      if (name.startsWith("#")) {
        const number =
          name[1]?.toLowerCase() === "x"
            ? Number.parseInt(name.slice(2), 16)
            : Number.parseInt(name.slice(1), 10);
        return number > 0 && number <= 0x10ffff
          ? String.fromCodePoint(number)
          : "\ufffd";
      }
      return entities[name] ?? entity;
    },
  );
}

/** Unsupported image forms are inspected by the CMS boundary, never rewritten. */
export function findUnsupportedMarkdownImageSources(
  markdown: string,
): string[] {
  const prose = proseOnly(markdown);
  const sources: string[] = [];
  for (const tag of prose.matchAll(
    /<(?:img|source)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi,
  )) {
    if (isEscaped(markdown, tag.index)) continue;
    for (const attribute of tag[0].matchAll(
      /\s+([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gi,
    )) {
      if (!/^(?:src|srcset)$/i.test(attribute[1] ?? "")) continue;
      const value = htmlAttributeValue(
        attribute[2] ?? attribute[3] ?? attribute[4] ?? "",
      );
      if (attribute[1]?.toLowerCase() === "srcset") {
        for (const entry of value.split(",")) {
          const source = entry.trim().split(/\s+/)[0];
          if (source) sources.push(source);
        }
      } else {
        sources.push(value);
      }
    }
  }
  const label = (value: string) =>
    unescapeMarkdown(value).trim().replace(/\s+/g, " ").toLowerCase();
  const definitions = new Map<string, string>();
  for (const definition of prose.matchAll(
    /^ {0,3}\[([^\]\r\n]+)\]:[ \t]*(?:\r?\n[ \t]*)?(?:<([^>\r\n]*)>|(\S+))/gm,
  )) {
    const name = label(definition[1]!);
    if (!definitions.has(name))
      definitions.set(
        name,
        unescapeMarkdown(definition[2] ?? definition[3] ?? ""),
      );
  }
  let cursor = 0;
  while ((cursor = prose.indexOf("![", cursor)) >= 0) {
    const start = cursor;
    cursor += 2;
    if (isEscaped(markdown, start)) continue;
    const altEnd = bracketEnd(prose, start + 1);
    if (altEnd < 0 || prose[altEnd + 1] === "(") continue;
    let reference = prose.slice(start + 2, altEnd);
    if (prose[altEnd + 1] === "[") {
      const referenceEnd = bracketEnd(prose, altEnd + 1);
      if (referenceEnd < 0) continue;
      reference = prose.slice(altEnd + 2, referenceEnd) || reference;
      cursor = referenceEnd + 1;
    } else {
      cursor = altEnd + 1;
    }
    const source = definitions.get(label(reference));
    if (source !== undefined) sources.push(source);
  }
  return sources;
}
