import { z } from "zod";
import { readRuntimeEnvironment } from "../../../lib/env";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
  if(!z.uuid().safeParse(id).success)return new Response(null,{status:404,headers});
  try{
    const environment=readRuntimeEnvironment();if(environment.source!=="cms")return new Response(null,{status:404,headers});
    const response=await fetch(`${environment.url}/media/${id}`,{cache:"no-store",signal:AbortSignal.timeout(10000)});
    if(response.status===404)return new Response(null,{status:404,headers});
    if(!response.ok||!/^image\/(jpeg|png|gif|webp|avif)$/.test(response.headers.get("content-type")??"")||Number(response.headers.get("content-length"))>20*1024*1024)throw new Error();
    return new Response(response.body,{headers:{...headers,"Content-Type":response.headers.get("content-type")!,"Content-Disposition":`inline; filename="${id}"`}});
  }catch{return new Response("图片暂时不可用",{status:503,headers});}
}
