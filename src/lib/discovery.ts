import type { Post, PublishedSnapshot } from "./content.ts";

const STATIC_HTML_ROUTES = [
  "/",
  "/about/",
  "/archive/",
  "/notes/",
  "/search/",
  "/topics/",
  "/writing/",
] as const;

interface SitemapEntry {
  lastModified: string;
  path: string;
}

function routeUrl(path: string, siteUrl: URL): string {
  return new URL(path, siteUrl).href;
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function postModifiedAt(post: Post): string {
  return post.updatedAt ?? post.publishedAt;
}

function newestTimestamp(values: readonly (string | null)[]): string {
  const available = values.filter((value): value is string => value !== null);
  return (
    available.sort((left, right) => right.localeCompare(left))[0] ??
    "1970-01-01T00:00:00.000Z"
  );
}

function feedLastModified(snapshot: PublishedSnapshot): string {
  return newestTimestamp([
    snapshot.settings.updatedAt,
    ...snapshot.posts.map(postModifiedAt),
  ]);
}

function sitemapEntries(snapshot: PublishedSnapshot): readonly SitemapEntry[] {
  const latestPost = newestTimestamp(snapshot.posts.map(postModifiedAt));
  const settingsUpdated = snapshot.settings.updatedAt ?? latestPost;
  const writingUpdated = newestTimestamp(
    snapshot.posts.filter((post) => post.kind !== "note").map(postModifiedAt),
  );
  const notesUpdated = newestTimestamp(
    snapshot.posts.filter((post) => post.kind === "note").map(postModifiedAt),
  );
  const staticUpdated = new Map<string, string>([
    ["/", newestTimestamp([settingsUpdated, latestPost])],
    ["/about/", settingsUpdated],
    ["/archive/", latestPost],
    ["/notes/", notesUpdated],
    ["/search/", latestPost],
    ["/topics/", newestTimestamp([settingsUpdated, latestPost])],
    ["/writing/", writingUpdated],
  ]);
  const topicEntries = snapshot.topics.map((topic) => ({
    lastModified: newestTimestamp(
      snapshot.posts
        .filter((post) => post.topics.some((item) => item.id === topic.id))
        .map(postModifiedAt),
    ),
    path: `/topics/${topic.slug}/`,
  }));
  const postEntries = snapshot.posts.map((post) => ({
    lastModified: postModifiedAt(post),
    path: post.route,
  }));

  return [
    ...STATIC_HTML_ROUTES.map((path) => ({
      lastModified: staticUpdated.get(path) ?? settingsUpdated,
      path,
    })),
    ...topicEntries,
    ...postEntries,
  ].sort((left, right) => left.path.localeCompare(right.path));
}

export function buildRssXml(snapshot: PublishedSnapshot, siteUrl: URL): string {
  const channelUrl = routeUrl("/", siteUrl);
  const feedUrl = routeUrl("/rss.xml", siteUrl);
  const items = snapshot.posts
    .map((post) => {
      const url = routeUrl(post.route, siteUrl);
      const categories = [post.kind, ...post.topics.map((topic) => topic.name)]
        .map((category) => `      <category>${escapeXml(category)}</category>`)
        .join("\n");
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <description>${escapeXml(post.summary)}</description>
${categories}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(snapshot.settings.siteName)}</title>
    <link>${escapeXml(channelUrl)}</link>
    <description>${escapeXml(snapshot.settings.defaultSeoDescription)}</description>
    <language>${escapeXml(snapshot.settings.locale)}</language>
    <lastBuildDate>${new Date(feedLastModified(snapshot)).toUTCString()}</lastBuildDate>
    <generator>Astro + Directus</generator>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

export function buildSitemapXml(
  snapshot: PublishedSnapshot,
  siteUrl: URL,
): string {
  const urls = sitemapEntries(snapshot)
    .map(
      ({ lastModified, path }) => `  <url>
    <loc>${escapeXml(routeUrl(path, siteUrl))}</loc>
    <lastmod>${escapeXml(lastModified)}</lastmod>
  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function buildSitemapIndexXml(
  snapshot: PublishedSnapshot,
  siteUrl: URL,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${escapeXml(routeUrl("/sitemap.xml", siteUrl))}</loc>
    <lastmod>${escapeXml(feedLastModified(snapshot))}</lastmod>
  </sitemap>
</sitemapindex>
`;
}

export function buildRobotsTxt(siteUrl: URL): string {
  return `User-agent: *
Allow: /
Disallow: /preview/
Disallow: /pagefind/

Sitemap: ${routeUrl("/sitemap-index.xml", siteUrl)}
`;
}

export function buildManifest(snapshot: PublishedSnapshot): object {
  const shortName = Array.from(snapshot.settings.siteName)
    .slice(0, 12)
    .join("");
  return {
    name: snapshot.settings.siteName,
    short_name: shortName,
    description: snapshot.settings.defaultSeoDescription,
    id: "/",
    start_url: "/",
    scope: "/",
    lang: snapshot.settings.locale,
    dir: "ltr",
    display: "browser",
    background_color: "#e8e6e3",
    theme_color: "#4a8fe7",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
