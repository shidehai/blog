import Link from "next/link";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Post } from "../lib/types";

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const formattedDate = format(new Date(post.publishedAt), "yyyy-MM-dd", {
    locale: zhCN,
  });

  return (
    <article className="post-card post-card-has-cover">
      {post.cover && (
        <Link className="post-card-cover-link" href={`/writing/${post.slug}`}>
          <img
            className="post-card-cover"
            src={post.cover}
            alt={post.title}
            width={1440}
            height={810}
            loading="lazy"
          />
        </Link>
      )}

      <div className="post-card-body">
        <h2>
          <Link href={`/writing/${post.slug}`}>{post.title}</Link>
        </h2>

        <div className="post-meta">
          <span>
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
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            {formattedDate}
          </span>
          <span>
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
            {post.category}
          </span>
        </div>

        <p className="post-desc">{post.summary}</p>

        <div className="tags">
          {post.tags.map((tag) => (
            <Link
              key={tag}
              href={`/tags?tag=${encodeURIComponent(tag)}`}
              className="tag"
            >
              {tag}
              <span className="sr-only"> 标签文章</span>
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}
