import { getStore } from "../../lib/store";
import { ownerPage } from "../../lib/owner-page";
import { ContentList } from "../../components/ContentList";
export default async function Page() { await ownerPage();return <ContentList initial={await getStore().list()}/>; }
