import { notFound, permanentRedirect } from "next/navigation";

import { getPostBySlug } from "../../../lib/content";

interface LegacyWritingPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = true;


export default async function LegacyWritingPage({
  params,
}: LegacyWritingPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  permanentRedirect(`/archives/${encodeURIComponent(post.slug)}`);
}
