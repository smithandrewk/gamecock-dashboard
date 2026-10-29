import "server-only";
import { q } from "./db";
import { sourced } from "./sourced";

// Every admin number, defined once in SQL over Vantage's site_events_gamecock view
// (internal traffic already excluded). Days are Eastern time: fans think in game days,
// not UTC. A "visitor" is a Vantage anon_id (one browser profile; the Home Screen app
// and Safari on the same phone are two). A "session" is Vantage's 30-minute idle window.
// Custom event names come from src/lib/analytics/track.ts.

const TZ = "America/New_York";
const EV = "site_events_gamecock";
const SRC = "Vantage · site_events_gamecock";
const local = `(ts AT TIME ZONE '${TZ}')`;
const since = (p = "$1") => `ts > now() - make_interval(days => ${p}::int)`;

export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];

const num = (v: unknown) => (v == null ? 0 : Number(v));

// ---------- collection: are we even collecting? ----------

export type Collection = {
  firstEvent: string | null;
  lastEvent: string | null;
  events: number;
  lastBeat: string | null;
  openGap: { startedAt: string; cause: string | null } | null;
};

export const getCollection = () =>
  sourced("Vantage · events + ingest ledger", async () => {
    const [[e], [b], gaps] = await Promise.all([
      q<{ first: Date | null; last: Date | null; n: string }>(`SELECT min(ts) first, max(ts) last, count(*) n FROM ${EV}`),
      q<{ beat: Date | null }>(`SELECT max(beat_minute) beat FROM ingest_beats`),
      q<{ started_at: Date; cause: string | null }>(
        `SELECT started_at, cause FROM ingest_gaps
          WHERE ended_at IS NULL AND kind IN ('collector','ingest_path') ORDER BY started_at DESC LIMIT 1`,
      ),
    ]);
    return {
      firstEvent: e.first?.toISOString() ?? null,
      lastEvent: e.last?.toISOString() ?? null,
      events: num(e.n),
      lastBeat: b.beat?.toISOString() ?? null,
      openGap: gaps[0] ? { startedAt: gaps[0].started_at.toISOString(), cause: gaps[0].cause } : null,
    } satisfies Collection;
  });

// ---------- live ----------

export const getLive = () =>
  sourced(SRC, async () => {
    const [r] = await q<{ now5: string; now30: string }>(
      `SELECT count(DISTINCT anon_id) FILTER (WHERE ts > now() - interval '5 minutes') now5,
              count(DISTINCT anon_id) now30
         FROM ${EV} WHERE ts > now() - interval '30 minutes'`,
    );
    return { now5: num(r.now5), now30: num(r.now30) };
  });

// ---------- headline numbers for a window, with the window before it ----------

export type Summary = {
  visitors: number;
  /** First visit ever fell inside the window. */
  newVisitors: number;
  /** Came back: active in the window on a later (ET) day than their first-ever visit. */
  returningVisitors: number;
  sessions: number;
  pageviews: number;
  interactions: number;
  engagedSessions: number;
  medianSessionSec: number | null;
  standaloneSessions: number;
  prevVisitors: number;
  prevSessions: number;
};

