import { buildRobotsTxt } from "../lib/discovery.ts";

export const prerender = true;

export function GET({ site }: { site: URL | undefined }) {
  const siteUrl = new URL("/", site ?? "http://localhost:4321");
  return new Response(buildRobotsTxt(siteUrl), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
