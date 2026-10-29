import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, cookieValueFor, cookieValueForToken } from "@/lib/admin/auth";

// Sign-in: ?key=<ADMIN_KEY> or an expiring ?t=<signed token> sets the admin cookie and
// redirects to /admin, so the secret leaves the address bar immediately.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const value = params.has("t") ? cookieValueForToken(params.get("t") ?? "") : cookieValueFor(params.get("key") ?? "");
  if (!value) return new NextResponse("Not found", { status: 404 });
  const res = NextResponse.redirect(new URL("/admin", req.url));
  res.cookies.set(ADMIN_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
