import { Suspense } from "react";
import {
  getAllPosts,
  getCategories,
  getProfile,
  getSeriesList,
  getTags,
} from "../../lib/content";
import { TagsClient } from "./TagsClient";

export const metadata = {
  title: "标签",
  description: "按标签浏览全站文章与技术主题",
};

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
