import { errorResponse, mediaResponse } from "../../../lib/http";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(_request:Request, context:{params:Promise<{id:string}>}) { try { return await mediaResponse((await context.params).id,true); } catch(error) { return errorResponse(error); } }
