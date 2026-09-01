import { getAllPosts, getAllTopics } from "../../lib/content";
import { WritingListClient } from "./WritingListClient";

export const metadata = {
  title: "文章归档",
  description: "全部技术长文、系统设计与工程思考归档",
};

export default async function WritingPage() {
  const [posts, topics] = await Promise.all([getAllPosts(), getAllTopics()]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2 pb-6 border-b border-[var(--border)]">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          文章归档
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          共收录 {posts.length} 篇技术长文与架构实践。
        </p>
      </div>

      <WritingListClient posts={posts} topics={topics} />
    </div>
  );
}
