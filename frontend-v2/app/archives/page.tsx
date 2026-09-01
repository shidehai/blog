import Link from "next/link";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  getAllPosts,
  getCategories,
  getProfile,
  getSeriesList,
  getTags,
} from "../../lib/content";
import type { Post } from "../../lib/types";
import { SideLeft } from "../../components/SideLeft";
import { SideRight } from "../../components/SideRight";

export const metadata = {
  title: "归档",
  description: "文章时间线归档，记录技术成长轨迹",
};

interface YearGroup {
  year: string;
  count: number;
  months: {
    month: string;
    posts: Post[];
  }[];
}

export default async function ArchivesPage() {
  const [profile, categories, tags, seriesList, posts] = await Promise.all([
    getProfile(),
    getCategories(),
    getTags(),
    getSeriesList(),
    getAllPosts(),
  ]);

  // Group posts by Year, then by Month
  const yearMap = new Map<string, Map<string, Post[]>>();

  posts.forEach((post) => {
    const d = new Date(post.publishedAt);
    const year = format(d, "yyyy");
    const month = format(d, "MM");

    if (!yearMap.has(year)) {
      yearMap.set(year, new Map());
    }
    const monthMap = yearMap.get(year)!;
    if (!monthMap.has(month)) {
      monthMap.set(month, []);
    }
    monthMap.get(month)!.push(post);
  });

  const yearGroups: YearGroup[] = Array.from(yearMap.entries()).map(
    ([year, monthMap]) => {
      let count = 0;
      const months = Array.from(monthMap.entries()).map(([month, pList]) => {
        count += pList.length;
        return { month, posts: pList };
      });
      return { year, count, months };
    },
  );

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
          <span aria-current="page">归档</span>
        </nav>

        {/* Hero Section */}
        <section className="glass archive-hero">
          <div className="archive-hero-icon" aria-hidden="true">
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
          </div>
          <div>
            <h1>文章归档</h1>
            <p>共 {posts.length} 篇文章，按发布时间整理</p>
          </div>
        </section>

        {/* Timeline by Years */}
        {yearGroups.map((yg) => (
          <section key={yg.year} className="glass archive-year">
            <header className="archive-year-head">
              <h2>{yg.year}</h2>
              <span>{yg.count} 篇</span>
            </header>
            <div className="archive-timeline">
              {yg.months.map((mg) => (
                <section key={mg.month} className="archive-month">
                  <h3>{mg.month} 月</h3>
                  <ul className="archive-list">
                    {mg.posts.map((post) => {
                      const formattedDate = format(
                        new Date(post.publishedAt),
                        "yyyy-MM-dd",
                        { locale: zhCN },
                      );
                      return (
                        <li key={post.id}>
                          <span
                            className="archive-dot"
                            aria-hidden="true"
                          ></span>
                          <time dateTime={post.publishedAt}>
                            {formattedDate}
                          </time>
                          <Link href={`/writing/${post.slug}`}>
                            {post.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* 3. Right Sidebar (224px) */}
      <SideRight posts={posts} />
    </div>
  );
}
