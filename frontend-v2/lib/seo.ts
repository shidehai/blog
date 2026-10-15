import type { Metadata, MetadataRoute } from "next";
import type { PublicCatalog } from "@blog/content-contracts";
import { readRuntimeEnvironment } from "./env";

export const SITE_NAME = "青山神司集";
export const PUBLIC_PAGES = {
  home: {
    path: "/",
    title: SITE_NAME,
    description: "记录技术、写作与日常思考。",
  },
  archives: {
    path: "/archives",
    title: "归档",
    description: "文章时间线归档，记录技术成长轨迹",
  },
  categories: {
    path: "/categories",
    title: "分类",
    description: "系统化分类导航，快速定位相关技术领域",
  },
  series: {
    path: "/series",
    title: "文章系列",
    description: "系统化技术专栏与连续专题文章",
  },
  tags: {
    path: "/tags",
    title: "标签",
    description: "按标签浏览全站文章与技术主题",
  },
  about: {
    path: "/about",
    title: "关于",
    description: "关于作者、技术栈与本博客的建设理念",
  },
  tools: {
    path: "/tools",
    title: "工具箱",
    description: "正在筹备的开发与运维实用工具",
  },
} as const;

interface PageMetadataInput {
  path: string;
  title: string;
  description: string;
  image?: string;
  article?: { publishedAt: string; author: string; tags: string[] };
}

export function pageMetadata(input: PageMetadataInput): Metadata {
  const { siteUrl } = readRuntimeEnvironment();
  const url = new URL(input.path, siteUrl).href;
  const image = new URL(input.image || "/share.png", siteUrl).href;
  const title =
    input.path === "/" || input.title === SITE_NAME
      ? input.title
      : `${input.title} | ${SITE_NAME}`;
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: input.description,
      url,
      siteName: SITE_NAME,
      locale: "zh_CN",
      images: [
        {
          url: image,
          alt: input.title,
          ...(!input.image ? { width: 1200, height: 630 } : {}),
        },
      ],
      ...(input.article
        ? {
            type: "article",
            publishedTime: input.article.publishedAt,
            authors: [input.article.author],
            tags: input.article.tags,
          }
        : { type: "website" }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: input.description,
      images: [image],
    },
  };
}

export function sitemapEntries(
  catalog: PublicCatalog,
  siteUrl: string,
): MetadataRoute.Sitemap {
  // Catalog is already the published projection. Do not read drafts, aliases or
  // use draft updated_at as a public lastModified timestamp.
  const paths = [
    ...Object.values(PUBLIC_PAGES).map((page) => page.path),
    ...catalog.posts.map(
      (post) => `/archives/${encodeURIComponent(post.slug)}`,
    ),
    ...catalog.categories
      .filter((category) => category.count > 0)
      .map((category) => `/categories/${encodeURIComponent(category.slug)}`),
    ...catalog.series
      .filter((series) => series.count > 0)
      .map((series) => `/series/${encodeURIComponent(series.slug)}`),
  ];
  return [...new Set(paths)].map((pathname) => ({
    url: new URL(pathname, siteUrl).href,
  }));
}
