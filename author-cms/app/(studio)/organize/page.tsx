import { ownerPage } from "../../../lib/owner-page";
import { getStore } from "../../../lib/store";
import { Organize } from "../../../components/Organize";
export default async function Page(){await ownerPage();return <Organize initial={await getStore().taxonomies()}/>;}
