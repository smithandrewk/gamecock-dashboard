import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, cookieValueFor } from "@/lib/admin/auth";

// One-time sign-in link: /admin/auth?key=<ADMIN_KEY> sets the admin cookie and
// redirects to /admin, so the key leaves the address bar immediately.
export async function GET(req: NextRequest) {
  const value = cookieValueFor(req.nextUrl.searchParams.get("key") ?? "");
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
