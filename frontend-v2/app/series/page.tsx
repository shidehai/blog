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
  title: "文章系列",
  description: "系统化技术专栏与连续专题文章",
};

export default async function SeriesPage() {
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
          <span aria-current="page">系列</span>
        </nav>

        {/* Hero Section */}
        <section className="glass series-hero">
          <div className="series-hero-icon">
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
              <path d="m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5" />
            </svg>
          </div>
          <div>
            <h1>文章系列</h1>
            <p>共 {seriesList.length} 个专题，按主题连续阅读</p>
          </div>
        </section>

        {/* Series List */}
        <div className="series-list">
          {seriesList.map((series) => {
            const seriesPosts = posts.filter(
              (p) =>
                p.series?.name?.toLowerCase() === series.name.toLowerCase() ||
                p.series?.slug?.toLowerCase() === series.slug.toLowerCase(),
            );
            const totalMinutes = seriesPosts.reduce(
              (acc, p) => acc + (p.readingMinutes || 5),
              0,
            );

            return (
              <Link
                key={series.slug}
                className="glass series-card"
                href={`/series/${series.slug}`}
              >
                <div className="series-card-main">
                  <div className="series-card-title">
                    <h2>{series.name}</h2>
                    <span>
                      {seriesPosts.length || series.count} 篇 · 约{" "}
                      {totalMinutes || 30} 分钟
                    </span>
                  </div>
                  <ul>
                    {(seriesPosts.length > 0
                      ? seriesPosts
                      : posts.slice(0, 4)
                    ).map((p) => (
                      <li key={p.id}>{p.title}</li>
                    ))}
                  </ul>
                </div>
                <span className="series-enter">
                  查看系列{" "}
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
              </Link>
            );
          })}
        </div>
      </main>

      {/* 3. Right Sidebar (224px) */}
      <SideRight posts={posts} />
    </div>
  );
}
