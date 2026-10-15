import { handleApi } from "../../../lib/http";
export const dynamic="force-dynamic";
export const runtime="nodejs";
async function route(request: Request, context: {params:Promise<{path:string[]}>}) { return handleApi(request,(await context.params).path); }
export { route as GET, route as POST, route as PUT, route as PATCH };
