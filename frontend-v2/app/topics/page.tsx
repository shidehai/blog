import Link from "next/link";
import { getAllTopics } from "../../lib/content";

export const metadata = {
  title: "专题分类",
  description: "按技术领域系统化浏览文章与随记",
};

export default async function TopicsPage() {
  const topics = await getAllTopics();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2 pb-6 border-b border-[var(--border)]">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          专题分类
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          按技术领域归纳与整理的知识体系。
        </p>
      </div>

      {/* Topics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {topics.map((topic) => (
          <Link
            key={topic.id}
            href={`/topics/${topic.slug}`}
            className="p-5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] transition-all group flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
                <span>TOPIC</span>
                <span>{topic.count} 篇</span>
              </div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                {topic.name}
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                {topic.description}
              </p>
            </div>

            <div className="text-xs font-medium text-[var(--accent)] flex items-center justify-end">
              <span>查看全部 →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
