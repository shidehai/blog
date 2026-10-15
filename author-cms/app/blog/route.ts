import { readEnvironment } from "../../lib/env";
export const dynamic = "force-dynamic";
export function GET() {
  const site = readEnvironment().siteOrigin;
  return Response.redirect(site,302);
}
