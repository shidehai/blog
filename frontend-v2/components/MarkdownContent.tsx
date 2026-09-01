"use client";

import { useEffect, useRef } from "react";
import { slugify } from "../lib/markdown";

interface MarkdownContentProps {
  content: string;
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
    let html = raw;

    // 1. Code blocks (```lang ... ```)
    html = html.replace(
      /(?:```|~~~)([a-zA-Z0-9_-]*)(?:[^\n]*)\n([\s\S]*?)(?:```|~~~)/g,
      (_, lang, code) => {
        const language = lang.trim() || "text";
        const cleanCode = code.replace(/\n$/, "");
        const highlighted = highlightSyntax(cleanCode, language);

        return `<pre class="chroma" data-language="${language}" tabindex="0"><code>${highlighted}</code><button type="button" class="code-copy" aria-label="复制代码">复制</button></pre>`;
      },
    );

    // 2. Headings with IDs & permalinks
    html = html.replace(/^(#{2,4})\s+(.+)$/gm, (_, hashes, text) => {
      const level = hashes.length;
      const cleanText = text.trim();
      const id = slugify(cleanText);
      return `<h${level} id="${id}">${cleanText}</h${level}>`;
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

    // 6. Inline Code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

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

    return html;
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
