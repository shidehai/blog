import Link from "next/link";
import {
  getActivityInfo,
  getAllPosts,
  getCategories,
  getFeaturedPosts,
  getProfile,
  getSeriesList,
  getTags,
} from "../lib/content";
import { ActivityHeatmap } from "../components/ActivityHeatmap";
import { FeaturedPost } from "../components/FeaturedPost";
import { PostCard } from "../components/PostCard";
import { SideLeft } from "../components/SideLeft";
import { SideRight } from "../components/SideRight";

export default async function HomePage() {
  const [
    profile,
    categories,
    tags,
    seriesList,
    featuredPosts,
    allPosts,
    activityInfo,
  ] = await Promise.all([
    getProfile(),
    getCategories(),
    getTags(),
    getSeriesList(),
    getFeaturedPosts(),
    getAllPosts(),
    getActivityInfo(),
  ]);

  const featured = featuredPosts[0] || allPosts[0]!;
  const recentPosts = allPosts.filter((p) => p.id !== featured.id);

  return (
    <div className="layout home-layout">
      {/* 1. Left Sidebar (184px) */}
      <SideLeft
        profile={profile}
        categories={categories}
        tags={tags}
        seriesList={seriesList}
      />

      {/* 2. Middle Main Feed Content */}
      <main className="main-content" id="main-content">
        {/* Featured Post Card */}
        {featured && <FeaturedPost post={featured} />}

        {/* Activity Heatmap Card */}
        <ActivityHeatmap
          days={activityInfo.days}
          activeDaysCount={activityInfo.activeDaysCount}
          totalUpdates={activityInfo.totalUpdates}
        />

        {/* Recent Posts Section Head */}
        <div className="feed-section-head">
          <h2>最近更新</h2>
          <span>{allPosts.length} 篇文章</span>
        </div>

        {/* Post Feed List */}
        <section className="post-feed" aria-label="最近文章">
          {recentPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </section>

        {/* Pagination */}
        <div className="pagination">
          <button className="page-btn disabled" aria-label="上一页">
            <svg
              className="ui-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button className="page-btn active">1</button>
          <button className="page-btn">2</button>
          <button className="page-btn" aria-label="下一页">
            <svg
              className="ui-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </main>

      {/* 3. Right Sidebar (224px) */}
      <SideRight posts={allPosts} />
    </div>
  );
}
