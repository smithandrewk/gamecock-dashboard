/* eslint-disable @typescript-eslint/no-explicit-any -- raw ESPN JSON is untyped; parsed into typed models below */
// South Carolina football: ESPN schedule + game summary, parsed into the shapes the UI reads.
import { espnFetch, isTimeTBD, pickLogo } from "@/lib/espn";

export const FOOTBALL_PATH = "football/college-football";
export const SC_FOOTBALL_ID = "2579";

// SEC members (2024+ alignment), by ESPN team id. Schedule competitions don't carry a
// conference flag, so this is how SEC games are marked; summaries carry the real flag.
const SEC_IDS = new Set([
  "333", "8", "2", "57", "61", "96", "99", "145", "344", "142", "201", "2579", "2633", "251", "245", "238",
]);

export type GameState = "pre" | "in" | "post";

export interface FBTeam {
  id: string;
  abbreviation: string;
  /** "Tennessee", "South Carolina" */
  shortName: string;
  displayName: string;
  logo: string;
  rank?: number;
  record?: string;
  confRecord?: string;
  score?: number;
  winner?: boolean;
  linescores: number[];
  possession?: boolean;
}

export interface FBGame {
  id: string;
  date: string;
  timeTBD: boolean;
  state: GameState;
  completed: boolean;
  /** ESPN status detail, e.g. "Final/OT", "11/14 - TBD", "3rd Quarter" */
  detail: string;
  shortDetail: string;
  period?: number;
  clock?: string;
  home: FBTeam;
  away: FBTeam;
  sc: FBTeam;
  opp: FBTeam;
  scHome: boolean;
  neutral: boolean;
  conference: boolean;
  venue?: string;
  venueCity?: string;
  tv: string[];
  /** Bowl / playoff name for postseason games */
  note?: string;
  postseason: boolean;
  result?: "W" | "L" | "T";
}

export interface FootballSeason {
  overall?: string;
  conference?: string;
  /** ESPN's own standing text, e.g. "11th in SEC" */
  standing?: string;
  streak?: string;
  pointsFor?: number;
  pointsAgainst?: number;
  seasonLabel?: string;
  games: FBGame[];
}

export interface ScoringPlay {
  id: string;
  period: number;
  clock: string;
  teamId: string;
  teamAbbr: string;
  /** TD, FG, SF, 2PT ... */
  kind: string;
  typeText: string;
  text: string;
  homeScore: number;
  awayScore: number;
}

export interface StatRow {
  key: string;
  label: string;
  home: string;
  away: string;
}

export interface LeaderEntry {
  teamId: string;
  teamAbbr: string;
  name: string;
  position?: string;
  line: string;
  headshot?: string;
}

export interface LeaderCategory {
  key: string;
  label: string;
  entries: LeaderEntry[];
}

export interface StandingsRow {
  teamId: string;
  name: string;
  overall: string;
  conf: string;
  /** Place by SEC win %, ties share a number (1, 2, 3, 4, 4, 4, 7...). Undefined if no SEC games. */
  place?: number;
  /** True when another team has the same SEC win % */
  tied?: boolean;
}

export interface FBSummary {
  game: FBGame;
  situation?: {
    downDistanceText?: string;
    possessionTeamId?: string;
    isRedZone?: boolean;
    lastPlay?: string;
  };
  scoringPlays: ScoringPlay[];
  teamStats: StatRow[];
  leaders: LeaderCategory[];
  odds?: { details?: string; overUnder?: number; provider?: string };
  /** South Carolina's win probability, 0..1, latest value ESPN has */
  scWinProb?: number;
  attendance?: number;
  standings?: { title: string; rows: StandingsRow[] };
  /** True when built from src/lib/fixtures (?demo=) rather than ESPN live */
  demo?: boolean;
}

function num(v: any): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const raw = typeof v === "object" ? (v.value ?? v.displayValue) : v;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : undefined;
}

