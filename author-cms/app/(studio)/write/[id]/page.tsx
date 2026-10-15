import { notFound } from "next/navigation";
import { z } from "zod";
import { ownerPage } from "../../../../lib/owner-page";
import { getStore } from "../../../../lib/store";
import { CmsError } from "../../../../lib/errors";
import { readEnvironment } from "../../../../lib/env";
import { ContentEditor } from "../../../../components/ContentEditor";
export default async function Page({params}:{params:Promise<{id:string}>}) {
  await ownerPage();const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();
  const store=getStore();
  const item=await store.get(id).catch(error=>{if(error instanceof CmsError&&error.status===404)notFound();throw error;});
  const taxonomies=await store.taxonomies();
  const topics=(await store.list()).filter(item=>item.draft.kind==="topic").map(item=>({id:item.id,title:item.draft.title}));
  return <ContentEditor key={id} initial={item} taxonomies={taxonomies} topics={topics} siteOrigin={readEnvironment().siteOrigin}/>;
}
