"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Post, Topic } from "../../lib/types";

interface WritingListClientProps {
  posts: Post[];
  topics: Topic[];
}

export function WritingListClient({ posts, topics }: WritingListClientProps) {
  const [selectedTag, setSelectedTag] = useState<string>("all");

  const filteredPosts = useMemo(() => {
    if (selectedTag === "all") return posts;
    return posts.filter((p) => p.tags.includes(selectedTag));
  }, [posts, selectedTag]);

  return (
    <div className="space-y-8">
      {/* Tag Filters */}
      <div className="flex flex-wrap items-center gap-1.5 pb-2">
        <button
          onClick={() => setSelectedTag("all")}
          className={`px-3 py-1 text-xs rounded-md transition-all font-medium ${
            selectedTag === "all"
              ? "bg-[var(--text-primary)] text-[var(--bg-card)]"
              : "bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--text-primary)]"
          }`}
        >
          全部 ({posts.length})
        </button>
        {topics.map((topic) => {
          const count = posts.filter((p) => p.tags.includes(topic.name)).length;
          if (count === 0) return null;
          return (
            <button
              key={topic.id}
              onClick={() => setSelectedTag(topic.name)}
              className={`px-3 py-1 text-xs rounded-md transition-all font-medium ${
                selectedTag === topic.name
                  ? "bg-[var(--text-primary)] text-[var(--bg-card)]"
                  : "bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--text-primary)]"
              }`}
            >
              {topic.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Posts Stream */}
      {filteredPosts.length === 0 ? (
        <div className="py-16 text-center text-[var(--text-muted)] text-sm">
          该分类下暂无文章
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {filteredPosts.map((post) => {
            const formattedDate = format(
              new Date(post.publishedAt),
              "yyyy-MM-dd",
              { locale: zhCN },
            );

            return (
              <article key={post.id} className="py-6 first:pt-0 group">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4">
                  <Link href={`/writing/${post.slug}`} className="block flex-1">
                    <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors leading-snug">
                      {post.title}
                    </h2>
                  </Link>
                  <time
                    dateTime={post.publishedAt}
                    className="font-mono text-xs text-[var(--text-muted)] shrink-0"
                  >
                    {formattedDate}
                  </time>
                </div>

                <p className="text-sm text-[var(--text-secondary)] mt-2 line-clamp-2 leading-relaxed">
                  {post.summary}
                </p>

                <div className="mt-2.5 flex items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
                  <span>{post.readingMinutes} 分钟阅读</span>
                  {post.tags.map((tag) => (
                    <span key={tag}>· #{tag}</span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
