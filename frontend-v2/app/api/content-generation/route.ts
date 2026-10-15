import { z } from "zod";
import { readPublished } from "../../../lib/content";
import { readRuntimeEnvironment } from "../../../lib/env";
export const dynamic="force-dynamic";
export async function GET(){try{const state=readRuntimeEnvironment().source==="fixture"?{generation:0}:await readPublished("generation",z.object({generation:z.number().int().nonnegative()}));return Response.json(state,{headers:{"Cache-Control":"no-store"}});}catch{return Response.json({error:"内容服务暂时不可用"},{status:503,headers:{"Cache-Control":"no-store"}});}}
