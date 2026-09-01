import Link from "next/link";
import {
  getAllPosts,
  getCategories,
  getProfile,
  getSeriesList,
  getTags,
} from "../../lib/content";
import { SideLeft } from "../../components/SideLeft";
import { SideRight } from "../../components/SideRight";

export const metadata = {
  title: "分类",
  description: "系统化分类导航，快速定位相关技术领域",
};

export default async function CategoriesPage() {
  const [profile, categories, tags, seriesList, posts] = await Promise.all([
    getProfile(),
    getCategories(),
    getTags(),
    getSeriesList(),
    getAllPosts(),
  ]);

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
          分类目录
        </h1>

        {/* Categories Grid: Only displays category cards */}
        <div className="category-grid">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/categories/${cat.slug}`}
              className="glass info-card category-link"
              aria-label={`查看分类：${cat.name}，共 ${cat.count} 篇文章`}
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
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="cat-count">{cat.count}</span>
                <svg
                  className="ui-icon"
                  style={{ width: "14px", height: "14px", color: "var(--text-muted)" }}
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
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* 3. Right Sidebar (224px) */}
      <SideRight posts={posts} />
    </div>
  );
}
