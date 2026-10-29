/* eslint-disable @typescript-eslint/no-explicit-any -- raw ESPN JSON is untyped; parsed into typed models below */
// In the browser, ESPN calls go through our own API route (src/app/api/espn)
// because ESPN dropped CORS headers on some endpoints. On the server (route
// handlers, the notification cron) we call ESPN directly.
const isBrowser = typeof window !== "undefined";
const ESPN_BASE = isBrowser ? "/api/espn/site" : "https://site.api.espn.com/apis/site/v2/sports";
const ESPN_WEB_BASE = isBrowser ? "/api/espn/web" : "https://site.web.api.espn.com/apis/v2/sports";

/** GET an ESPN site-API path (e.g. "football/college-football/teams/2579"), via the proxy in the browser. */
export async function espnFetch(path: string): Promise<any> {
  const res = await fetch(`${ESPN_BASE}/${path}`);
  if (!res.ok) throw new Error(`ESPN API error: ${res.status}`);
  return res.json();
}

/**
 * ESPN marks unannounced kickoff/tip times with timeValid=false, a "TBD" status detail,
 * and a placeholder 05:00Z timestamp. Any of those means "time TBD", never "1:00 AM".
 */
export function isTimeTBD(date: string | undefined, detail?: string, timeValid?: boolean): boolean {
  if (timeValid === false) return true;
  if (detail && /\bTBD\b|\bTBA\b/i.test(detail)) return true;
  return !!date && /T05:00(:00)?(\.000)?Z$/.test(date);
}

/** Prefer ESPN's dark-background logo variant (the app is dark). */
export function pickLogo(team: any): string {
  const logos: any[] = team?.logos ?? [];
  const dark = logos.find((l) => Array.isArray(l.rel) && l.rel.includes("dark"));
  const href: string = dark?.href ?? team?.logo ?? logos[0]?.href ?? "";
  return href;
}

// South Carolina team IDs (ESPN)
export const USC_TEAM_IDS = {
  mbb: "2579", // Men's Basketball
  wbb: "2579", // Women's Basketball (same ID, different endpoint)
  baseball: "193", // Baseball (different ID than basketball)
} as const;

export type Sport = "mbb" | "wbb" | "baseball";
/** Tabs in the app, in display order. */
export type AppSport = "football" | "wbb" | "mbb" | "baseball";

const SPORT_PATHS: Record<Sport, string> = {
  mbb: "basketball/mens-college-basketball",
  wbb: "basketball/womens-college-basketball",
  baseball: "baseball/college-baseball",
};

export interface Team {
  id: string;
  name: string;
  abbreviation: string;
  displayName: string;
  logo: string;
  record?: string;
  confRecord?: string;
  rank?: number;
}

export interface Game {
  id: string;
  date: string;
  /** Kickoff/tip time not announced yet */
  timeTBD: boolean;
  name: string;
  status: {
    type: {
      id: string;
      name: string;
      state: "pre" | "in" | "post";
      completed: boolean;
      detail?: string;
    };
    displayClock?: string;
    period?: number;
  };
  homeTeam: Team;
  awayTeam: Team;
  homeScore?: number;
  awayScore?: number;
  venue?: string;
  /** "Paris, France", "Columbia, SC" */
  venueCity?: string;
  neutral?: boolean;
  broadcast?: string;
  /** Event / tournament name from ESPN notes, e.g. "SEC Tournament - First Round" */
  note?: string;
  isConference?: boolean;
  odds?: {
    spread?: string;
    overUnder?: number;
  };
  // Baseball-specific fields
  homeHits?: number;
  awayHits?: number;
  homeErrors?: number;
  awayErrors?: number;
  sport?: Sport;
}

export interface LinescoreEntry {
  inning: number;
  homeRuns: string;
  awayRuns: string;
}

export interface GameSummary {
  linescore: LinescoreEntry[];
  homeHits: number;
  awayHits: number;
  homeErrors: number;
  awayErrors: number;
}