export const getSummary = (days: Range) =>
  sourced(SRC, async () => {
    const [r] = await q<Record<string, string | null>>(
      `WITH first AS (SELECT anon_id, min(ts) first_ts FROM ${EV} GROUP BY anon_id),
            win AS (SELECT * FROM ${EV} WHERE ${since()}),
            sess AS (
              SELECT session_id,
                     extract(epoch FROM max(ts) - min(ts)) dur,
                     bool_or(name NOT IN ('pageview','app_open')) engaged,
                     bool_or(name = 'app_open' AND props->>'standalone' = 'true') standalone
                FROM win GROUP BY session_id)
       SELECT (SELECT count(DISTINCT anon_id) FROM win) visitors,
              (SELECT count(DISTINCT w.anon_id) FROM win w JOIN first f USING (anon_id)
                WHERE f.first_ts > now() - make_interval(days => $1::int)) new_visitors,
              (SELECT count(DISTINCT w.anon_id) FROM win w JOIN first f USING (anon_id)
                WHERE ${local.replace("ts", "w.ts")}::date > (f.first_ts AT TIME ZONE '${TZ}')::date) returning_visitors,
              (SELECT count(*) FROM sess) sessions,
              (SELECT count(*) FROM win WHERE name = 'pageview') pageviews,
              (SELECT count(*) FROM win WHERE name NOT IN ('pageview','app_open')) interactions,
              (SELECT count(*) FROM sess WHERE engaged) engaged,
              (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY dur) FROM sess) median_dur,
              (SELECT count(*) FROM sess WHERE standalone) standalone,
              (SELECT count(DISTINCT anon_id) FROM ${EV}
                WHERE ts > now() - make_interval(days => 2 * $1::int) AND NOT ${since()}) prev_visitors,
              (SELECT count(DISTINCT session_id) FROM ${EV}
                WHERE ts > now() - make_interval(days => 2 * $1::int) AND NOT ${since()}) prev_sessions`,
      [days],
    );
    const visitors = num(r.visitors);
    const newVisitors = num(r.new_visitors);
    return {
      visitors,
      newVisitors,
      returningVisitors: num(r.returning_visitors),
      sessions: num(r.sessions),
      pageviews: num(r.pageviews),
      interactions: num(r.interactions),
      engagedSessions: num(r.engaged),
      medianSessionSec: r.median_dur == null ? null : Number(r.median_dur),
      standaloneSessions: num(r.standalone),
      prevVisitors: num(r.prev_visitors),
      prevSessions: num(r.prev_sessions),
    } satisfies Summary;
  });

// ---------- daily new vs returning ----------

export type Day = { day: string; visitors: number; newVisitors: number; returning: number; sessions: number };

export const getDaily = (days: Range) =>
  sourced(SRC, async () => {
    const rows = await q<{ d: string; visitors: string; new_v: string; ret: string; sessions: string }>(
      `WITH f AS (SELECT anon_id, min(${local}::date) d0 FROM ${EV} GROUP BY 1),
            a AS (SELECT DISTINCT ${local}::date d, anon_id FROM ${EV} WHERE ${since("($1 + 1)")}),
            s AS (SELECT ${local}::date d, count(DISTINCT session_id) n FROM ${EV} WHERE ${since("($1 + 1)")} GROUP BY 1),
            days AS (SELECT generate_series((now() AT TIME ZONE '${TZ}')::date - ($1::int - 1),
                                            (now() AT TIME ZONE '${TZ}')::date, interval '1 day')::date d)
       SELECT to_char(days.d, 'YYYY-MM-DD') d,
              count(a.anon_id) visitors,
              count(a.anon_id) FILTER (WHERE f.d0 = days.d) new_v,
              count(a.anon_id) FILTER (WHERE f.d0 < days.d) ret,
              coalesce(max(s.n), 0) sessions
         FROM days LEFT JOIN a ON a.d = days.d LEFT JOIN f ON f.anon_id = a.anon_id LEFT JOIN s ON s.d = days.d
        GROUP BY days.d ORDER BY days.d`,
      [days],
    );
    return rows.map((r) => ({ day: r.d, visitors: num(r.visitors), newVisitors: num(r.new_v), returning: num(r.ret), sessions: num(r.sessions) })) satisfies Day[];
  });

// ---------- how often they come back ----------

/** Visitors in the window, bucketed by how many different days they showed up. */
export const getFrequency = (days: Range) =>
  sourced(SRC, async () => {
    const rows = await q<{ bucket: string; visitors: string }>(
      `SELECT CASE WHEN n = 1 THEN '1 day' WHEN n = 2 THEN '2 days' WHEN n <= 4 THEN '3–4 days'
                   WHEN n <= 9 THEN '5–9 days' ELSE '10+ days' END bucket, count(*) visitors
         FROM (SELECT anon_id, count(DISTINCT ${local}::date) n FROM ${EV} WHERE ${since()} GROUP BY 1) v
        GROUP BY 1`,
      [days],
    );
    const order = ["1 day", "2 days", "3–4 days", "5–9 days", "10+ days"];
    const by = new Map(rows.map((r) => [r.bucket, num(r.visitors)]));
    return order.map((label) => ({ label, value: by.get(label) ?? 0 }));
  });

