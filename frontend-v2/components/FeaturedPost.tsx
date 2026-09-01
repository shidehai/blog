import Link from "next/link";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Post } from "../lib/types";

interface FeaturedPostProps {
  post: Post;
}

export function FeaturedPost({ post }: FeaturedPostProps) {
  const formattedDate = format(new Date(post.publishedAt), "yyyy-MM-dd", {
    locale: zhCN,
  });

  return (
    <article className="featured-post glass">
      {post.cover && (
        <Link className="featured-post-cover-link" href={`/writing/${post.slug}`}>
          <img
            className="featured-post-cover"
            src={post.cover}
            alt={post.title}
            width={1440}
            height={810}
            fetchPriority="high"
          />
        </Link>
      )}

      <div className="featured-post-body">
        <span className="featured-label">置顶精选 · {formattedDate}</span>
        <h2>
          <Link href={`/writing/${post.slug}`}>{post.title}</Link>
        </h2>
        <p>{post.summary}</p>
        <Link className="featured-read" href={`/writing/${post.slug}`}>
          阅读全文{" "}
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
            <path d="M7 17 17 7M7 7h10v10" />
          </svg>
        </Link>
      </div>
    </article>
  );
}