function recordOf(records: any, type: string): string | undefined {
  if (!Array.isArray(records)) return undefined;
  const r = records.find((x: any) => x.type === type);
  return r?.summary ?? r?.displayValue ?? undefined;
}

function parseCompetitor(c: any): FBTeam {
  const t = c?.team ?? {};
  const rawRank = c?.curatedRank?.current ?? c?.rank;
  const rank = typeof rawRank === "number" && rawRank >= 1 && rawRank <= 25 ? rawRank : undefined;
  return {
    id: String(t.id ?? c?.id ?? ""),
    abbreviation: t.abbreviation ?? "",
    shortName: ((n: string) => (n === "USC" ? "USC Trojans" : n))(t.shortDisplayName ?? t.location ?? t.name ?? t.displayName ?? ""),
    displayName: t.displayName ?? t.shortDisplayName ?? "",
    logo: pickLogo(t),
    rank,
    record: recordOf(c?.record ?? c?.records, "total"),
    confRecord: recordOf(c?.record ?? c?.records, "vsconf"),
    score: num(c?.score),
    winner: typeof c?.winner === "boolean" ? c.winner : undefined,
    linescores: Array.isArray(c?.linescores)
      ? c.linescores.map((l: any) => num(l) ?? num(l?.displayValue) ?? 0)
      : [],
    possession: typeof c?.possession === "boolean" ? c.possession : undefined,
  };
}

/** Parse one ESPN competition (from a schedule event or a summary header). */
export function parseCompetition(comp: any, extra: { timeValid?: boolean; note?: string; postseason?: boolean } = {}): FBGame {
  const competitors = comp?.competitors ?? [];
  const home = parseCompetitor(competitors.find((c: any) => c.homeAway === "home"));
  const away = parseCompetitor(competitors.find((c: any) => c.homeAway === "away"));
  const scHome = home.id === SC_FOOTBALL_ID;
  const sc = scHome ? home : away;
  const opp = scHome ? away : home;
  const status = comp?.status ?? {};
  const type = status.type ?? {};
  const state: GameState = type.state === "in" || type.state === "post" ? type.state : "pre";
  const detail: string = type.detail ?? type.description ?? "";
  const date: string = comp?.date ?? "";

  let result: FBGame["result"];
  if (state === "post" && sc.score !== undefined && opp.score !== undefined) {
    result = sc.score > opp.score ? "W" : sc.score < opp.score ? "L" : "T";
  }

  const tv: string[] = [];
  for (const b of comp?.broadcasts ?? []) {
    const name = b?.media?.shortName ?? b?.names?.[0];
    if (name && !tv.includes(name)) tv.push(name);
  }
  const city = comp?.venue?.address?.city;
  const st = comp?.venue?.address?.state;

  return {
    id: String(comp?.id ?? ""),
    date,
    timeTBD: isTimeTBD(date, detail, extra.timeValid ?? comp?.timeValid),
    state,
    completed: !!type.completed,
    detail,
    shortDetail: type.shortDetail ?? detail,
    period: num(status.period),
    clock: status.displayClock,
    home,
    away,
    sc,
    opp,
    scHome,
    neutral: !!comp?.neutralSite,
    conference:
      typeof comp?.conferenceCompetition === "boolean"
        ? comp.conferenceCompetition
        : SEC_IDS.has(home.id) && SEC_IDS.has(away.id) && !extra.postseason,
    venue: comp?.venue?.fullName,
    venueCity: city ? [city, st].filter(Boolean).join(", ") : undefined,
    tv,
    note: extra.note ?? comp?.notes?.[0]?.headline,
    postseason: !!extra.postseason,
    result,
  };
}

async function getSchedule(seasontype: 2 | 3): Promise<{ games: FBGame[]; raw: any }> {
  const raw = await espnFetch(`${FOOTBALL_PATH}/teams/${SC_FOOTBALL_ID}/schedule?seasontype=${seasontype}`);
  const games = (raw.events ?? []).map((e: any) =>
    parseCompetition(e.competitions?.[0], {
      timeValid: e.timeValid ?? e.competitions?.[0]?.timeValid,
      postseason: seasontype === 3,
    }),
  );
  return { games, raw };
}