export type Cohort = { week: string; size: number; retained: (number | null)[] };

/** Weekly cohorts (Mon–Sun, ET) by first visit: share active again in each later week. */
export const getRetention = (weeks = 8) =>
  sourced(SRC, async () => {
    const rows = await q<{ cohort: string; k: number; n: string; cur: string }>(
      `WITH a AS (SELECT anon_id, date_trunc('week', ${local})::date wk FROM ${EV} GROUP BY 1, 2),
            c AS (SELECT anon_id, min(wk) cohort FROM a GROUP BY 1)
       SELECT to_char(c.cohort, 'YYYY-MM-DD') cohort, ((a.wk - c.cohort) / 7)::int k, count(*) n,
              to_char(date_trunc('week', now() AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD') cur
         FROM a JOIN c USING (anon_id)
        WHERE c.cohort >= date_trunc('week', now() AT TIME ZONE '${TZ}')::date - ($1::int - 1) * 7
        GROUP BY 1, 2 ORDER BY 1, 2`,
      [weeks],
    );
    const byCohort = new Map<string, Map<number, number>>();
    for (const r of rows) {
      if (!byCohort.has(r.cohort)) byCohort.set(r.cohort, new Map());
      byCohort.get(r.cohort)!.set(r.k, num(r.n));
    }
    const current = rows[0]?.cur;
    const out: Cohort[] = [];
    for (const [week, m] of byCohort) {
      const size = m.get(0) ?? 0;
      // Weeks that haven't happened yet for this cohort are null, not 0%.
      const elapsed = current ? Math.round((Date.parse(current) - Date.parse(week)) / (7 * 864e5)) : 0;
      const retained = Array.from({ length: weeks - 1 }, (_, i) =>
        i + 1 > elapsed ? null : size ? (m.get(i + 1) ?? 0) / size : 0,
      );
      out.push({ week, size, retained });
    }
    return out;
  });

// ---------- what they use ----------

export type SportRow = { sport: string; landed: number; switched: number; visitors: number };

export const getSports = (days: Range) =>
  sourced(SRC, async () => {
    const rows = await q<{ sport: string; landed: string; switched: string; visitors: string }>(
      `SELECT props->>'sport' sport,
              count(*) FILTER (WHERE name = 'app_open') landed,
              count(*) FILTER (WHERE name = 'tab_view') switched,
              count(DISTINCT anon_id) visitors
         FROM ${EV} WHERE ${since()} AND name IN ('app_open','tab_view') AND props ? 'sport'
        GROUP BY 1 ORDER BY visitors DESC`,
      [days],
    );
    return rows.map((r) => ({ sport: r.sport, landed: num(r.landed), switched: num(r.switched), visitors: num(r.visitors) })) satisfies SportRow[];
  });

export type FeatureRow = { name: string; events: number; visitors: number };

export const getFeatures = (days: Range) =>
  sourced(SRC, async () => {
    const rows = await q<{ name: string; events: string; visitors: string }>(
      `SELECT name, count(*) events, count(DISTINCT anon_id) visitors
         FROM ${EV} WHERE ${since()} AND name <> 'pageview' GROUP BY 1`,
      [days],
    );
    return rows.map((r) => ({ name: r.name, events: num(r.events), visitors: num(r.visitors) })) satisfies FeatureRow[];
  });

export const getGameOpens = (days: Range) =>
  sourced(SRC, async () => {
    const rows = await q<{ state: string | null; source: string | null; n: string }>(
      `SELECT props->>'state' state, props->>'source' source, count(*) n
         FROM ${EV} WHERE ${since()} AND name = 'game_open' GROUP BY 1, 2`,
      [days],
    );
    return rows.map((r) => ({ state: r.state ?? "unknown", source: r.source ?? "unknown", n: num(r.n) }));
  });

