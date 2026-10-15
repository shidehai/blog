import { pageMetadata, PUBLIC_PAGES } from "../../lib/seo";
import { Suspense } from "react";
import {
  getAllPosts,
  getCategories,
  getProfile,
  getSeriesList,
  getTags,
} from "../../lib/content";
import { TagsClient } from "./TagsClient";

export function generateMetadata() {
  return pageMetadata(PUBLIC_PAGES.tags);
}

export default async function TagsPage() {
  const [profile, categories, tags, seriesList, posts] = await Promise.all([
    getProfile(),
    getCategories(),
    getTags(),
    getSeriesList(),
    getAllPosts(),
  ]);

  return (
    <Suspense fallback={<div>加载中...</div>}>
      <TagsClient
        profile={profile}
        categories={categories}
        tags={tags}
        seriesList={seriesList}
        posts={posts}
      />
    </Suspense>
  );
}
