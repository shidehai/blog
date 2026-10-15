"use client";
import React, { useMemo, useState } from "react";
import { renderMarkdown } from "./index";

export function MarkdownContent({
  content,
  mediaBase = "/media",
}: {
  content: string;
  mediaBase?: string;
}) {
  const html = useMemo(
    () => renderMarkdown(content, mediaBase).html,
    [content, mediaBase],
  );
  const [message, setMessage] = useState("");
  return (
    <div className="markdown-surface">
      <div
        className="article-content-body"
        onClick={async (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          if (!target.closest(".code-copy")) return;
          const code = target.closest("pre")?.querySelector("code");
          if (code) {
            try {
              await navigator.clipboard.writeText(code.textContent ?? "");
              setMessage("代码已复制");
            } catch {
              setMessage("复制失败，请手动选择代码");
            }
          }
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <span className="markdown-feedback" role="status">
        {message}
      </span>
    </div>
  );
}
