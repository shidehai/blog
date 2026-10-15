import type { MetadataRoute } from "next";
import { CMS_BASE_PATH } from "@blog/content-contracts/paths";
import { readRuntimeEnvironment } from "../lib/env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const { siteUrl } = readRuntimeEnvironment();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/healthz", CMS_BASE_PATH] },
    sitemap: new URL("/sitemap.xml", siteUrl).href,
  };
}
