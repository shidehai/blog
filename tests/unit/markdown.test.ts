import { describe, expect, it } from "vitest";

import {
  deriveReadingMinutes,
  extractDirectusMediaIds,
  parseCodeMetadata,
  parseDirectusMediaId,
  renderMarkdown,
  type MarkdownMedia,
} from "../../src/lib/markdown";

const FIRST_MEDIA_ID = "550e8400-e29b-41d4-a716-446655440000";
const SECOND_MEDIA_ID = "550e8400-e29b-41d4-a716-446655440001";

function media(id: string, src: string): MarkdownMedia {
  return {
    height: 675,
    id,
    mimeType: "image/webp",
    src,
    srcset: `${src} 800w, ${src} 1200w`,
    width: 1200,
  };
}

describe("Markdown derivation", () => {
  it("combines Chinese characters and Latin words for reading time", () => {
    const chinese = "文".repeat(300);
    const latin = Array.from({ length: 200 }, () => "word").join(" ");

    expect(deriveReadingMinutes(`${chinese}\n\n${latin}`)).toBe(2);
  });

  it("creates stable collision-safe IDs for duplicate headings", async () => {
    const markdown = "## 重复 Heading\n\n### 子标题\n\n## 重复 Heading";
    const first = await renderMarkdown(markdown);
    const second = await renderMarkdown(markdown);

    expect(first.outline).toEqual([
      { id: "重复-heading", level: 2, text: "重复 Heading" },
      { id: "子标题", level: 3, text: "子标题" },
      { id: "重复-heading-1", level: 2, text: "重复 Heading" },
    ]);
    expect(second.headings).toEqual(first.headings);
    expect(second.html).toBe(first.html);
  });

  it("reserves the page heading for the post title", async () => {
    await expect(
      renderMarkdown("# Duplicate page title", { source: "post.md" }),
    ).rejects.toThrow(
      "post.md line 1: body headings must start at level 2; the post title is the page heading",
    );
  });
});

describe("Markdown extensions", () => {
  it("renders GFM tables, task lists, and accessible footnotes", async () => {
    const result = await renderMarkdown(`| 项目 | 状态 |
| --- | --- |
| 测试 | 完成 |

- [x] 已发布
- [ ] 待校对

正文脚注[^source]。

[^source]: 来源说明。`);

    expect(result.html).toContain('class="table-wrapper"');
    expect(result.html).toContain('role="region"');
    expect(result.html).toContain("<table>");
    expect(result.html).toContain('class="contains-task-list"');
    expect(result.html).toContain('type="checkbox" checked disabled');
    expect(result.html).toContain('aria-label="已完成"');
    expect(result.html).toContain('aria-label="未完成"');
    expect(result.html).toContain("data-footnote-ref");
    expect(result.html).toContain('aria-describedby="footnote-label"');
    expect(result.html).toContain('id="footnote-label"');
    expect(result.html).toContain('class="footnotes"');
    expect(result.headings).toEqual([]);
    expect(result.outline).toEqual([]);
  });

  it.each([
    ["NOTE", "note", "说明"],
    ["IMPORTANT", "important", "重点"],
    ["WARNING", "warning", "注意"],
  ])("renders %s callouts", async (marker, type, label) => {
    const result = await renderMarkdown(`> [!${marker}]\n> 正文 **加粗**`);

    expect(result.html).toContain(`class="callout callout--${type}"`);
    expect(result.html).toContain(`aria-label="${label}"`);
    expect(result.html).toContain(
      `<strong class="annotation-label">${label}</strong>`,
    );
    expect(result.html).toContain("正文 <strong>加粗</strong>");
    expect(result.html).not.toContain(`[!${marker}]`);
  });

  it("rejects unsupported callout markers", async () => {
    await expect(
      renderMarkdown("> [!TIP]\n> 正文", { source: "post.md" }),
    ).rejects.toThrow('post.md: unsupported callout type "TIP"');
  });
});

