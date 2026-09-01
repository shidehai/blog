"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Post } from "../../../lib/types";
import { MarkdownContent } from "../../../components/MarkdownContent";

interface ArticleClientProps {
  post: Post;
  formattedDate: string;
  headings: { id: string; text: string; level: number }[];
  prevPost: Post | null;
  nextPost: Post | null;
  relatedPosts: Post[];
}

export function ArticleClient({
  post,
  formattedDate,
  headings,
  prevPost,
  nextPost,
  relatedPosts,
}: ArticleClientProps) {
  const [activeHeadingId, setActiveHeadingId] = useState<string>("");
  const [shareFeedback, setShareFeedback] = useState<string>("");
  const contentRef = useRef<HTMLDivElement>(null);

  // 1. Reading Progress Bar
  useEffect(() => {
    const progressBar = document.getElementById("reading-progress");

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress =
        docHeight > 0 ? Math.min(1, Math.max(0, scrollY / docHeight)) : 0;

      if (progressBar) {
        progressBar.style.transform = `scaleX(${progress})`;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (progressBar) {
        progressBar.style.transform = "scaleX(0)";
      }
    };
  }, [post]);

  // 2. TOC Scroll Spy using IntersectionObserver
  useEffect(() => {
    if (!contentRef.current || headings.length === 0) return;

    const headingElements = contentRef.current.querySelectorAll("h2, h3");
    if (headingElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((e) => e.isIntersecting);
        if (visibleEntries.length > 0) {
          setActiveHeadingId(visibleEntries[0]!.target.id);
        }
      },
      {
        rootMargin: "-80px 0px -60% 0px",
        threshold: 0.1,
      },
    );

    headingElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [headings]);

  // 3. Inject Code Block Copy Buttons
  useEffect(() => {
    if (!contentRef.current) return;

    const pres = contentRef.current.querySelectorAll("pre");
    pres.forEach((pre) => {
      // Check if button already exists
      if (pre.querySelector(".code-copy")) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "code-copy";
      btn.textContent = "复制";
      btn.setAttribute("aria-label", "复制完整代码");

      btn.addEventListener("click", async () => {
        const codeText = pre.querySelector("code")?.innerText || pre.innerText;
        try {
          await navigator.clipboard.writeText(
            codeText.replace("复制", "").trim(),
          );
          btn.textContent = "已复制 ✓";
          btn.classList.add("copied");
          setTimeout(() => {
            btn.textContent = "复制";
            btn.classList.remove("copied");
          }, 2000);
        } catch {
          btn.textContent = "复制失败";
        }
      });

      pre.style.position = "relative";
      pre.appendChild(btn);
    });
  }, [post.content]);

  // 4. Share button action
  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShareFeedback("文章链接已复制到剪贴板！");
      setTimeout(() => setShareFeedback(""), 2500);
    } catch {
      setShareFeedback(url);
    }
  };

  return (
    <div className="layout post-layout">
      {/* 1. Main Content Stream */}
      <main className="main-content" id="main-content">
        {/* Breadcrumb Navigation */}
        <nav className="breadcrumbs" aria-label="面包屑导航">
          <Link href="/">首页</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/categories?cat=${encodeURIComponent(post.category)}`}>
            {post.category}
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{post.title}</span>
        </nav>

        {/* Post Article */}
        <article className="glass post-article">
          {post.cover && (
            <img
              className="post-cover"
              src={post.cover}
              alt=""
              width={1440}
              height={810}
            />
          )}

          <div className="post-header">
            <div className="post-meta">
              <span>
                <svg
                  className="ui-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                {formattedDate}
              </span>
              <span>
                <svg
                  className="ui-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
                {post.category}
              </span>
              <span className="read-time">
                <svg
                  className="ui-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                {post.readingMinutes * 300 || 1200} 字 · 约{" "}
                {post.readingMinutes} 分钟
              </span>
            </div>

            <h1>{post.title}</h1>

            <div className="tags">
              {post.tags.map((t) => (
                <Link
                  key={t}
                  href={`/tags?tag=${encodeURIComponent(t)}`}
                  className="tag"
                >
                  {t}
                  <span className="sr-only"> 标签文章</span>
                </Link>
              ))}
            </div>

            <div className="post-updated">最后更新：{formattedDate}</div>

            {post.series && (
              <div className="post-series">
                所属系列：
                <Link href={`/series/${post.series.slug}`}>
                  {post.series.name}
                </Link>
                {post.series.order && ` · 第 ${post.series.order} 篇`}
              </div>
            )}
          </div>

          {/* Article Markdown Body */}
          <div ref={contentRef} className="article-content">
            <MarkdownContent content={post.content} />
          </div>

          {/* Footer Post Actions */}
          <footer className="post-actions" aria-label="文章操作">
            <button
              type="button"
              onClick={handleShare}
              className={`post-action ${shareFeedback ? "is-success" : ""}`}
            >
              <svg
                className="ui-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
              </svg>
              <span>{shareFeedback || "分享文章"}</span>
            </button>
            <Link className="post-action" href="/feed.xml">
              <svg
                className="ui-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
                <circle cx="5" cy="19" r="1" />
              </svg>
              <span>订阅 RSS</span>
            </Link>
            <a
              className="post-action"
              href="https://github.com/wildalley"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg
                className="ui-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
              </svg>
              <span>报告问题</span>
            </a>
          </footer>
        </article>

        {/* Previous / Next Article Navigation */}
        <nav className="post-nav">
          {prevPost ? (
            <Link href={`/writing/${prevPost.slug}`} className="glass">
              <span className="pn-label">
                <svg
                  className="ui-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m12 19-7-7 7-7M19 12H5" />
                </svg>{" "}
                上一篇
              </span>
              <span className="pn-title">{prevPost.title}</span>
            </Link>
          ) : (
            <div />
          )}

          {nextPost && (
            <Link href={`/writing/${nextPost.slug}`} className="glass pn-next">
              <span className="pn-label">
                下一篇{" "}
                <svg
                  className="ui-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
              <span className="pn-title">{nextPost.title}</span>
            </Link>
          )}
        </nav>

        {/* Related Articles - Rich Grid Cards */}
        {relatedPosts.length > 0 && (
          <section className="related-section" aria-label="延伸阅读与相关推荐">
            <div className="related-section-header">
              <div className="related-section-title">
                <svg
                  className="ui-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8Z" />
                  <circle cx="7.5" cy="7.5" r=".5" />
                </svg>
                <h3>延伸阅读 · 相关推荐</h3>
              </div>
              <span className="related-section-sub">
                与当前话题相关的深度探讨与工程实践
              </span>
            </div>

            <div className="related-grid">
              {relatedPosts.map((rp) => (
                <Link
                  key={rp.id}
                  href={`/writing/${rp.slug}`}
                  className="glass related-card"
                >
                  {rp.cover && (
                    <div className="related-card-cover-wrap">
                      <img
                        src={rp.cover}
                        alt=""
                        width={400}
                        height={225}
                        loading="lazy"
                        className="related-card-cover"
                      />
                      {rp.category && (
                        <span className="related-card-badge">
                          {rp.category}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="related-card-body">
                    <h4 className="related-card-title">{rp.title}</h4>
                    <p className="related-card-desc">{rp.summary}</p>

                    <div className="related-card-footer">
                      <span className="related-card-meta">
                        {rp.readingMinutes
                          ? `约 ${rp.readingMinutes} 分钟阅读`
                          : rp.publishedAt?.slice(0, 10) || "推荐阅读"}
                      </span>
                      <span className="related-card-arrow">
                        阅读全文
                        <svg
                          className="ui-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* 2. Right TOC Sidebar with Scroll Spy */}
      <aside className="side-right toc-sidebar">
        <nav className="glass toc-card" aria-label="文章目录">
          <h4>目录</h4>
          <ul className="toc-list">
            {headings.length > 0 ? (
              headings.map((h) => {
                const isActive = activeHeadingId === h.id;
                return (
                  <li key={h.id} className={h.level === 3 ? "toc-h3" : ""}>
                    <a
                      href={`#${h.id}`}
                      className={isActive ? "active" : ""}
                      onClick={(e) => {
                        e.preventDefault();
                        const target = document.getElementById(h.id);
                        if (target) {
                          target.scrollIntoView({ behavior: "smooth" });
                          setActiveHeadingId(h.id);
                        }
                      }}
                    >
                      {h.text}
                    </a>
                  </li>
                );
              })
            ) : (
              <li>
                <a href="#main-content" className="active">
                  正文
                </a>
              </li>
            )}
          </ul>
        </nav>
      </aside>
    </div>
  );
}
