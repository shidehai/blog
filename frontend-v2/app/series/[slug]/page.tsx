import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllPosts,
  getCategories,
  getProfile,
  getSeriesList,
  getTags,
} from "../../../lib/content";
import { PostCard } from "../../../components/PostCard";
import { SideLeft } from "../../../components/SideLeft";
import { SideRight } from "../../../components/SideRight";

interface SeriesDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const seriesList = await getSeriesList();
  return seriesList.map((s) => ({ slug: s.slug }));
}

export default async function SeriesDetailPage({
  params,
}: SeriesDetailPageProps) {
  const { slug } = await params;
  const [profile, categories, tags, seriesList, posts] = await Promise.all([
    getProfile(),
    getCategories(),
    getTags(),
    getSeriesList(),
    getAllPosts(),
  ]);

  const series = seriesList.find((s) => s.slug === slug);
  if (!series) {
    notFound();
  }

  const seriesPosts = posts.filter(
    (p) =>
      p.series?.name?.toLowerCase() === series.name.toLowerCase() ||
      p.series?.slug?.toLowerCase() === series.slug.toLowerCase(),
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
          <Link href="/series">系列</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{series.name}</span>
        </nav>

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
            <h1>{series.name}</h1>
            <p>{series.description}</p>
          </div>
        </section>

        <div className="feed-section-head">
          <h2>系列文章</h2>
          <span>{seriesPosts.length || posts.length} 篇</span>
        </div>

        <section className="post-feed" aria-label="系列文章">
          {(seriesPosts.length > 0 ? seriesPosts : posts).map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </section>
      </main>

      {/* 3. Right Sidebar (224px) */}
      <SideRight posts={posts} />
    </div>
  );
}
