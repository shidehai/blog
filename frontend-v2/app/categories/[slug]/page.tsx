import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getAllPosts,
  getCategories,
  getCategoryBySlug,
  getPostsByCategory,
  getProfile,
  getSeriesList,
  getTags,
} from "../../../lib/content";
import { PostCard } from "../../../components/PostCard";
import { SideLeft } from "../../../components/SideLeft";
import { SideRight } from "../../../components/SideRight";

interface CategoryDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((cat) => ({
    slug: cat.slug,
  }));
}

export async function generateMetadata({ params }: CategoryDetailPageProps) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "分类未找到" };

  return {
    title: `${category.name} · 分类`,
    description: `浏览 ${category.name} 分类下的全部文章与技术总结`,
  };
}

export default async function CategoryDetailPage({
  params,
}: CategoryDetailPageProps) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const [profile, categories, tags, seriesList, allPosts, categoryPosts] =
    await Promise.all([
      getProfile(),
      getCategories(),
      getTags(),
      getSeriesList(),
      getAllPosts(),
      getPostsByCategory(category.name),
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
        {/* Breadcrumbs */}
        <nav className="breadcrumbs" aria-label="面包屑导航">
          <Link href="/">首页</Link>
          <span aria-hidden="true">/</span>
          <Link href="/categories">分类</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{category.name}</span>
        </nav>

        {/* Category Header Banner */}
        <div
          className="feed-header"
          style={{ paddingBottom: "1rem", marginBottom: "1.25rem" }}
        >
          <div>
            <h1
              style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}
            >
              <div
                className="tool-icon cyan category-icon"
                style={{ width: "36px", height: "36px" }}
              >
                <svg
                  className="ui-icon"
                  style={{ width: "20px", height: "20px" }}
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
              {category.name}
            </h1>
            <p>共收录 {categoryPosts.length} 篇相关文章与工程实战</p>
          </div>
          <div className="feed-actions">
            <Link
              href="/categories"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
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
                <path d="m15 18-6-6 6-6" />
              </svg>
              全部分类
            </Link>
          </div>
        </div>

        {/* Category Articles Feed */}
        {categoryPosts.length > 0 ? (
          <section
            className="post-feed"
            aria-label={`${category.name} 分类文章列表`}
          >
            {categoryPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </section>
        ) : (
          <div
            className="glass side-card"
            style={{ padding: "2.5rem 1.5rem", textAlign: "center" }}
          >
            <p
              style={{ color: "var(--text-muted)", fontSize: "var(--text-md)" }}
            >
              该分类下暂无已发布文章
            </p>
            <div style={{ marginTop: "1rem" }}>
              <Link
                href="/categories"
                className="feed-action-primary"
                style={{ display: "inline-block" }}
              >
                返回全部分类
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* 3. Right Sidebar (224px) */}
      <SideRight posts={allPosts} />
    </div>
  );
}
