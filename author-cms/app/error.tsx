"use client";
export default function ErrorPage({reset}:{reset:()=>void}){return <div className="empty-state"><h1>暂时无法打开写作空间</h1><p>内容服务连接失败。你的已保存内容仍在数据库中。</p><button className="button" onClick={reset}>重新尝试</button></div>;}
