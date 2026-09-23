"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { MarkdownContent } from "../../../components/MarkdownContent";
import type { HeadingItem, Post } from "../../../lib/types";

interface ArticleClientProps {
  post: Post;
  formattedDate: string;
  headings: HeadingItem[];
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
  const [activeHeadingId, setActiveHeadingId] = useState("");
  const [shareFeedback, setShareFeedback] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const progressBar = document.getElementById("reading-progress");
    const updateProgress = () => {
      const scrollableHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress =
        scrollableHeight > 0
          ? Math.min(1, Math.max(0, window.scrollY / scrollableHeight))
          : 0;

      if (progressBar) progressBar.style.transform = `scaleX(${progress})`;
    };

    window.addEventListener("scroll", updateProgress, { passive: true });
    updateProgress();
    return () => {
      window.removeEventListener("scroll", updateProgress);
      if (progressBar) progressBar.style.transform = "scaleX(0)";
    };
  }, [post.id]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container || headings.length === 0) return;

    const headingElements = container.querySelectorAll("h2, h3, h4");
    if (headingElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActiveHeadingId(visible.target.id);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 },
    );
    headingElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [headings]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShareFeedback("文章链接已复制到剪贴板！");
    } catch {
      setShareFeedback(url);
    }
    window.setTimeout(() => setShareFeedback(""), 2500);
  };

  return (
    <div className="layout post-layout">
      <main className="main-content" id="main-content">
        <nav className="breadcrumbs" aria-label="面包屑导航">
          <Link href="/">首页</Link>
          <span aria-hidden="true">/</span>
          <Link href="/categories">{post.category}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{post.title}</span>
        </nav>

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

          <header className="post-header">
            <div className="post-meta">
              <span>{formattedDate}</span>
              <span>{post.category}</span>
              <span className="read-time">
                {post.wordCount} 字 · 约 {post.readingMinutes} 分钟
              </span>
            </div>

            <h1>{post.title}</h1>

            {post.tags.length > 0 && (
              <div className="tags" aria-label="文章标签">
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/tags?tag=${encodeURIComponent(tag)}`}
                    className="tag"
                  >
                    {tag}
                    <span className="sr-only"> 标签文章</span>
                  </Link>
                ))}
              </div>
            )}

            <p className="post-updated">
              最后更新：{post.updatedAt?.slice(0, 10) ?? formattedDate}
            </p>

            {post.series && (
              <p className="post-series">
                所属系列：{" "}
                <Link href={`/series/${post.series.slug}`}>
                  {post.series.name}
                </Link>
                {post.series.order ? ` · 第 ${post.series.order} 篇` : ""}
              </p>
            )}
          </header>

          <div ref={contentRef} className="article-content">
            <MarkdownContent content={post.content} />
          </div>

          <footer className="post-actions" aria-label="文章操作">
            <button
              type="button"
              onClick={handleShare}
              className={`post-action ${shareFeedback ? "is-success" : ""}`}
            >
              <span>{shareFeedback || "复制文章链接"}</span>
            </button>
            <a
              className="post-action"
              href="https://github.com/wildalley"
              target="_blank"
              rel="noopener noreferrer"
            >
              报告问题
            </a>
          </footer>
        </article>

        <nav className="post-nav" aria-label="相邻文章">
          {prevPost ? (
            <Link href={`/archives/${prevPost.slug}`} className="glass">
              <span className="pn-label">← 上一篇</span>
              <span className="pn-title">{prevPost.title}</span>
            </Link>
          ) : (
            <div />
          )}
          {nextPost && (
            <Link href={`/archives/${nextPost.slug}`} className="glass pn-next">
              <span className="pn-label">下一篇 →</span>
              <span className="pn-title">{nextPost.title}</span>
            </Link>
          )}
        </nav>

        {relatedPosts.length > 0 && (
          <section className="related-section" aria-label="延伸阅读与相关推荐">
            <header className="related-section-header">
              <div className="related-section-title">
                <h2>延伸阅读 · 相关推荐</h2>
              </div>
              <span className="related-section-sub">
                与当前话题相关的深度探讨与工程实践
              </span>
            </header>

            <div className="related-grid">
              {relatedPosts.map((relatedPost) => (
                <Link
                  key={relatedPost.id}
                  href={`/archives/${relatedPost.slug}`}
                  className="glass related-card"
                >
                  {relatedPost.cover && (
                    <div className="related-card-cover-wrap">
                      <img
                        src={relatedPost.cover}
                        alt=""
                        width={400}
                        height={225}
                        loading="lazy"
                        className="related-card-cover"
                      />
                      <span className="related-card-badge">
                        {relatedPost.category}
                      </span>
                    </div>
                  )}

                  <div className="related-card-body">
                    <h3 className="related-card-title">{relatedPost.title}</h3>
                    <p className="related-card-desc">{relatedPost.summary}</p>
                    <footer className="related-card-footer">
                      <span className="related-card-meta">
                        约 {relatedPost.readingMinutes} 分钟阅读
                      </span>
                      <span className="related-card-arrow">阅读全文 →</span>
                    </footer>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <aside className="side-right toc-sidebar">
        <nav className="glass toc-card" aria-label="文章目录">
          <h2>目录</h2>
          <ul className="toc-list">
            {headings.length > 0 ? (
              headings.map((heading) => {
                const isActive = activeHeadingId === heading.id;
                return (
                  <li
                    key={heading.id}
                    className={heading.level >= 3 ? "toc-h3" : undefined}
                  >
                    <a
                      href={`#${heading.id}`}
                      className={isActive ? "active" : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        document
                          .getElementById(heading.id)
                          ?.scrollIntoView({ behavior: "smooth" });
                        setActiveHeadingId(heading.id);
                      }}
                    >
                      {heading.text}
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
