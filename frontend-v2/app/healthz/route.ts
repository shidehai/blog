export const dynamic = "force-dynamic";

/** Lightweight container liveness endpoint; public pages are built snapshots. */
export function GET() {
  return Response.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
