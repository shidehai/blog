import Link from "next/link";
export default function NotFound(){return <div className="empty-state"><h1>没有找到这篇内容</h1><p>请检查地址，或回到列表继续写作。</p><Link href="/" className="button">返回内容列表</Link></div>;}