describe("fenced code metadata", () => {
  it("parses and renders filename, highlighted lines, and diff state", async () => {
    const metadata = parseCodeMetadata('filename="demo.ts" {1,3-4} diff', 4);

    expect(metadata.filename).toBe("demo.ts");
    expect(metadata.diff).toBe(true);
    expect([...metadata.highlightedLines]).toEqual([1, 3, 4]);

    const result =
      await renderMarkdown(`\`\`\`ts filename="demo.ts" {1,3-4} diff
+const current = true;
-const legacy = true;
const unchanged = true;
console.log(current);
\`\`\``);

    expect(result.html).toContain('class="code-frame"');
    expect(result.html).toContain("demo.ts");
    expect(result.html).toContain('class="code-copy control--raised"');
    expect(result.html).toMatch(
      /class="[^"]*is-highlighted[^"]*diff-add[^"]*"/,
    );
    expect(result.html).toMatch(/class="[^"]*diff-remove[^"]*"/);
  });

  it("rejects malformed metadata", () => {
    expect(() => parseCodeMetadata("filename=demo.ts", 1)).toThrow(
      'invalid code metadata "filename=demo.ts"',
    );
    expect(() => parseCodeMetadata("diff diff", 1)).toThrow(
      "code diff metadata is duplicated",
    );
  });

  it("rejects highlighted lines outside the block with a source location", async () => {
    await expect(
      renderMarkdown("```ts {2}\nconst value = 1;\n```", {
        source: "posts/example.md",
      }),
    ).rejects.toThrow(
      'posts/example.md line 1: highlighted line range "2" is outside this 1-line block',
    );
  });
});

describe("Directus images", () => {
  it("normalizes, deduplicates, resolves, and renders Directus file IDs", async () => {
    const markdown = `![封面](directus://${FIRST_MEDIA_ID.toUpperCase()} "封面说明")

![图表](/assets/${SECOND_MEDIA_ID})

正文 ![重复](/assets/${FIRST_MEDIA_ID}) 后文`;
    const ids = extractDirectusMediaIds(markdown);
    const result = await renderMarkdown(markdown, {
      media: new Map([
        [FIRST_MEDIA_ID, media(FIRST_MEDIA_ID, "/media/first.webp")],
        [SECOND_MEDIA_ID, media(SECOND_MEDIA_ID, "/media/second.webp")],
      ]),
    });

    expect(
      parseDirectusMediaId(`directus://${FIRST_MEDIA_ID.toUpperCase()}`),
    ).toBe(FIRST_MEDIA_ID);
    expect(ids).toEqual([FIRST_MEDIA_ID, SECOND_MEDIA_ID]);
    expect(result.mediaIds).toEqual(ids);
    expect(result.html).toContain(`data-media-id="${FIRST_MEDIA_ID}"`);
    expect(result.html).toContain('src="/media/first.webp"');
    expect(result.html).toContain('width="1200"');
    expect(result.html).toContain('height="675"');
    expect(result.html).toContain("<figcaption>封面说明</figcaption>");
    expect(result.html).toMatch(
      new RegExp(
        `<p>正文 <img [^>]*data-media-id="${FIRST_MEDIA_ID}"[^>]*> 后文</p>`,
      ),
    );
    expect(result.html).not.toContain("<p><figure");
  });

  it("requires useful alternative text", () => {
    expect(() =>
      extractDirectusMediaIds(`![](directus://${FIRST_MEDIA_ID})`, "post.md"),
    ).toThrow(
      `post.md line 1: image ${FIRST_MEDIA_ID} requires alternative text`,
    );
  });

  it("rejects non-Directus image URLs", () => {
    expect(() =>
      extractDirectusMediaIds(
        "![远程](https://example.com/image.jpg)",
        "post.md",
      ),
    ).toThrow("post.md line 1: image");
  });
});

describe("link and HTML safety", () => {
  it("marks external HTTP links safely and leaves local links in place", async () => {
    const result = await renderMarkdown(`[外部](https://example.com/path)

[站内](/writing/example/)

[邮件](mailto:author@example.com)

[段落](#part)`);

    expect(result.html).toContain(
      '<a href="https://example.com/path" target="_blank" rel="noopener noreferrer">外部</a>',
    );
    expect(result.html).toContain('<a href="/writing/example/">站内</a>');
    expect(result.html).toContain(
      '<a href="mailto:author@example.com">邮件</a>',
    );
    expect(result.links.map(({ href }) => href)).toEqual([
      "https://example.com/path",
      "/writing/example/",
      "mailto:author@example.com",
      "#part",
    ]);
  });

  it.each([
    "javascript:alert%281%29",
    "data:text/html,boom",
    "//example.com/path",
  ])("rejects unsafe URL %s", async (href) => {
    await expect(
      renderMarkdown(`[危险](${href})`, { source: "post.md" }),
    ).rejects.toThrow("post.md line 1");
  });

  it("does not pass authored raw HTML through to output", async () => {
    const result = await renderMarkdown(`<script>alert("unsafe")</script>

<a href="javascript:alert(1)" onclick="alert(1)">raw link</a>

**safe Markdown**`);

    expect(result.html).not.toContain("<script");
    expect(result.html).not.toContain("<a href");
    expect(result.html).not.toContain("onclick");
    expect(result.html).toContain("<strong>safe Markdown</strong>");
  });
});

