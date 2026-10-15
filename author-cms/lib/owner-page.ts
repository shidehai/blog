import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireOwner } from "./auth";
import { readEnvironment } from "./env";
import { CmsError } from "./errors";
export async function ownerPage() {
  const cookie = (await cookies()).toString();
  try {
    await requireOwner(
      new Request(readEnvironment().origin, { headers: { cookie } }),
    );
  } catch (error) {
    if (error instanceof CmsError && error.status === 401) redirect("/login");
    throw error;
  }
}
