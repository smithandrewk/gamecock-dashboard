import { NextResponse } from "next/server";

import { parsePrefs } from "@/lib/push/prefs";
import { blobStore } from "@/lib/push/store";
import { parseEndpoint, parseSubscription, readBody } from "@/lib/push/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { subscription?: unknown; prefs?: unknown; oldEndpoint?: unknown };
  try {
    body = (await readBody(req)) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const sub = parseSubscription(body?.subscription);
  if (!sub.ok) return NextResponse.json({ error: sub.error }, { status: 400 });
  // Service-worker re-subscribe (pushsubscriptionchange) sends oldEndpoint and no prefs:
  // carry the old record's prefs over, then drop the old record.
  const old = body?.prefs === undefined ? parseEndpoint(body?.oldEndpoint) : null;

  try {
    const oldRec = old?.ok ? await blobStore.getSub(old.endpoint) : null;
    const prefs = oldRec ? oldRec.prefs : parsePrefs(body?.prefs);
    if (!prefs) return NextResponse.json({ error: "prefs invalid" }, { status: 400 });
    const existing = await blobStore.getSub(sub.sub.endpoint);
    const now = new Date().toISOString();
    await blobStore.putSub({
      ...sub.sub,
      prefs,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...(existing?.lastTestAt ? { lastTestAt: existing.lastTestAt } : {}),
    });
    if (oldRec && oldRec.endpoint !== sub.sub.endpoint) await blobStore.deleteSub(oldRec.endpoint);
    return NextResponse.json({ ok: true, prefs });
  } catch (e) {
    console.error("[push/subscribe]", e);
    return NextResponse.json({ error: "Couldn't save your alerts. Try again." }, { status: 502 });
  }
}