describe("heading permalink anchors and code block ergonomics", () => {
  it("injects heading anchor links for h2 and h3", async () => {
    const result = await renderMarkdown("## 架构设计\n\n### 模块划分");
    expect(result.html).toContain('data-heading-anchor href="#架构设计"');
    expect(result.html).toContain('data-heading-anchor href="#模块划分"');
    expect(result.html.match(/data-heading-anchor-feedback/g)).toHaveLength(2);
  });

  it("renders language badge and code metadata", async () => {
    const result = await renderMarkdown(
      "```typescript\nconst x: number = 42;\n```",
    );
    expect(result.html).toContain('data-code-language="typescript"');
    expect(result.html).toContain('class="code-lang-badge"');
    expect(result.html).toContain("TYPESCRIPT");
    expect(result.html).not.toContain('class="code-frame-title"');
  });

  it("marks code blocks exceeding 35 lines as collapsible", async () => {
    const longCode = Array.from(
      { length: 40 },
      (_, i) => `const line${i} = ${i};`,
    ).join("\n");
    const result = await renderMarkdown("```typescript\n" + longCode + "\n```");
    expect(result.html).toContain("code-frame--collapsible");
    expect(result.html).toContain('data-collapsible="true"');
    expect(result.html).toContain("展开全部 (40 行)");
    expect(result.html).toContain('aria-controls="code-block-1"');
    expect(result.html).toContain('aria-expanded="true"');
    expect(result.html).not.toContain("is-collapsed");
  });
});

describe("mermaid static diagram rendering", () => {
  it("compiles flowchart into static SVG element without client runtime", async () => {
    const mermaidCode = `\`\`\`mermaid
flowchart BT
    subgraph Pipeline[处理链路]
        direction RL
        A[输入请求] -->|校验通过| B[参数校验] --> C[模型推理]
    end
\`\`\``;
    const result = await renderMarkdown(mermaidCode);
    expect(result.html).toContain('class="mermaid-diagram surface--inset"');
    expect(result.html).toContain("<svg");
    expect(result.html).toContain("输入请求");
    expect(result.html).toContain("参数校验");
    expect(result.html).toContain("模型推理");
    expect(result.html).toContain("校验通过");
    expect(result.html).toContain("处理链路");
    expect(result.html).toContain('role="img"');
    expect(result.html).not.toContain("<script");
    expect(result.html).not.toContain("@import");
    expect(result.html).not.toContain("fonts.googleapis.com");
  });

  it("compiles sequence diagram into static SVG element", async () => {
    const seqCode = `\`\`\`mermaid
sequenceDiagram
    participant U as User
    participant S as Server
    loop Retry
        U->>S: HTTP Request
        Note right of S: Validate
        alt success
            S-->>U: HTTP Response
        else failure
            S-->>U: HTTP Error
        end
    end
\`\`\``;
    const result = await renderMarkdown(seqCode);
    expect(result.html).toContain('class="mermaid-diagram surface--inset"');
    expect(result.html).toContain("HTTP Request");
    expect(result.html).toContain("HTTP Response");
    expect(result.html).toContain("User");
    expect(result.html).toContain("Server");
    expect(result.html).toContain("Retry");
    expect(result.html).toContain("Validate");
    expect(result.html).toContain("failure");
  });

  it("rejects malformed Mermaid with source context", async () => {
    await expect(
      renderMarkdown("```mermaid\nflowchart LR\nA -->\n```", {
        source: "diagram fixture",
      }),
    ).rejects.toThrow(
      /diagram fixture line 1: could not render Mermaid diagram/,
    );
  });

  it("rejects malformed sequence connectors instead of dropping them", async () => {
    await expect(
      renderMarkdown("```mermaid\nsequenceDiagram\nA->>\n```", {
        source: "sequence fixture",
      }),
    ).rejects.toThrow(
      /sequence fixture line 1: could not render Mermaid diagram/,
    );
  });

  it("rejects remote paint resources from Mermaid style directives", async () => {
    await expect(
      renderMarkdown(
        "```mermaid\nflowchart LR\nA[One] --> B[Two]\nstyle A fill:url(https://example.com/paint)\n```",
        { source: "styled diagram" },
      ),
    ).rejects.toThrow(
      /styled diagram line 1: could not render Mermaid diagram/,
    );
  });
});
