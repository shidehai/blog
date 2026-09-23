import { notFound, permanentRedirect } from "next/navigation";

import { getAllPosts, getPostBySlug } from "../../../lib/content";

interface LegacyWritingPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export default async function LegacyWritingPage({
  params,
}: LegacyWritingPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  permanentRedirect(`/archives/${encodeURIComponent(post.slug)}`);
}