export interface TeamData {
  team: Team;
  /** Undefined when ESPN has no record (e.g. before the season) — never shown as "0-0". */
  record: {
    overall?: string;
    conference?: string;
  };
  /** ESPN's season label for this schedule, e.g. "2025-26" */
  seasonLabel?: string;
  /** Calendar year the season ends in (ESPN season.year) */
  seasonYear?: number;
  nextGame?: Game;
  lastGame?: Game;
  schedule: Game[];
  stats?: {
    pointsPerGame: number;
    pointsAllowedPerGame: number;
  };
}

function parseScore(competitor: any): number | undefined {
  if (!competitor) return undefined;

  // ESPN returns score in different formats depending on the endpoint
  // Schedule endpoint: competitor.score.value or competitor.score.displayValue
  // Scoreboard endpoint: competitor.score (as string)
  const score = competitor.score;

  if (score === undefined || score === null) return undefined;

  // If score is an object with value property
  if (typeof score === "object") {
    const val = score.value ?? score.displayValue;
    if (val !== undefined) {
      const parsed = parseInt(String(val), 10);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }

  // If score is a string or number
  const parsed = parseInt(String(score), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseTeam(teamData: any): Team {
  const team = teamData.team || teamData;
  const rawRank = teamData.curatedRank?.current;
  // ESPN returns 99 for unranked teams - only show actual top 25 rankings
  const rank = rawRank && rawRank <= 25 ? rawRank : undefined;

  return {
    id: team.id,
    // "USC" alone is the Trojans' ESPN short name; spell it out so it never reads as South Carolina.
    name: (team.shortDisplayName || team.name) === "USC" ? "USC Trojans" : team.shortDisplayName || team.name,
    abbreviation: team.abbreviation,
    displayName: team.displayName,
    logo: pickLogo(team),
    record: teamData.records?.[0]?.summary ?? teamData.record?.find?.((r: any) => r.type === "total")?.displayValue,
    confRecord: teamData.record?.find?.((r: any) => r.type === "vsconf")?.displayValue,
    rank,
  };
}

function parseGame(event: any, sport?: Sport): Game {
  const competition = event.competitions?.[0];
  const homeCompetitor = competition?.competitors?.find(
    (c: any) => c.homeAway === "home"
  );
  const awayCompetitor = competition?.competitors?.find(
    (c: any) => c.homeAway === "away"
  );

  // Schedule events carry status on the competition; scoreboard events on the event.
  const status = event.status ?? competition?.status ?? {};
  const odds = competition?.odds?.[0];
  // Scoreboard events carry broadcasts[].names; schedule events carry broadcasts[].media.shortName.
  const broadcast =
    competition?.broadcasts?.[0]?.names?.[0] ||
    competition?.broadcasts?.[0]?.media?.shortName ||
    competition?.geoBroadcasts?.[0]?.media?.shortName;
  const vCity = competition?.venue?.address?.city;
  const vState = competition?.venue?.address?.state;

  // SEC team abbreviations for conference detection
  // ESPN uses different abbreviations across endpoints, so include all variants
  const SEC_TEAMS = [
    "ALA", "ARK", "AUB", "FLA", "UGA", "UK", "LSU", "MISS", "MSST",
    "MIZ", "SC", "TENN", "TAMU", "VAN", "OU", "TEX",
    // Alternative abbreviations used by ESPN
    "MIZZ", "OKLA", "TA&M", "BAMA"
  ];

  const homeAbbr = homeCompetitor?.team?.abbreviation?.toUpperCase();
  const awayAbbr = awayCompetitor?.team?.abbreviation?.toUpperCase();
  const bothSEC = SEC_TEAMS.includes(homeAbbr) && SEC_TEAMS.includes(awayAbbr);

  // Check for tournament/challenge games via notes - these are NOT conference games
  // even if both teams are SEC (e.g., Texas vs SC in Players Era Championship)
  const notes = competition?.notes?.[0]?.headline?.toLowerCase() || "";
  const isTournamentOrChallenge =
    notes.includes("championship") ||
    notes.includes("tournament") ||
    notes.includes("challenge") ||
    notes.includes("classic") ||
    notes.includes("invitational");

  // Check if SEC conference game - both teams must be SEC AND not a tournament/challenge
  const isConference = bothSEC && !isTournamentOrChallenge;

  return {
    id: event.id,
    date: event.date,
    timeTBD: isTimeTBD(event.date, status.type?.detail, event.timeValid ?? competition?.timeValid),
    name: event.name,
    status: {
      type: {
        id: status.type?.id,
        name: status.type?.name,
        state: status.type?.state,
        completed: status.type?.completed,
        detail: status.type?.detail,
      },
      displayClock: status.displayClock,
      period: status.period,
    },
    homeTeam: parseTeam(homeCompetitor),
    awayTeam: parseTeam(awayCompetitor),
    homeScore: parseScore(homeCompetitor),
    awayScore: parseScore(awayCompetitor),
    venue: competition?.venue?.fullName,
    venueCity: vCity ? [vCity, vState].filter(Boolean).join(", ") : undefined,
    neutral: !!competition?.neutralSite,
    broadcast,
    note: competition?.notes?.[0]?.headline || undefined,
    isConference: isConference || false,
    odds: odds
      ? {
          spread: odds.details,
          overUnder: odds.overUnder,
        }
      : undefined,
    // Baseball-specific: extract hits and errors from statistics
    homeHits: homeCompetitor?.hits !== undefined ? parseInt(String(homeCompetitor.hits), 10) : parseStatistic(homeCompetitor, "hits"),
    awayHits: awayCompetitor?.hits !== undefined ? parseInt(String(awayCompetitor.hits), 10) : parseStatistic(awayCompetitor, "hits"),
    homeErrors: homeCompetitor?.errors !== undefined ? parseInt(String(homeCompetitor.errors), 10) : parseStatistic(homeCompetitor, "errors"),
    awayErrors: awayCompetitor?.errors !== undefined ? parseInt(String(awayCompetitor.errors), 10) : parseStatistic(awayCompetitor, "errors"),
    sport,
  };
}

function parseStatistic(competitor: any, statName: string): number | undefined {
  if (!competitor?.statistics) return undefined;
  const stat = competitor.statistics.find((s: any) => s.name === statName);
  if (!stat) return undefined;
  const val = parseInt(String(stat.displayValue ?? stat.value), 10);
  return Number.isNaN(val) ? undefined : val;
}

export async function getGameSummary(eventId: string): Promise<GameSummary | null> {
  const url = `${ESPN_BASE}/baseball/college-baseball/summary?event=${eventId}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    // Try header-based linescore
    const header = data.header;
    const competitions = header?.competitions?.[0];
    const homeComp = competitions?.competitors?.find((c: any) => c.homeAway === "home");
    const awayComp = competitions?.competitors?.find((c: any) => c.homeAway === "away");

    const linescore: LinescoreEntry[] = [];
    const homeLS = homeComp?.linescores || [];
    const awayLS = awayComp?.linescores || [];

    const maxInnings = Math.max(homeLS.length, awayLS.length);
    for (let i = 0; i < maxInnings; i++) {
      linescore.push({
        inning: i + 1,
        homeRuns: homeLS[i]?.value?.toString() ?? homeLS[i]?.displayValue ?? "-",
        awayRuns: awayLS[i]?.value?.toString() ?? awayLS[i]?.displayValue ?? "-",
      });
    }

    return {
      linescore,
      homeHits: parseInt(String(homeComp?.hits ?? 0), 10),
      awayHits: parseInt(String(awayComp?.hits ?? 0), 10),
      homeErrors: parseInt(String(homeComp?.errors ?? 0), 10),
      awayErrors: parseInt(String(awayComp?.errors ?? 0), 10),
    };
  } catch {
    return null;
  }
}

/** "Adidas Arena · Paris, France"; skips the city when the venue name already has it. */
export function gameVenueLine(g: Pick<Game, "venue" | "venueCity">): string | undefined {
  if (!g.venue) return g.venueCity;
  const city = g.venueCity?.split(",")[0]?.trim();
  return city && !g.venue.includes(city) ? `${g.venue} · ${g.venueCity}` : g.venue;
}

export function isSCTeam(team: Team): boolean {
  return team.abbreviation === "SC" || team.displayName?.includes("South Carolina");
}

/** South Carolina's side of a game, plus the result once it's final. */
export function scView(game: Game) {
  const scHome = isSCTeam(game.homeTeam);
  const sc = scHome ? game.homeTeam : game.awayTeam;
  const opp = scHome ? game.awayTeam : game.homeTeam;
  const scScore = scHome ? game.homeScore : game.awayScore;
  const oppScore = scHome ? game.awayScore : game.homeScore;
  let result: "W" | "L" | "T" | undefined;
  if (getGameState(game) === "final" && scScore !== undefined && oppScore !== undefined) {
    result = scScore > oppScore ? "W" : scScore < oppScore ? "L" : "T";
  }
  return { scHome, sc, opp, scScore, oppScore, result };
}

async function getTeamSchedule(sport: Sport): Promise<{ games: Game[]; season?: any }> {
  const path = SPORT_PATHS[sport];
  const teamId = USC_TEAM_IDS[sport];
  // seasontype=2 (regular season) is required: without it ESPN returns zero
  // events for MBB before the season tips off.
  const data = await espnFetch(`${path}/teams/${teamId}/schedule?seasontype=2`);
  return {
    games: (data.events || []).map((e: any) => parseGame(e, sport)),
    season: data.requestedSeason ?? data.season,
  };
}

export async function getTeamData(sport: Sport): Promise<TeamData> {
  const path = SPORT_PATHS[sport];
  const teamId = USC_TEAM_IDS[sport];

  const [data, { games: schedule, season }] = await Promise.all([
    espnFetch(`${path}/teams/${teamId}`),
    getTeamSchedule(sport),
  ]);
  const team = data.team;

  const sortedSchedule = [...schedule].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const pastGames = sortedSchedule.filter((g) => getGameState(g) === "final");
  const futureGames = sortedSchedule.filter((g) => getGameState(g) === "upcoming");
  const liveGames = sortedSchedule.filter((g) => getGameState(g) === "live");
  const lastGame = pastGames[pastGames.length - 1];

  const items: any[] = team.record?.items ?? [];
  let overall: string | undefined =
    items.find((r) => r.type === "total")?.summary ?? items[0]?.summary;
  // Conference record: ESPN's own vsconf (team record, else SC's competitor record on
  // the latest final game); count SEC results from the schedule only as a last resort.
  let conference: string | undefined =
    items.find((r) => r.type === "vsconf")?.summary ??
    (lastGame ? scView(lastGame).sc.confRecord : undefined);
  if (!conference) {
    const conf = pastGames.filter((g) => g.isConference && scView(g).result);
    if (conf.length) {
      const w = conf.filter((g) => scView(g).result === "W").length;
      conference = `${w}-${conf.length - w}`;
    }
  }
  if (!overall && pastGames.length) {
    const results = pastGames.map((g) => scView(g).result).filter(Boolean);
    if (results.length) {
      overall = `${results.filter((r) => r === "W").length}-${results.filter((r) => r === "L").length}`;
    }
  }
  // Before the first game ESPN may say "0-0"; with nothing played that's "no record yet".
  if (!pastGames.length && !liveGames.length) {
    overall = undefined;
    conference = undefined;
  }

  return {
    team: {
      id: team.id,
      name: team.name,
      abbreviation: team.abbreviation,
      displayName: team.displayName,
      logo: pickLogo(team),
    },
    record: { overall, conference },
    seasonLabel: season?.displayName,
    seasonYear: season?.year,
    nextGame: liveGames[0] || futureGames[0],
    lastGame,
    schedule: sortedSchedule,
  };
}

export function formatBaseballStatus(game: Game): string {
  const period = game.status?.period;
  if (!period) return "";

  // ESPN displayClock for baseball often shows "Top 5th" or "Bot 5th" or "End 5th"
  const clock = game.status.displayClock;
  if (clock) {
    // If ESPN already gives us a formatted string like "Top 5th", use it
    const lower = clock.toLowerCase();
    if (lower.includes("top") || lower.includes("bot") || lower.includes("mid") || lower.includes("end")) {
      return clock;
    }
  }

  const suffix = period === 1 ? "st" : period === 2 ? "nd" : period === 3 ? "rd" : "th";
  return `${period}${suffix}`;
}

export function isBaseballSport(game: Game): boolean {
  return game.sport === "baseball";
}

export interface StandingsEntry {
  teamId: string;
  teamName: string;
  /** "South Carolina", "Ole Miss" */
  shortName: string;
  abbreviation: string;
  logo: string;
  overall: string;
  wins: number;
  losses: number;
  winPercent: string;
  /** Conference win percentage, e.g. ".233" */
  confWinPercent: string;
  streak: string;
}

export interface Standings {
  /** ESPN season year the table is for (it defaults to an OLD season unless asked) */
  season?: number;
  seasonLabel?: string;
  entries: StandingsEntry[];
}

/** SEC baseball standings for `season` (ESPN season year). Sorted by conference win %. */
export async function getBaseballStandings(season?: number): Promise<Standings> {
  const url = `${ESPN_WEB_BASE}/baseball/college-baseball/standings?level=3${season ? `&season=${season}` : ""}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN standings API error: ${res.status}`);

  const data = await res.json();

  let sec: any = null;
  for (const group of data.children || []) {
    for (const child of group.children || []) {
      if (child.id === "27" || child.name?.includes("Southeastern")) {
        sec = child.standings;
        break;
      }
    }
    if (sec) break;
  }

  const entries: StandingsEntry[] = (sec?.entries || []).map((entry: any) => {
    const team = entry.team || {};
    const stats: any[] = entry.stats || [];
    const stat = (name: string) => stats.find((s) => s.name === name);
    const str = (name: string) => stat(name)?.displayValue ?? "";
    const n = (name: string) => (typeof stat(name)?.value === "number" ? stat(name).value : NaN);
    const wins = n("wins");
    const losses = n("losses");
    const lp = n("leagueWinPercent");

    return {
      teamId: team.id || "",
      teamName: team.displayName || team.name || "",
      shortName: team.shortDisplayName || team.location || team.displayName || "",
      abbreviation: team.abbreviation || "",
      logo: pickLogo(team),
      overall: Number.isFinite(wins) && Number.isFinite(losses) ? `${wins}-${losses}` : str("overall"),
      wins,
      losses,
      winPercent: str("winPercent"),
      confWinPercent: Number.isFinite(lp) ? lp.toFixed(3).replace(/^0/, "") : "",
      streak: str("streak"),
    };
  });
  entries.sort((a, b) => {
    const ca = parseFloat(a.confWinPercent) || 0;
    const cb = parseFloat(b.confWinPercent) || 0;
    if (cb !== ca) return cb - ca;
    return (b.wins || 0) - (a.wins || 0);
  });
  return { season: sec?.season, seasonLabel: sec?.seasonDisplayName, entries };
}

export function getGameState(game: Game): "live" | "upcoming" | "final" {
  const state = game.status?.type?.state;

  if (state === "in") return "live";
  if (state === "post") return "final";
  if (state === "pre") return "upcoming";

  // Fallback: check if game date is in the past
  const gameDate = new Date(game.date);
  const now = new Date();
  if (gameDate < now) return "final";
  return "upcoming";
}
