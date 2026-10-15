import { ownerPage } from "../../lib/owner-page";
import { StudioShell } from "../../components/StudioShell";
export const dynamic = "force-dynamic";
export default async function StudioLayout({ children }: { children:React.ReactNode }) {
  await ownerPage(); return <StudioShell>{children}</StudioShell>;
}
