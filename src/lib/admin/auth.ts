import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

// /admin is gated by one shared key (ADMIN_KEY, Vercel env). gamecock.ai's DNS is not on
// Cloudflare, so Access isn't available here. Visiting /admin/auth?key=<KEY> once stores a
// hash of the key in an httpOnly cookie; anything else gets a plain 404, so the page's
// existence isn't confirmed.

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
