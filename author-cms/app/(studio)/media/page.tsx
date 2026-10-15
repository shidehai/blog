import { ownerPage } from "../../../lib/owner-page";
import { getStore } from "../../../lib/store";
import { MediaLibrary } from "../../../components/MediaLibrary";
export default async function Page(){await ownerPage();return <div className="content-page"><header className="page-heading"><div><h1>媒体库</h1><p>为文字配上画面。图片原文件与历史引用都会留存。</p></div></header><MediaLibrary initial={await getStore().media()}/></div>;}
