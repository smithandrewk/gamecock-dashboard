import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

// /admin is gated by one shared key (ADMIN_KEY, Vercel env). gamecock.ai's DNS is not on
// Cloudflare, so Access isn't available here. Two ways in, both ending in an httpOnly
// cookie holding a hash of the key:
//   /admin/auth?key=<KEY>   the key itself (keep it out of chats and logs)
//   /admin/auth?t=<TOKEN>   an expiring link signed with the key; safe to text someone.
//                           Make one with `node scripts/admin-link.mjs [hours]`.
// Anything else gets a plain 404, so the page's existence isn't confirmed. Rotating
// ADMIN_KEY signs everyone out and kills every outstanding link.

export const ADMIN_COOKIE = "gc_admin";

const digest = (v: string) => createHash("sha256").update(`gamecock-admin:${v}`).digest("hex");

/** Cookie value for a key, or null when no admin key is configured (admin disabled). */
export function cookieValueFor(key: string): string | null {
  const expected = process.env.ADMIN_KEY;
  if (!expected || !key) return null;
  const a = Buffer.from(digest(key));
  const b = Buffer.from(digest(expected));
  return a.length === b.length && timingSafeEqual(a, b) ? digest(expected) : null;
}

/** Cookie value for a signed link `<expiresUnixSec>.<hmacHex>`, or null if bad or expired. */
export function cookieValueForToken(token: string): string | null {
  const expected = process.env.ADMIN_KEY;
  const [exp, sig] = token.split(".");
  if (!expected || !exp || !sig || !/^\d+$/.test(exp) || Number(exp) * 1000 < Date.now()) return null;
  const want = Buffer.from(createHmac("sha256", expected).update(`gamecock-admin-link:${exp}`).digest("hex"));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? digest(expected) : null;
}

export async function isAdmin(): Promise<boolean> {
  const expected = process.env.ADMIN_KEY;
  const got = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!expected || !got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(digest(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function requireAdmin() {
  if (!(await isAdmin())) notFound();
}