function streakOf(games: FBGame[]): string | undefined {
  const done = games.filter((g) => g.result).reverse();
  if (!done.length) return undefined;
  const first = done[0].result!;
  let n = 0;
  for (const g of done) {
    if (g.result !== first) break;
    n++;
  }
  return `${first}${n}`;
}

export async function getFootballSeason(): Promise<FootballSeason> {
  const [teamRaw, regular, bowls] = await Promise.all([
    espnFetch(`${FOOTBALL_PATH}/teams/${SC_FOOTBALL_ID}`),
    getSchedule(2),
    // Bowls live in seasontype=3; it's empty until bowl season, and a failure there
    // must not take down the regular-season schedule.
    getSchedule(3).catch(() => ({ games: [] as FBGame[], raw: null })),
  ]);
  const team = teamRaw.team ?? {};
  const seen = new Set<string>();
  const games = [...regular.games, ...bowls.games]
    .filter((g) => g.id && !seen.has(g.id) && seen.add(g.id))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const total = team.record?.items?.find((i: any) => i.type === "total") ?? team.record?.items?.[0];
  const stat = (name: string) => num(total?.stats?.find((s: any) => s.name === name)?.value);

  // Conference record: the most recent final game's competitor record (ESPN's own number);
  // fall back to counting SEC results from the schedule.
  const finals = games.filter((g) => g.state === "post");
  let conference = finals.length ? finals[finals.length - 1].sc.confRecord : undefined;
  if (!conference) {
    const conf = finals.filter((g) => g.conference && !g.postseason && g.result);
    if (conf.length) {
      const w = conf.filter((g) => g.result === "W").length;
      conference = `${w}-${conf.length - w}`;
    }
  }
  let overall: string | undefined = total?.summary;
  if (!overall && finals.some((g) => g.result)) {
    const w = finals.filter((g) => g.result === "W").length;
    const l = finals.filter((g) => g.result === "L").length;
    overall = `${w}-${l}`;
  }
  const played = stat("gamesPlayed") ?? 0;

  return {
    overall,
    conference,
    standing: team.standingSummary || undefined,
    streak: streakOf(games),
    pointsFor: played > 0 ? stat("avgPointsFor") : undefined,
    pointsAgainst: played > 0 ? stat("avgPointsAgainst") : undefined,
    seasonLabel: regular.raw?.season?.displayName ?? regular.raw?.requestedSeason?.displayName,
    games,
  };
}

const STAT_ROWS: [string, string][] = [
  ["totalYards", "Total yards"],
  ["netPassingYards", "Passing"],
  ["rushingYards", "Rushing"],
  ["firstDowns", "1st downs"],
  ["thirdDownEff", "3rd down"],
  ["fourthDownEff", "4th down"],
  ["turnovers", "Turnovers"],
  ["totalPenaltiesYards", "Penalties"],
  ["possessionTime", "Possession"],
];

const LEADER_CATS: [string, string][] = [
  ["passingYards", "Passing"],
  ["rushingYards", "Rushing"],
  ["receivingYards", "Receiving"],
];

