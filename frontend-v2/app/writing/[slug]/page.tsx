import { notFound } from "next/navigation";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  getAllPosts,
  getNavigationPosts,
  getPostBySlug,
} from "../../../lib/content";
import { extractHeadings } from "../../../lib/markdown";
import { ArticleClient } from "./ArticleClient";

interface ArticlePageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: ArticlePageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "文章未找到" };

  return {
    title: `${post.title} · 青山神司集`,
    description: post.summary,
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const [allPosts, headings, { prevPost, nextPost }] = await Promise.all([
    getAllPosts(),
    extractHeadings(post.content),
    getNavigationPosts(post),
  ]);

  const formattedDate = format(new Date(post.publishedAt), "yyyy-MM-dd", {
    locale: zhCN,
  });

  const relatedPosts = allPosts
    .filter(
      (p) =>
        p.id !== post.id &&
        (p.category === post.category ||
          p.tags.some((t) => post.tags.includes(t))),
    )
    .slice(0, 4);

  return (
    <ArticleClient
      post={post}
      formattedDate={formattedDate}
      headings={headings}
      prevPost={prevPost}
      nextPost={nextPost}
      relatedPosts={relatedPosts}
    />
  );
}
