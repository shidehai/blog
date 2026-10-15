import type { MetadataRoute } from "next";
import { readRuntimeEnvironment } from "../lib/env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const { siteUrl } = readRuntimeEnvironment();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/healthz"] },
    sitemap: new URL("/sitemap.xml", siteUrl).href,
  };
}
