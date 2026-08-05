import type { Post, SiteSettings, SocialLink } from "./content.ts";

export interface MetadataImage {
  alt: string;
  height: number;
  mimeType: string;
  src: string;
  width: number;
}

export interface MetadataArticle {
  kind: Post["kind"];
  publishedAt: string;
  title: string;
  topics: readonly string[];
  updatedAt: string | null;
}

export interface StructuredDataInput {
  article?: MetadataArticle;
  authorAvatar?: MetadataImage;
  authorName: string;
  canonicalUrl: string;
  description: string;
  image?: MetadataImage;
  locale: SiteSettings["locale"];
  pageTitle: string;
  siteDescription: string;
  siteName: string;
  siteUrl: string;
  socialLinks: readonly SocialLink[];
}

type JsonLdNode = Record<string, unknown>;

function absoluteUrl(value: string, siteUrl: string): string {
  return new URL(value, siteUrl).href;
}

function imageObject(image: MetadataImage, siteUrl: string): JsonLdNode {
  return {
    "@type": "ImageObject",
    contentUrl: absoluteUrl(image.src, siteUrl),
    height: image.height,
    name: image.alt,
    width: image.width,
  };
}

export function buildStructuredData(input: StructuredDataInput): JsonLdNode {
  const rootUrl = new URL("/", input.siteUrl).href;
  const personId = `${rootUrl}#person`;
  const websiteId = `${rootUrl}#website`;
  const webPageId = `${input.canonicalUrl}#webpage`;
  const sameAs = input.socialLinks
    .map((link) => link.url)
    .filter((url) => url.startsWith("https://") || url.startsWith("http://"));

  const person: JsonLdNode = {
    "@id": personId,
    "@type": "Person",
    name: input.authorName,
    url: rootUrl,
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(input.authorAvatar
      ? { image: imageObject(input.authorAvatar, input.siteUrl) }
      : {}),
  };
  const website: JsonLdNode = {
    "@id": websiteId,
    "@type": "WebSite",
    description: input.siteDescription,
    inLanguage: input.locale,
    name: input.siteName,
    publisher: { "@id": personId },
    url: rootUrl,
    potentialAction: {
      "@type": "SearchAction",
      "query-input": "required name=search_term_string",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/search/", input.siteUrl)}?q={search_term_string}`,
      },
    },
  };
  const page: JsonLdNode = {
    "@id": webPageId,
    "@type": "WebPage",
    description: input.description,
    inLanguage: input.locale,
    isPartOf: { "@id": websiteId },
    name: input.pageTitle,
    url: input.canonicalUrl,
    ...(input.image
      ? { primaryImageOfPage: imageObject(input.image, input.siteUrl) }
      : {}),
  };
  const graph: JsonLdNode[] = [person, website, page];

  if (input.article) {
    const article: JsonLdNode = {
      "@id": `${input.canonicalUrl}#article`,
      "@type": "BlogPosting",
      articleSection: input.article.kind,
      author: { "@id": personId },
      dateModified: input.article.updatedAt ?? input.article.publishedAt,
      datePublished: input.article.publishedAt,
      description: input.description,
      headline: input.article.title,
      inLanguage: input.locale,
      isPartOf: { "@id": websiteId },
      keywords: input.article.topics,
      mainEntityOfPage: { "@id": webPageId },
      publisher: { "@id": personId },
      url: input.canonicalUrl,
      ...(input.image
        ? { image: imageObject(input.image, input.siteUrl) }
        : {}),
    };
    graph.push(article);
    page.mainEntity = { "@id": `${input.canonicalUrl}#article` };
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export function serializeStructuredData(data: JsonLdNode): string {
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}
