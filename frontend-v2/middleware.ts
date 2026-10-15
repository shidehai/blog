import { NextResponse } from "next/server";
import { readRuntimeEnvironment } from "./lib/env";
export async function middleware(){
  try {
    const environment=readRuntimeEnvironment();
    if(environment.source==="cms"){
      const result=await fetch(`${environment.url}/api/public/generation`,{headers:{Authorization:`Bearer ${environment.token}`},cache:"no-store",signal:AbortSignal.timeout(5000)});
      if(!result.ok)throw new Error();
    }
    const response=NextResponse.next();response.headers.set("Cache-Control","private, no-store, max-age=0");return response;
  }catch{return new NextResponse('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>内容暂时不可用</title><body style="font-family:system-ui;background:#f8f7f3;color:#2d302b;padding:12vh 8vw"><main><h1>内容暂时不可用</h1><p>正在连接内容服务，请稍后刷新页面。</p><a href="/">重新尝试</a></main></body></html>',{status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Retry-After":"30"}});}
}
export const config={matcher:["/((?!_next/|api/|media/|healthz|icon.svg|favicon.ico|avatar.svg).*)"]};
