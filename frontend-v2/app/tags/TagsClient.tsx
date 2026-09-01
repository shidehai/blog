"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Category, Post, Series, SiteProfile, Tag } from "../../lib/types";
import { PostCard } from "../../components/PostCard";
import { SideLeft } from "../../components/SideLeft";
import { SideRight } from "../../components/SideRight";

interface TagsClientProps {
  profile: SiteProfile;
  categories: Category[];
  tags: Tag[];
  seriesList: Series[];
  posts: Post[];
}

export function TagsClient({
  profile,
  categories,
  tags,
  seriesList,
  posts,
}: TagsClientProps) {
  const searchParams = useSearchParams();
  const tagParam = searchParams.get("tag");
  const [selectedTag, setSelectedTag] = useState<string | null>(tagParam);

  const currentTag = tagParam || selectedTag;

  const filteredPosts = useMemo(() => {
    if (!currentTag) return [];
    return posts.filter((p) =>
      p.tags.some((t) => t.toLowerCase() === currentTag.toLowerCase()),
    );
  }, [posts, currentTag]);

  const handleTagClick = (name: string) => {
    const next = currentTag === name ? null : name;
    setSelectedTag(next);
    if (next) {
      window.history.pushState(
        null,
        "",
        `/tags?tag=${encodeURIComponent(next)}`,
      );
    } else {
      window.history.pushState(null, "", "/tags");
    }
  };

  return (
    <div className="layout">
      {/* 1. Left Sidebar (184px) */}
      <SideLeft
        profile={profile}
        categories={categories}
        tags={tags}
        seriesList={seriesList}
      />

      {/* 2. Middle Main Content */}
      <main className="main-content" id="main-content">
        <nav className="breadcrumbs" aria-label="面包屑导航">
          <Link href="/">首页</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">标签</span>
          {currentTag && (
            <>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{currentTag}</span>
            </>
          )}
        </nav>

        {/* Tag Cloud Panel */}
        <div className="glass side-card tag-cloud-panel">
          <h1 className="section-title">
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
            标签
          </h1>
          <div className="side-tags">
            {tags.map((tag) => {
              const isActive = currentTag === tag.name;
              return (
                <button
                  key={tag.slug}
                  type="button"
                  onClick={() => handleTagClick(tag.name)}
                  className={`side-tag ${isActive ? "active" : ""}`}
                >
                  {tag.name}
                  <span className="sr-only"> 标签文章，共 </span>
                  <span className="cat-count">{tag.count}</span>
                  <span className="sr-only"> 篇</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Tag Article Stream */}
        {currentTag && (
          <>
            <div className="feed-section-head">
              <h2>标签：{currentTag}</h2>
              <span>{filteredPosts.length} 篇文章</span>
            </div>
            <section className="post-feed" aria-label="标签文章">
              {filteredPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </section>
          </>
        )}
      </main>

      {/* 3. Right Sidebar (224px) */}
      <SideRight posts={posts} />
    </div>
  );
}
