import { NextRequest, NextResponse } from "next/server";

// Server-side proxy for ESPN's public JSON API.
//
// Why: ESPN's /teams/:id endpoint stopped sending Access-Control-Allow-Origin
// (other endpoints still do), so the browser could no longer call it directly
// and the whole dashboard hung on skeletons. Routing every ESPN call through
// here removes the CORS dependency and lets Vercel's CDN cache responses.
//
//   /api/espn/site/<path>  -> https://site.api.espn.com/apis/site/v2/sports/<path>
//   /api/espn/web/<path>   -> https://site.web.api.espn.com/apis/v2/sports/<path>
const UPSTREAMS: Record<string, string> = {
  site: "https://site.api.espn.com/apis/site/v2/sports",
  web: "https://site.web.api.espn.com/apis/v2/sports",
};

const ALLOWED_SPORTS = [
  "football/college-football",
  "basketball/mens-college-basketball",
  "basketball/womens-college-basketball",
  "baseball/college-baseball",
];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const [host, ...rest] = (await params).path;
  const base = UPSTREAMS[host];
  const path = rest.join("/");
  if (!base || !ALLOWED_SPORTS.some((s) => path.startsWith(s + "/"))) {
    return NextResponse.json({ error: "not allowed" }, { status: 404 });
  }

  const upstream = `${base}/${path}${req.nextUrl.search}`;
  const res = await fetch(upstream, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json(
      { error: `ESPN ${res.status}` },
      { status: res.status === 404 ? 404 : 502 }
    );
  }

  // Scoreboards and summaries change during live games; team pages and
  // schedules barely move. Keep live data fresh, everything else cheap.
  const live = /\/(scoreboard|summary)$/.test(path);
  const sMaxAge = live ? 15 : 300;
  return new NextResponse(await res.text(), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 4}`,
    },
  });
}
