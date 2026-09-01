/**
 * 内容快照的单一入口：优先 Directus，失败或无凭据时用夹具，两条路径共用
 * buildSnapshot 的映射逻辑，避免两套并行实现。
 *
 * 缓存在模块作用域：Next.js 构建期每个进程只拉一次。
 */
import { buildSnapshot, loadFromDirectus, type ContentSnapshot } from "./directus";
import {
  FIXTURE_CATEGORIES,
  FIXTURE_POSTS,
  FIXTURE_SERIES,
  FIXTURE_SETTINGS,
  FIXTURE_SOCIAL_LINKS,
  FIXTURE_TAGS,
  FIXTURE_TOPICS,
} from "./fixture";

function fixtureSnapshot(): ContentSnapshot {
  return buildSnapshot(
    {
      posts: FIXTURE_POSTS,
      categories: FIXTURE_CATEGORIES,
      tags: FIXTURE_TAGS,
      series: FIXTURE_SERIES,
      topics: FIXTURE_TOPICS,
      settings: FIXTURE_SETTINGS,
      socialLinks: FIXTURE_SOCIAL_LINKS,
    },
    "",
  );
}

let cached: Promise<ContentSnapshot> | undefined;

export function snapshot(): Promise<ContentSnapshot> {
  cached ??= loadFromDirectus().then((live) => live ?? fixtureSnapshot());
  return cached;
}
