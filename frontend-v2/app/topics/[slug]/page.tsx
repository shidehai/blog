import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import {
  getAllTopics,
  getPostsByTopic,
  getTopicBySlug,
} from "../../../lib/content";

interface TopicDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  const topics = await getAllTopics();
  return topics.map((topic) => ({
    slug: topic.slug,
  }));
}

export async function generateMetadata({ params }: TopicDetailPageProps) {
  const { slug } = await params;
  const topic = await getTopicBySlug(slug);
  if (!topic) return { title: "专题未找到" };

  return {
    title: `${topic.name} 专题`,
    description: topic.description,
  };
}

export default async function TopicDetailPage({ params }: TopicDetailPageProps) {
  const { slug } = await params;
  const topic = await getTopicBySlug(slug);

  if (!topic) {
    notFound();
  }

  const posts = await getPostsByTopic(topic.slug);

  return (
    <div className="space-y-8">
      {/* Back Link */}
      <div>
        <Link
          href="/topics"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>返回所有专题</span>
        </Link>
      </div>

      {/* Header */}
      <div className="space-y-2 pb-6 border-b border-[var(--border)]">
        <div className="text-xs font-mono uppercase text-[var(--accent)] font-bold">
          TOPIC
        </div>
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
          {topic.name}
        </h1>
        <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
          {topic.description}
        </p>
      </div>

      {/* Post List */}
      <div className="space-y-4">
        <h2 className="text-xs font-mono uppercase tracking-wider font-bold text-[var(--text-muted)]">
          收录篇目 ({posts.length})
        </h2>

        {posts.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)]">
            该专题下暂无收录文章
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {posts.map((post) => {
              const formattedDate = format(
                new Date(post.publishedAt),
                "yyyy-MM-dd",
                { locale: zhCN },
              );
              return (
                <article key={post.id} className="py-5 first:pt-0 group">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4">
                    <Link href={`/writing/${post.slug}`} className="block flex-1">
                      <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                        {post.title}
                      </h3>
                    </Link>
                    <time
                      dateTime={post.publishedAt}
                      className="font-mono text-xs text-[var(--text-muted)] shrink-0"
                    >
                      {formattedDate}
                    </time>
                  </div>

                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 line-clamp-2 leading-relaxed">
                    {post.summary}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
