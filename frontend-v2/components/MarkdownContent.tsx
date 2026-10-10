"use client";

import React, { useEffect, useRef } from "react";
import { slugify } from "../lib/markdown";
import { mapMarkdownCode, mapMarkdownImages } from "../lib/markdown-images";

interface MarkdownContentProps {
  content: string;
}

function escapeImageAttribute(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

function safeImageSource(source: string): boolean {
  if (!source.trim()) return false;
  if (
    source.includes("\\") ||
    [...source].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return false;
  if (source.startsWith("/")) return !source.startsWith("//");
  try {
    if (/^https?:\/\//i.test(source)) {
      const url = new URL(source);
      return Boolean(url.hostname) && !url.username && !url.password;
    }
    if (/^[a-z][a-z\d+.-]*:/i.test(source)) return false;
    return (
      new URL(source, "https://markdown-local.invalid/").origin ===
      "https://markdown-local.invalid"
    );
  } catch {
    return false;
  }
}

// Simple deterministic syntax highlighter for common languages
function highlightSyntax(rawCode: string, lang: string): string {
  const language = lang.toLowerCase();

  // Normalize excessive blank lines and trim edges
  const normalized = rawCode
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = normalized.split("\n");

  return lines
    .map((line) => {
      let escaped = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      if (
        [
          "go",
          "golang",
          "js",
          "javascript",
          "ts",
          "typescript",
          "py",
          "python",
          "json",
          "sql",
          "bash",
          "sh",
          "yaml",
          "yml",
        ].includes(language)
      ) {
        // Comments
        escaped = escaped.replace(
          /(\/\/.*$|#.*$|\/\*[\s\S]*?\*\/)/g,
          '<span class="token-comment">$1</span>',
        );

        // Strings (double quotes, single quotes, backticks)
        escaped = escaped.replace(
          /(&quot;.*?&quot;|&#39;.*?&#39;|`.*?`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g,
          '<span class="token-string">$1</span>',
        );

        // Keywords
        escaped = escaped.replace(
          /\b(package|import|func|type|struct|interface|return|var|const|if|else|for|range|switch|case|default|select|go|defer|chan|map|make|new|nil|true|false|function|let|async|await|class|def|from|try|except|finally|SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|JOIN|GROUP|BY|ORDER|LIMIT)\b/g,
          '<span class="token-keyword">$1</span>',
        );

        // Types
        escaped = escaped.replace(
          /\b(string|int|int32|int64|float32|float64|bool|byte|rune|error|any|uint|uint32|uint64|Context|Handler|Response|Request|Promise|Array|Record|Object|number|boolean|void)\b/g,
          '<span class="token-type">$1</span>',
        );

        // Numbers
        escaped = escaped.replace(
          /\b(\d+(?:\.\d+)?)\b/g,
          '<span class="token-number">$1</span>',
        );

        // Function Calls
        escaped = escaped.replace(
          /\b([a-zA-Z_]\w*)(?=\s*\()/g,
          '<span class="token-func">$1</span>',
        );
      }

      return `<span class="line">${escaped || "&nbsp;"}</span>`;
    })
    .join("");
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const parseMarkdownToHtml = (raw: string): string => {
    let imagePrefix = "\u0000markdown-image-";
    while (raw.includes(imagePrefix)) imagePrefix += "x";
    const images: string[] = [];
    const originalMarkdown: string[] = [];
    const protect = (markup: string, original: string): string => {
      const placeholder = `${imagePrefix}${images.length}\u0000`;
      images.push(markup);
      originalMarkdown.push(original);
      return placeholder;
    };
    const placeholderPattern = new RegExp(`${imagePrefix}(\\d+)\u0000`, "g");
    let html = mapMarkdownImages(raw, (image) => {
      const escapedAlt = escapeImageAttribute(image.alt);
      const markup = safeImageSource(image.source)
        ? `<img src="${escapeImageAttribute(image.source)}" alt="${escapedAlt}"${image.title === undefined ? "" : ` title="${escapeImageAttribute(image.title)}"`} loading="lazy" decoding="async" style="max-width:100%;height:auto">`
        : escapedAlt;
      return protect(markup, image.raw);
    });

    // 1. Protect the exact fenced/inline code ranges skipped by image collection.
    html = mapMarkdownCode(html, (code) => {
      if (code.kind === "fenced") {
        const language = code.language || "text";
        const cleanCode = code.content.replace(/\n$/, "");
        const highlighted = highlightSyntax(cleanCode, language);

        return `<pre class="chroma" data-language="${language}" tabindex="0">${protect(`<code>${highlighted}</code><button type="button" class="code-copy" aria-label="复制代码">复制</button>`, code.raw)}</pre>${code.raw.endsWith("\n") ? "\n" : ""}`;
      }
      return protect(
        `<code>${escapeImageAttribute(code.content)}</code>`,
        code.raw,
      );
    });
    // Escaped raw HTML is a literal, matching the scanner's exclusion rule.
    html = html.replace(/(\\+)</g, (match: string, slashes: string) =>
      slashes.length % 2 ? `${slashes.slice(0, -1)}&lt;` : match,
    );

    // 2. Headings with IDs & permalinks
    let headingIndex = 0;
    html = html.replace(/^(#{2,4})\s+(.+)$/gm, (_, hashes, text) => {
      const level = hashes.length;
      // 算法对齐 extractHeadings：剥链接、slugify、空值兜底
      const originalText = text.replace(
        placeholderPattern,
        (_: string, index: string) => originalMarkdown[Number(index)]!,
      );
      const rawText = originalText.replace(/\[(.*?)\]\(.*?\)/g, "$1").trim();
      const id = slugify(rawText) || `heading-${headingIndex}`;
      headingIndex++;
      return `<h${level} id="${id}">${text.trim()}</h${level}>`;
    });

    // 3. GitHub Callout Alerts
    html = html.replace(
      /^>\s*\[!NOTE\]\s*\n((?:>.*\n?)*)/gm,
      '<blockquote class="alert-box alert-note"><strong>💡 提示说明</strong><p>$1</p></blockquote>',
    );
    html = html.replace(
      /^>\s*\[!TIP\]\s*\n((?:>.*\n?)*)/gm,
      '<blockquote class="alert-box alert-tip"><strong>✨ 最佳实践</strong><p>$1</p></blockquote>',
    );
    html = html.replace(
      /^>\s*\[!IMPORTANT\]\s*\n((?:>.*\n?)*)/gm,
      '<blockquote class="alert-box alert-important"><strong>⚠️ 重要原则</strong><p>$1</p></blockquote>',
    );
    html = html.replace(
      /^>\s*\[!WARNING\]\s*\n((?:>.*\n?)*)/gm,
      '<blockquote class="alert-box alert-warning"><strong>🚨 避坑警告</strong><p>$1</p></blockquote>',
    );

    // 4. Blockquotes
    html = html.replace(/^>\s*(.+)$/gm, "<blockquote><p>$1</p></blockquote>");

    // 5. Bold & Italic
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // 7. Lists
    html = html.replace(/^\s*[-*+]\s+(.+)$/gm, "<li>$1</li>");
    html = html.replace(/^\s*(\d+)\.\s+(.+)$/gm, "<li>$2</li>");

    // Wrap list items
    html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, "<ul>$&</ul>");

    // 8. Tables
    html = html.replace(
      /\|(.+)\|\n\|(?:\s*[-:]+[-| :]*)\|\n((?:\|.+\|\n?)+)/g,
      (_, headerRow, bodyRows) => {
        const headers = headerRow
          .split("|")
          .map((h: string) => h.trim())
          .filter(Boolean);
        const rows = bodyRows
          .trim()
          .split("\n")
          .map((row: string) =>
            row
              .split("|")
              .map((c: string) => c.trim())
              .filter(Boolean),
          );

        const thead = `<thead><tr>${headers
          .map((h: string) => `<th>${h}</th>`)
          .join("")}</tr></thead>`;
        const tbody = `<tbody>${rows
          .map(
            (row: string[]) =>
              `<tr>${row.map((cell: string) => `<td>${cell}</td>`).join("")}</tr>`,
          )
          .join("")}</tbody>`;

        return `<div class="table-scroll"><table class="article-table">${thead}${tbody}</table></div>`;
      },
    );

    // 9. Paragraphs
    html = html
      .split("\n\n")
      .map((block) => {
        const trimmed = block.trim();
        if (
          !trimmed ||
          trimmed.startsWith("<h") ||
          trimmed.startsWith("<div") ||
          trimmed.startsWith("<blockquote") ||
          trimmed.startsWith("<pre") ||
          trimmed.startsWith("<ul") ||
          trimmed.startsWith("<ol") ||
          trimmed.startsWith("<table")
        ) {
          return trimmed;
        }
        return `<p>${trimmed}</p>`;
      })
      .join("\n");

    // Restore protected HTML last so Markdown cannot modify image attributes or code.
    return html.replace(
      placeholderPattern,
      (_, index: string) => images[Number(index)]!,
    );
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Attach copy click handlers to all .code-copy buttons
    const buttons = containerRef.current.querySelectorAll(".code-copy");
    buttons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const pre = btn.closest("pre");
        if (pre) {
          const code = pre.querySelector("code");
          const text = code ? code.innerText : pre.innerText;
          try {
            await navigator.clipboard.writeText(text);
            btn.textContent = "已复制 ✓";
            btn.classList.add("copied");
            setTimeout(() => {
              btn.textContent = "复制";
              btn.classList.remove("copied");
            }, 2000);
          } catch {
            btn.textContent = "复制失败";
          }
        }
      });
    });
  }, [content]);

  return (
    <div
      ref={containerRef}
      className="article-content-body"
      dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(content) }}
    />
  );
}
