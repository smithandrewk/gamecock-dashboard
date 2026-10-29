import { NextResponse } from "next/server";

import { blobStore } from "@/lib/push/store";
import { parseEndpoint, readBody } from "@/lib/push/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The server copy of one subscription's prefs. POST so the endpoint isn't in a URL/log. */
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
    const sub = await blobStore.getSub(ep.endpoint);
    return NextResponse.json(sub ? { subscribed: true, prefs: sub.prefs } : { subscribed: false });
  } catch (e) {
    console.error("[push/status]", e);
    return NextResponse.json({ error: "Couldn't load your alert settings." }, { status: 502 });
  }
}
