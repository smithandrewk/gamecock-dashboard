import { NextResponse } from "next/server";

import { blobStore } from "@/lib/push/store";
import { parseEndpoint, readBody } from "@/lib/push/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { endpoint?: unknown };
  try {
    body = (await readBody(req)) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const ep = parseEndpoint(body?.endpoint);
  if (!ep.ok) return NextResponse.json({ error: ep.error }, { status: 400 });
  try {
    await blobStore.deleteSub(ep.endpoint); // idempotent: deleting a missing blob is fine
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[push/unsubscribe]", e);
    return NextResponse.json({ error: "Couldn't remove your alerts. Try again." }, { status: 502 });
  }
}
