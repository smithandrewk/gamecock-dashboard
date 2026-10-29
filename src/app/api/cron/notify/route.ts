import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { runNotify } from "@/lib/push/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const report = await runNotify();
  if (!report.ok) console.error("[cron/notify]", report.errors);
  // Non-2xx on errors so failed ticks show up in Vercel's cron/function logs.
  return NextResponse.json(report, { status: report.ok ? 200 : 500 });
}
