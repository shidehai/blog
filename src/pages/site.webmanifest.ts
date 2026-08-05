import { buildManifest } from "../lib/discovery.ts";
import { getPreparedSite } from "../lib/site.ts";

export const prerender = true;

export async function GET() {
  const { snapshot } = await getPreparedSite();
  return new Response(`${JSON.stringify(buildManifest(snapshot), null, 2)}\n`, {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
    },
  });
}
