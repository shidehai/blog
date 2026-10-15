import { ownerPage } from "../../../lib/owner-page";
import { getStore } from "../../../lib/store";
import { Settings } from "../../../components/Settings";
export default async function Page(){await ownerPage();return <Settings initial={await getStore().profile()}/>;}
