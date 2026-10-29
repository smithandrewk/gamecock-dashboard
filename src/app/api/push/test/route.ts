import { NextResponse } from "next/server";

import { BADGE, ICON, sendOne, webPushSender } from "@/lib/push/send";
import { blobStore } from "@/lib/push/store";
import { parseEndpoint, readBody } from "@/lib/push/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_INTERVAL_MS = 30_000;

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
    if (!sub) return NextResponse.json({ error: "Not subscribed. Turn alerts on first." }, { status: 404 });
    const last = sub.lastTestAt ? Date.parse(sub.lastTestAt) : 0;
    const wait = last + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) {
      return NextResponse.json(
        { error: `Hang on ${Math.ceil(wait / 1000)}s before sending another test.` },
        { status: 429, headers: { "Retry-After": String(Math.ceil(wait / 1000)) } },
      );
    }
    await blobStore.putSub({ ...sub, lastTestAt: new Date().toISOString() });
    const r = await sendOne(
      blobStore,
      webPushSender,
      sub,
      {
        title: "Gamecock alerts are on",
        body: "This is a test. You'll hear from us when South Carolina plays.",
        tag: "test",
        url: "/",
        icon: ICON,
        badge: BADGE,
        kind: "test",
        ts: Date.now(),
      },
      { TTL: 60, urgency: "normal" },
    );
    if (r.status === "gone") {
      return NextResponse.json({ error: "This device's subscription expired. Turn alerts off and on again." }, { status: 410 });
    }
    if (r.status === "error") {
      return NextResponse.json({ error: `Push service rejected the test (${r.statusCode ?? "network"}).` }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[push/test]", e);
    return NextResponse.json({ error: "Couldn't send a test right now." }, { status: 502 });
  }
}
