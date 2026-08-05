import { buildRssXml } from "../lib/discovery.ts";
import { getPreparedSite } from "../lib/site.ts";

export const prerender = true;

export async function GET({ site }: { site: URL | undefined }) {
  const { snapshot } = await getPreparedSite();
  const siteUrl = new URL("/", site ?? "http://localhost:4321");
  return new Response(buildRssXml(snapshot, siteUrl), {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
