import webpush from "web-push";

import type { Alert } from "./detect";
import type { PushPrefs } from "./prefs";
import type { PushStore, SubRecord } from "./store";

export type PushPayload = {
  title: string;
  body: string;
  tag: string;
  url: string;
  icon: string;
  badge: string;
  kind: string;
  sport?: string;
  eventId?: string;
  ts: number;
};

export type SendOptions = { TTL: number; urgency: "very-low" | "low" | "normal" | "high"; topic?: string };

/** Abstracted so tests can mock web-push. Resolves with the push service status code. */
export type Sender = (sub: SubRecord, payload: string, opts: SendOptions) => Promise<{ statusCode: number }>;

export const ICON = "/icon-192.png";
export const BADGE = "/icon-192.png";

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  const pub = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT not set");
  webpush.setVapidDetails(subject, pub, priv);
  vapidReady = true;
}

export const webPushSender: Sender = async (sub, payload, opts) => {
  ensureVapid();
  try {
    const r = await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      payload,
      { TTL: opts.TTL, urgency: opts.urgency, ...(opts.topic ? { topic: opts.topic } : {}), timeout: 10_000 },
    );
    return { statusCode: r.statusCode };
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (typeof code === "number") return { statusCode: code };
    throw e;
  }
};

export function wants(prefs: PushPrefs, alert: Alert): boolean {
  return prefs.sports.includes(alert.sport) && alert.prefs.some((k) => prefs[k]);
}

export function payloadFor(alert: Alert, now = Date.now()): PushPayload {
  return {
    title: alert.title,
    body: alert.body,
    tag: alert.tag,
    url: alert.url,
    icon: ICON,
    badge: BADGE,
    kind: alert.kind,
    sport: alert.sport,
    eventId: alert.eventId,
    ts: now,
  };
}

/** Topic header must be <=32 url-safe chars; lets the push service replace a queued dup. */
function topicFor(tag: string) {
  return tag.replace(/[^A-Za-z0-9_-]/g, "").slice(-32);
}

export type SendResult = { status: "ok" | "gone" | "error"; statusCode?: number };

export async function sendOne(
  store: PushStore,
  sender: Sender,
  sub: SubRecord,
  payload: PushPayload,
  opts: SendOptions,
): Promise<SendResult> {
  try {
    const { statusCode } = await sender(sub, JSON.stringify(payload), { ...opts, topic: topicFor(payload.tag) });
    if (statusCode === 404 || statusCode === 410) {
      await store.deleteSub(sub.endpoint).catch(() => {});
      return { status: "gone", statusCode };
    }
    return statusCode >= 200 && statusCode < 300 ? { status: "ok", statusCode } : { status: "error", statusCode };
  } catch {
    return { status: "error" };
  }
}

export type FanOutResult = { sent: number; gone: number; failed: number };

/** Send alerts (in order) to every subscriber whose prefs match. */
export async function fanOut(
  store: PushStore,
  sender: Sender,
  subs: SubRecord[],
  alerts: Alert[],
  now = Date.now(),
): Promise<FanOutResult> {
  const res: FanOutResult = { sent: 0, gone: 0, failed: 0 };
  const CONCURRENCY = 20;
  for (let i = 0; i < subs.length; i += CONCURRENCY) {
    await Promise.all(
      subs.slice(i, i + CONCURRENCY).map(async (sub) => {
        for (const a of alerts) {
          if (!wants(sub.prefs, a)) continue;
          const r = await sendOne(store, sender, sub, payloadFor(a, now), { TTL: a.ttl, urgency: a.urgency });
          if (r.status === "ok") res.sent++;
          else if (r.status === "gone") {
            res.gone++;
            return; // subscription deleted; skip its remaining alerts
          } else res.failed++;
        }
      }),
    );
  }
  return res;
}
