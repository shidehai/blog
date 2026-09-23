import type { Metadata } from "next";
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
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "文章未找到" };

  return { title: post.title, description: post.summary };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const [allPosts, headings, navigation] = await Promise.all([
    getAllPosts(),
    extractHeadings(post.content),
    getNavigationPosts(post),
  ]);
  const relatedPosts = allPosts
    .filter(
      (candidate) =>
        candidate.id !== post.id &&
        (candidate.category === post.category ||
          candidate.tags.some((tag) => post.tags.includes(tag))),
    )
    .slice(0, 4);
  const formattedDate = format(new Date(post.publishedAt), "yyyy-MM-dd", {
    locale: zhCN,
  });

  return (
    <ArticleClient
      post={post}
      formattedDate={formattedDate}
      headings={headings}
      prevPost={navigation.prevPost}
      nextPost={navigation.nextPost}
      relatedPosts={relatedPosts}
    />
  );
}