export const getPlatforms = (days: Range) =>
  sourced(SRC, async () => {
    const rows = await q<{ platform: string | null; standalone: boolean; visitors: string; opens: string }>(
      `SELECT props->>'platform' platform, (props->>'standalone') = 'true' standalone,
              count(DISTINCT anon_id) visitors, count(*) opens
         FROM ${EV} WHERE ${since()} AND name = 'app_open' GROUP BY 1, 2 ORDER BY opens DESC`,
      [days],
    );
    return rows.map((r) => ({ platform: r.platform ?? "unknown", standalone: r.standalone, visitors: num(r.visitors), opens: num(r.opens) }));
  });

// ---------- when ----------

/** Sessions started, by weekday (0 = Sunday) and hour, Eastern. */
export const getHeatmap = (days: Range) =>
  sourced(SRC, async () => {
    const rows = await q<{ dow: number; h: number; n: string }>(
      `SELECT extract(dow FROM s)::int dow, extract(hour FROM s)::int h, count(*) n
         FROM (SELECT min(${local}) s FROM ${EV} WHERE ${since()} GROUP BY session_id) x
        GROUP BY 1, 2`,
      [days],
    );
    const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    for (const r of rows) grid[r.dow][r.h] = num(r.n);
    return grid;
  });

// ---------- where from ----------

export type Count = { label: string; value: number };

export const getBreakdowns = (days: Range) =>
  sourced(SRC, async () => {
    const top = (expr: string, where = "TRUE", limit = 8) =>
      q<{ label: string | null; value: string }>(
        `SELECT ${expr} label, count(DISTINCT anon_id) value FROM ${EV}
          WHERE ${since()} AND ${where} GROUP BY 1 ORDER BY 2 DESC LIMIT ${limit}`,
        [days],
      ).then((rows) => rows.map((r) => ({ label: r.label ?? "Unknown", value: num(r.value) })));
    // Our own host as referrer is internal navigation, not a source.
    const ref = `CASE WHEN referrer IS NULL OR referrer = '' OR referrer ~* '^https?://([a-z0-9-]+\\.)*gamecock\\.ai' THEN 'Direct / app'
                      ELSE regexp_replace(referrer, '^https?://(www\\.)?([^/:?#]+).*$', '\\2') END`;
    const [sources, os, devices, regions, cities] = await Promise.all([
      top(ref, "name = 'pageview'"),
      top("os"),
      top("device"),
      top("region", "region IS NOT NULL"),
      top("city || coalesce(', ' || region, '')", "city IS NOT NULL"),
    ]);
    return { sources, os, devices, regions, cities };
  });

// ---------- recent sessions ----------

export type SessionRow = {
  started: string;
  durationSec: number;
  events: number;
  standalone: boolean;
  returning: boolean;
  os: string | null;
  device: string | null;
  place: string | null;
  did: string[];
};

export const getRecentSessions = (limit = 15) =>
  sourced(SRC, async () => {
    const rows = await q<{
      started: Date; dur: string; events: string; standalone: boolean; is_returning: boolean;
      os: string | null; device: string | null; place: string | null; did: string[] | null;
    }>(
      `WITH first AS (SELECT anon_id, min(ts) first_ts FROM ${EV} GROUP BY anon_id),
            s AS (
              SELECT session_id, anon_id, min(ts) started, extract(epoch FROM max(ts) - min(ts)) dur, count(*) events,
                     bool_or(name = 'app_open' AND props->>'standalone' = 'true') standalone,
                     max(os) os, max(device) device,
                     max(coalesce(city || coalesce(', ' || region, ''), region, country)) place,
                     array_remove(array_agg(DISTINCT CASE WHEN name NOT IN ('pageview','app_open') THEN name END), NULL) did
                FROM ${EV} WHERE ts > now() - interval '14 days'
               GROUP BY session_id, anon_id)
       SELECT s.*, (f.first_ts AT TIME ZONE '${TZ}')::date < (s.started AT TIME ZONE '${TZ}')::date is_returning
         FROM s JOIN first f USING (anon_id)
        ORDER BY s.started DESC LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({
      started: r.started.toISOString(),
      durationSec: num(r.dur),
      events: num(r.events),
      standalone: r.standalone,
      returning: r.is_returning,
      os: r.os,
      device: r.device,
      place: r.place,
      did: r.did ?? [],
    })) satisfies SessionRow[];
  });
