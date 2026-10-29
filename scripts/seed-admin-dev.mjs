// Seeds a LOCAL Postgres with SYNTHETIC gamecock analytics so /admin can be built and
// reviewed before real traffic exists. Mirrors the shape of Vantage's site_events_gamecock
// view plus the ingest ledger. Refuses any non-localhost URL: synthetic events must never
// reach the real Vantage store.
//
//   createdb gamecock_admin_dev
//   VANTAGE_READ_URL=postgres://localhost/gamecock_admin_dev node scripts/seed-admin-dev.mjs
import pg from "pg";

const url = process.env.VANTAGE_READ_URL || "postgres://localhost/gamecock_admin_dev";
if (!/^postgres(ql)?:\/\/([^@]*@)?(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error(`Refusing to seed ${url.replace(/\/\/[^@]*@/, "//***@")}: local databases only.`);
  process.exit(1);
}
const db = new pg.Client({ connectionString: url });
await db.connect();

await db.query(`
  DROP TABLE IF EXISTS site_events_gamecock, ingest_beats, ingest_gaps;
  CREATE TABLE site_events_gamecock (
    id bigserial, name text NOT NULL, ts timestamptz NOT NULL, anon_id text, session_id text,
    url text, path text, referrer text, utm_source text, utm_medium text, utm_campaign text,
    device text, browser text, os text, country text, region text, city text,
    props jsonb NOT NULL DEFAULT '{}'::jsonb);
  CREATE TABLE ingest_beats (beat_minute timestamptz PRIMARY KEY, boot_id text NOT NULL, wrote_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE ingest_gaps (id serial PRIMARY KEY, kind text NOT NULL, site_id int, started_at timestamptz NOT NULL,
    ended_at timestamptz, source text NOT NULL, cause text, note text, detected_at timestamptz NOT NULL DEFAULT now());
`);

// Deterministic PRNG so every seed looks the same.
let seed = 1801;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const weighted = (pairs) => { let r = rnd() * pairs.reduce((a, [, w]) => a + w, 0); for (const [v, w] of pairs) if ((r -= w) <= 0) return v; return pairs[0][0]; };

const DAYS = 63;
const now = Date.now();
const places = [["Columbia", "South Carolina", 30], ["Charleston", "South Carolina", 14], ["Greenville", "South Carolina", 12],
  ["Rock Hill", "South Carolina", 5], ["Myrtle Beach", "South Carolina", 5], ["Charlotte", "North Carolina", 9],
  ["Atlanta", "Georgia", 6], ["Aiken", "South Carolina", 4], ["New York", "New York", 2], ["Nashville", "Tennessee", 2]];
const refs = [[null, 55], ["https://www.google.com/", 14], ["https://t.co/", 6], ["https://www.reddit.com/r/Gamecocks/", 9],
  ["https://www.facebook.com/", 5], ["https://www.instagram.com/", 6], ["https://www.gamecock.ai/", 5]];
const sports = [["football", 70], ["wbb", 18], ["mbb", 8], ["baseball", 4]];

const rows = [];
let visitors = 0;
for (let d = DAYS; d >= 0; d--) {
  const day = new Date(now - d * 864e5);
  const dow = new Date(day.toLocaleString("en-US", { timeZone: "America/New_York" })).getDay();
  const growth = 0.4 + (DAYS - d) / DAYS; // the site is catching on
  const gameday = dow === 6 ? 3.2 : dow === 0 ? 1.3 : dow === 5 ? 1.2 : 1;
  const newToday = Math.round((3 + rnd() * 4) * growth * gameday);
  for (let i = 0; i < newToday; i++) {
    visitors++;
    const anon = `syn-${visitors}`;
    const [city, region] = weighted(places.map((p) => [p, p[2]]));
    const os = weighted([["iOS", 64], ["Android", 26], ["macOS", 6], ["Windows", 4]]);
    const device = os === "iOS" || os === "Android" ? "mobile" : "desktop";
    const loyal = rnd(); // how often this fan comes back
    const installs = os === "iOS" && loyal > 0.75;
    const subscribes = loyal > 0.82;
    for (let back = 0, cur = d; cur >= 0; back++) {
      const sessionDay = new Date(now - cur * 864e5);
      const local = new Date(sessionDay.toLocaleString("en-US", { timeZone: "America/New_York" }));
      const sdow = local.getDay();
      // Saturday afternoons/evenings for football; weekday evenings otherwise.
      const hour = sdow === 6 ? weighted([[12, 2], [13, 3], [14, 3], [15, 5], [16, 6], [17, 4], [19, 5], [20, 6], [21, 4], [22, 2]])
                              : weighted([[7, 2], [8, 3], [12, 4], [13, 2], [17, 3], [18, 4], [19, 5], [20, 5], [21, 4], [22, 3], [23, 1]]);
      const start = new Date(sessionDay); start.setUTCHours(hour + 4, Math.floor(rnd() * 60), Math.floor(rnd() * 60), 0);
      if (start.getTime() > now) break;
      const sess = `${anon}-s${back}`;
      const standalone = installs && back > 1;
      let t = start.getTime();
      const sport = weighted(sports);
      const ref = back === 0 ? weighted(refs) : null;
      const ev = (name, props = {}) => {
        rows.push([name, new Date(t), anon, sess, `https://www.gamecock.ai/${sport === "football" ? "" : `?sport=${sport}`}`, "/",
          ref, device, os === "iOS" ? "Safari" : "Chrome", os, "US", region, city, JSON.stringify(props)]);
        t += (5 + rnd() * 70) * 1000;
      };
      ev("pageview");
      ev("app_open", { standalone, platform: os === "iOS" ? "ios-safari" : os === "Android" ? "android" : "desktop", sport });
      const actions = Math.floor(rnd() * (2 + loyal * 6));
      for (let a = 0; a < actions; a++) {
        const what = weighted([["tab_view", 30], ["game_open", 40], ["alerts_open", 8], ["install_open", back === 0 && os === "iOS" ? 10 : 2]]);
        if (what === "tab_view") ev("tab_view", { sport: weighted(sports.slice(1)) });
        else if (what === "game_open") ev("game_open", { sport: "football", state: weighted([["post", 55], ["pre", 35], ["in", 10]]), source: weighted([["hero", 45], ["schedule", 55]]) });
        else ev(what, what === "alerts_open" ? { subscribed: false, needsInstall: os === "iOS" && !standalone } : { platform: "ios-safari" });
      }
      if (subscribes && back === 2) { ev("alerts_open", { subscribed: false, needsInstall: false }); ev("alerts_on", { sports: ["football"], prefs: ["kickoffSoon", "kickoff", "scScores", "halftimeFinal"] }); }
      // Next visit: loyal fans come back within days; most never do.
      if (rnd() > 0.25 + loyal * 0.7) break;
      cur -= Math.max(1, Math.round((1 - loyal) * 9 * rnd()) + (loyal > 0.6 ? 1 : 3));
    }
  }
}

for (let i = 0; i < rows.length; i += 1000) {
  const chunk = rows.slice(i, i + 1000);
  const vals = chunk.map((_, r) => `(${Array.from({ length: 14 }, (_, c) => `$${r * 14 + c + 1}`).join(",")})`).join(",");
  await db.query(`INSERT INTO site_events_gamecock (name, ts, anon_id, session_id, url, path, referrer, device, browser, os, country, region, city, props) VALUES ${vals}`, chunk.flat());
}
await db.query(`INSERT INTO ingest_beats (beat_minute, boot_id) VALUES (date_trunc('minute', now()), 'dev')`);
console.log(`Seeded ${rows.length} synthetic events from ${visitors} synthetic visitors into ${url.replace(/\/\/[^@]*@/, "//***@")}`);
await db.end();