/** Parse an ESPN summary?event= response (live or from a fixture). */
export function parseFootballSummary(raw: any): FBSummary {
  const comp = raw?.header?.competitions?.[0] ?? {};
  const venue = raw?.gameInfo?.venue;
  const game = parseCompetition(
    {
      ...comp,
      venue: comp.venue ?? venue,
    },
    { timeValid: raw?.header?.timeValid, postseason: raw?.header?.season?.type === 3 },
  );

  const situationRaw = raw?.situation ?? comp?.situation;
  const possessionTeam =
    situationRaw?.possession ?? (game.home.possession ? game.home.id : game.away.possession ? game.away.id : undefined);
  const situation =
    game.state === "in" && (situationRaw || possessionTeam)
      ? {
          downDistanceText: situationRaw?.downDistanceText ?? situationRaw?.shortDownDistanceText,
          possessionTeamId: possessionTeam ? String(possessionTeam) : undefined,
          isRedZone: !!situationRaw?.isRedZone,
          lastPlay: situationRaw?.lastPlay?.text,
        }
      : undefined;

  const scoringPlays: ScoringPlay[] = (raw?.scoringPlays ?? []).map((p: any) => ({
    id: String(p.id),
    period: p.period?.number ?? 0,
    clock: p.clock?.displayValue ?? "",
    teamId: String(p.team?.id ?? ""),
    teamAbbr: p.team?.abbreviation ?? "",
    kind: p.scoringType?.abbreviation ?? p.type?.abbreviation ?? "",
    typeText: p.type?.text ?? "",
    text: p.text ?? "",
    homeScore: p.homeScore ?? 0,
    awayScore: p.awayScore ?? 0,
  }));

  const boxTeams: any[] = raw?.boxscore?.teams ?? [];
  const homeBox = boxTeams.find((t) => String(t.team?.id) === game.home.id);
  const awayBox = boxTeams.find((t) => String(t.team?.id) === game.away.id);
  const teamStats: StatRow[] = [];
  if (homeBox?.statistics?.length && awayBox?.statistics?.length) {
    for (const [key, label] of STAT_ROWS) {
      const h = homeBox.statistics.find((s: any) => s.name === key)?.displayValue;
      const a = awayBox.statistics.find((s: any) => s.name === key)?.displayValue;
      if (h !== undefined && a !== undefined) teamStats.push({ key, label, home: h, away: a });
    }
  }

  const leaders: LeaderCategory[] = [];
  if (game.state !== "pre") {
    for (const [key, label] of LEADER_CATS) {
      const entries: LeaderEntry[] = [];
      for (const side of [game.away, game.home]) {
        const teamBlock = (raw?.leaders ?? []).find((l: any) => String(l.team?.id) === side.id);
        const cat = teamBlock?.leaders?.find((c: any) => c.name === key);
        const top = cat?.leaders?.[0];
        if (top) {
          entries.push({
            teamId: side.id,
            teamAbbr: side.abbreviation,
            name: top.athlete?.shortName ?? top.athlete?.displayName ?? "",
            position: top.athlete?.position?.abbreviation,
            line: top.displayValue ?? "",
            headshot: top.athlete?.headshot?.href,
          });
        }
      }
      if (entries.length) leaders.push({ key, label, entries });
    }
  }

  const pick = (raw?.pickcenter ?? []).find((p: any) => p?.details || p?.overUnder) ?? undefined;
  const odds = pick
    ? { details: pick.details || undefined, overUnder: num(pick.overUnder), provider: pick.provider?.name }
    : undefined;

  const wp: any[] = raw?.winprobability ?? [];
  const lastWp = wp.length ? num(wp[wp.length - 1]?.homeWinPercentage) : undefined;
  const scWinProb = lastWp === undefined ? undefined : game.scHome ? lastWp : 1 - lastWp;

  const group = raw?.standings?.groups?.[0];
  const standings = group?.standings?.entries?.length
    ? {
        title: group.header ?? "Standings",
        rows: rankStandings(
          group.standings.entries.map((e: any) => ({
            teamId: String(e.id ?? ""),
            name: e.team ?? "",
            overall: recordOf(e.stats, "total") ?? "",
            conf: recordOf(e.stats, "vsconf") ?? "",
          })),
        ),
      }
    : undefined;

  return {
    game,
    situation,
    scoringPlays,
    teamStats,
    leaders,
    odds,
    scWinProb: game.state === "pre" ? undefined : scWinProb,
    attendance: num(raw?.gameInfo?.attendance),
    standings,
  };
}

