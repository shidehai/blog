"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Category, Post, Series, SiteProfile, Tag } from "../../lib/types";
import { PostCard } from "../../components/PostCard";
import { SideLeft } from "../../components/SideLeft";
import { SideRight } from "../../components/SideRight";

interface CategoriesClientProps {
  profile: SiteProfile;
  categories: Category[];
  tags: Tag[];
  seriesList: Series[];
  posts: Post[];
}

export function CategoriesClient({
  profile,
  categories,
  tags,
  seriesList,
  posts,
}: CategoriesClientProps) {
  const searchParams = useSearchParams();
  const catParam = searchParams.get("cat");
  const [selectedCat, setSelectedCat] = useState<string | null>(catParam);

  const currentCat = catParam || selectedCat;

  const filteredPosts = useMemo(() => {
    if (!currentCat) return [];
    return posts.filter(
      (p) => p.category.toLowerCase() === currentCat.toLowerCase(),
    );
  }, [posts, currentCat]);

  const handleCatClick = (name: string) => {
    const next = currentCat === name ? null : name;
    setSelectedCat(next);
    if (next) {
      window.history.pushState(
        null,
        "",
        `/categories?cat=${encodeURIComponent(next)}`,
      );
    } else {
      window.history.pushState(null, "", "/categories");
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
          <span aria-current="page">分类</span>
          {currentCat && (
            <>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{currentCat}</span>
            </>
          )}
        </nav>

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
            <path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          分类
        </h1>

        <div className="grid-2 category-grid">
          {categories.map((cat) => {
            const isActive = currentCat === cat.name;
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => handleCatClick(cat.name)}
                className={`glass info-card category-link ${
                  isActive ? "active" : ""
                }`}
              >
                <div className="category-link-main">
                  <div className="tool-icon cyan category-icon">
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
                  </div>
                  <h3>{cat.name}</h3>
                </div>
                <span className="cat-count">{cat.count}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Category Article Stream */}
        {currentCat && (
          <>
            <div className="feed-section-head">
              <h2>分类：{currentCat}</h2>
              <span>{filteredPosts.length} 篇文章</span>
            </div>
            <section className="post-feed" aria-label="分类文章">
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
