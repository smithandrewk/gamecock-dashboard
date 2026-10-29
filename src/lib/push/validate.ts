import type { SubRecord } from "./store";

/**
 * Hosts of the browser push services we deliver to. web-push POSTs to the endpoint, so an
 * allowlist keeps the cron from being turned into a request cannon at arbitrary URLs.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome / Android / Edge (new)
  /^android\.googleapis\.com$/,
  /^(.+\.)?push\.apple\.com$/, // Safari / iOS home-screen apps
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^(.+\.)?push\.services\.mozilla\.com$/,
  /^(.+\.)?notify\.windows\.com$/, // Edge (legacy WNS)
];

function b64urlBytes(s: unknown): number {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]+={0,2}$/.test(s)) return -1;
  return Buffer.from(s, "base64url").length;
}

export type ParsedSubscription = Pick<SubRecord, "endpoint" | "keys">;

export function parseSubscription(input: unknown): { ok: true; sub: ParsedSubscription } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "subscription missing" };
  const o = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const ep = parseEndpoint(o.endpoint);
  if (!ep.ok) return ep;
  // p256dh: uncompressed P-256 point (65 bytes). auth: 16 random bytes.
  if (b64urlBytes(o.keys?.p256dh) !== 65) return { ok: false, error: "keys.p256dh invalid" };
  if (b64urlBytes(o.keys?.auth) !== 16) return { ok: false, error: "keys.auth invalid" };
  return {
    ok: true,
    sub: { endpoint: ep.endpoint, keys: { p256dh: o.keys!.p256dh as string, auth: o.keys!.auth as string } },
  };
}

export function parseEndpoint(input: unknown): { ok: true; endpoint: string } | { ok: false; error: string } {
  if (typeof input !== "string" || input.length > 1024) return { ok: false, error: "endpoint invalid" };
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return { ok: false, error: "endpoint invalid" };
  }
  if (u.protocol !== "https:") return { ok: false, error: "endpoint must be https" };
  if (!PUSH_HOSTS.some((re) => re.test(u.hostname))) return { ok: false, error: "endpoint is not a known push service" };
  return { ok: true, endpoint: input };
}

/** Read a small JSON body; rejects oversized or malformed bodies. */
export async function readBody(req: Request, max = 4096): Promise<unknown> {
  const text = await req.text();
  if (text.length > max) throw new Error("body too large");
  return JSON.parse(text);
}