function winPct(rec: string): number | undefined {
  const m = /^(\d+)-(\d+)(?:-(\d+))?$/.exec(rec.trim());
  if (!m) return undefined;
  const w = +m[1];
  const l = +m[2];
  const t = m[3] ? +m[3] : 0;
  const gp = w + l + t;
  return gp ? (w + t / 2) / gp : undefined;
}

/**
 * Number the table by SEC win %, ties sharing a place, so the "Standing" tile and the
 * table always agree. Row order is left as ESPN delivered it (ESPN's feeds disagree on
 * how to order tied teams, so we don't pretend to apply tiebreakers).
 */
export function rankStandings(rows: StandingsRow[]): StandingsRow[] {
  const pcts = rows.map((r) => winPct(r.conf));
  return rows.map((r, i) => {
    const p = pcts[i];
    if (p === undefined) return r;
    const better = pcts.filter((x) => x !== undefined && x > p + 1e-9).length;
    const same = pcts.filter((x) => x !== undefined && Math.abs(x - p) < 1e-9).length;
    return { ...r, place: better + 1, tied: same > 1 };
  });
}

/** "11th", "T-11th" */
export function placeLabel(place: number, tied?: boolean): string {
  const mod100 = place % 100;
  const suf = mod100 >= 11 && mod100 <= 13 ? "th" : (["th", "st", "nd", "rd"][place % 10] ?? "th");
  return `${tied ? "T-" : ""}${place}${suf}`;
}

/**
 * ESPN schedule note "FLEX: 3:30 - 4:30pm OR 6 - 8pm ET start" → "3:30–4:30 or 6–8 PM ET".
 * Returns undefined for notes that aren't a flex kickoff window.
 */
export function flexWindow(note?: string): string | undefined {
  const m = /^\s*flex\s*:?\s*(.+?)\s*(?:start)?\s*$/i.exec(note ?? "");
  if (!m) return undefined;
  let body = m[1]
    .replace(/\s*-\s*/g, "–")
    .replace(/\s+or\s+/gi, " or ")
    .replace(/\s*(am|pm)\b/gi, (_, x: string) => ` ${x.toUpperCase()}`)
    .replace(/\s+/g, " ")
    .trim();
  // "3:30–4:30 PM or 6–8 PM ET": drop the first meridiem when both windows share it.
  const mer = body.match(/\b(AM|PM)\b/g);
  if (mer && mer.length === 2 && mer[0] === mer[1]) body = body.replace(` ${mer[0]}`, "");
  return body;
}

/** "Memorial Stadium (Norman, OK)" — the city is appended only if the venue name lacks it. */
export function venueLine(g: Pick<FBGame, "venue" | "venueCity">): string | undefined {
  if (!g.venue) return g.venueCity;
  const city = g.venueCity?.split(",")[0]?.trim();
  return city && !g.venue.includes(city) ? `${g.venue} · ${g.venueCity}` : g.venue;
}

export async function getFootballSummary(eventId: string): Promise<FBSummary> {
  const raw = await espnFetch(`${FOOTBALL_PATH}/summary?event=${encodeURIComponent(eventId)}`);
  return parseFootballSummary(raw);
}

/**
 * Which game leads the page: a live game; else a game that ended in the last ~36 hours
 * (Saturday night through Sunday); else the next game; else the last one played.
 */
export function pickHeroGame(games: FBGame[], now = Date.now()): FBGame | undefined {
  const live = games.find((g) => g.state === "in");
  if (live) return live;
  const finals = games.filter((g) => g.state === "post");
  const last = finals[finals.length - 1];
  const next = games.find((g) => g.state === "pre");
  if (last && now - new Date(last.date).getTime() < 40 * 3600_000) {
    // ...unless the next game is already about to start
    if (!next || new Date(next.date).getTime() - now > 3 * 3600_000) return last;
  }
  return next ?? last;
}

export function periodLabel(period?: number): string {
  if (!period) return "";
  if (period <= 4) return `Q${period}`;
  return period === 5 ? "OT" : `${period - 4}OT`;
}
