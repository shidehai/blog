import type { MetadataRoute } from "next";
import { snapshot } from "../lib/content";
import { readRuntimeEnvironment } from "../lib/env";
import { sitemapEntries } from "../lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapEntries(await snapshot(), readRuntimeEnvironment().siteUrl);
}
