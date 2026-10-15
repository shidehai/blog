import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

import {
  getAllPosts,
  getNavigationPosts,
  getPostDetail,
} from "../../../lib/content";
import { extractHeadings } from "../../../lib/markdown";
import { ArticleClient } from "./ArticleClient";
import { getProfile } from "../../../lib/content";
import { pageMetadata } from "../../../lib/seo";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = true;

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getPostDetail(slug);
  if (!detail)
    return { title: "文章未找到", robots: { index: false, follow: false } };
  const { post } = detail;
  const profile = await getProfile();
  return pageMetadata({
    path: `/archives/${encodeURIComponent(detail.canonicalSlug)}`,
    title: post.title,
    description: post.summary,
    image: post.cover,
    article: {
      publishedAt: post.publishedAt,
      author: profile.name,
      tags: post.tags,
    },
  });
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const detail = await getPostDetail(slug);
  if (!detail) notFound();
  if (detail.canonicalSlug !== slug)
    permanentRedirect(`/archives/${encodeURIComponent(detail.canonicalSlug)}`);
  const post = detail.post;

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
