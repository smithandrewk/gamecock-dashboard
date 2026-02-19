const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

// USC team IDs
export const USC_TEAM_IDS = {
  mbb: "2579", // Men's Basketball
  wbb: "2579", // Women's Basketball (same ID, different endpoint)
  baseball: "193", // Baseball (different ID than basketball)
} as const;

export type Sport = "mbb" | "wbb" | "baseball";

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
  rank?: number;
}

export interface Game {
  id: string;
  date: string;
  name: string;
  status: {
    type: {
      id: string;
      name: string;
      state: "pre" | "in" | "post";
      completed: boolean;
    };
    displayClock?: string;
    period?: number;
  };
  homeTeam: Team;
  awayTeam: Team;
  homeScore?: number;
  awayScore?: number;
  venue?: string;
  broadcast?: string;
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
  record: {
    overall: string;
    conference: string;
  };
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

function parseTeam(teamData: any, isHome: boolean): Team {
  const team = teamData.team || teamData;
  const rawRank = teamData.curatedRank?.current;
  // ESPN returns 99 for unranked teams - only show actual top 25 rankings
  const rank = rawRank && rawRank <= 25 ? rawRank : undefined;

  return {
    id: team.id,
    name: team.name || team.shortDisplayName,
    abbreviation: team.abbreviation,
    displayName: team.displayName,
    logo: team.logo || team.logos?.[0]?.href || "",
    record: teamData.records?.[0]?.summary,
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

  const odds = competition?.odds?.[0];
  const broadcast =
    competition?.broadcasts?.[0]?.names?.[0] ||
    competition?.geoBroadcasts?.[0]?.media?.shortName;

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
    name: event.name,
    status: {
      type: {
        id: event.status?.type?.id,
        name: event.status?.type?.name,
        state: event.status?.type?.state,
        completed: event.status?.type?.completed,
      },
      displayClock: event.status?.displayClock,
      period: event.status?.period,
    },
    homeTeam: parseTeam(homeCompetitor, true),
    awayTeam: parseTeam(awayCompetitor, false),
    homeScore: parseScore(homeCompetitor),
    awayScore: parseScore(awayCompetitor),
    venue: competition?.venue?.fullName,
    broadcast,
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

export async function getTeamSchedule(sport: Sport): Promise<Game[]> {
  const path = SPORT_PATHS[sport];
  const teamId = USC_TEAM_IDS[sport];
  const url = `${ESPN_BASE}/${path}/teams/${teamId}/schedule`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN API error: ${res.status}`);

  const data = await res.json();
  return (data.events || []).map((e: any) => parseGame(e, sport));
}

export async function getTeamData(sport: Sport): Promise<TeamData> {
  const path = SPORT_PATHS[sport];
  const teamId = USC_TEAM_IDS[sport];
  const url = `${ESPN_BASE}/${path}/teams/${teamId}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN API error: ${res.status}`);

  const data = await res.json();
  const team = data.team;

  const schedule = await getTeamSchedule(sport);
  const now = new Date();

  const sortedSchedule = [...schedule].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const pastGames = sortedSchedule.filter(
    (g) => getGameState(g) === "final"
  );
  const futureGames = sortedSchedule.filter(
    (g) => getGameState(g) === "upcoming"
  );
  const liveGames = sortedSchedule.filter((g) => getGameState(g) === "live");

  // Calculate conference record from games if API doesn't provide it
  const apiConfRecord = team.record?.items?.find((r: any) => r.type === "vsconf")?.summary;

  let confRecord = apiConfRecord;
  if (!apiConfRecord || apiConfRecord === "0-0") {
    // Calculate from schedule
    let confWins = 0;
    let confLosses = 0;

    for (const game of pastGames) {
      if (game.isConference) {
        const isHomeUSC = game.homeTeam.abbreviation === "SC" ||
          game.homeTeam.displayName.includes("South Carolina");
        const uscScore = isHomeUSC ? game.homeScore : game.awayScore;
        const oppScore = isHomeUSC ? game.awayScore : game.homeScore;

        if (uscScore !== undefined && oppScore !== undefined) {
          if (uscScore > oppScore) confWins++;
          else confLosses++;
        }
      }
    }

    if (confWins > 0 || confLosses > 0) {
      confRecord = `${confWins}-${confLosses}`;
    }
  }

  return {
    team: {
      id: team.id,
      name: team.name,
      abbreviation: team.abbreviation,
      displayName: team.displayName,
      logo: team.logos?.[0]?.href || "",
    },
    record: {
      overall: team.record?.items?.[0]?.summary || "0-0",
      conference: confRecord || "0-0",
    },
    nextGame: liveGames[0] || futureGames[0],
    lastGame: pastGames[pastGames.length - 1],
    schedule: sortedSchedule,
  };
}

export async function getScoreboard(sport: Sport): Promise<Game[]> {
  const path = SPORT_PATHS[sport];
  const url = `${ESPN_BASE}/${path}/scoreboard`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN API error: ${res.status}`);

  const data = await res.json();
  return (data.events || []).map((e: any) => parseGame(e, sport));
}

export function isUSCGame(game: Game): boolean {
  return (
    game.homeTeam.abbreviation === "SC" ||
    game.awayTeam.abbreviation === "SC" ||
    game.homeTeam.displayName.includes("South Carolina") ||
    game.awayTeam.displayName.includes("South Carolina")
  );
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
  abbreviation: string;
  logo: string;
  overall: string;
  wins: number;
  losses: number;
  winPercent: string;
  streak: string;
  runDifferential: string;
}

export async function getBaseballStandings(): Promise<StandingsEntry[]> {
  const url = "https://site.web.api.espn.com/apis/v2/sports/baseball/college-baseball/standings?level=3";

  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN standings API error: ${res.status}`);

  const data = await res.json();

  // Navigate to SEC: children[0].children -> find SEC (id 27 or name containing "Southeastern")
  let secEntries: any[] = [];
  for (const group of data.children || []) {
    for (const child of group.children || []) {
      if (child.id === "27" || child.name?.includes("Southeastern")) {
        secEntries = child.standings?.entries || [];
        break;
      }
    }
    if (secEntries.length > 0) break;
  }

  return secEntries.map((entry: any) => {
    const team = entry.team || {};
    const stats = entry.stats || [];

    const getStat = (name: string): string => {
      const stat = stats.find((s: any) => s.name === name || s.abbreviation === name);
      return stat?.displayValue ?? stat?.value?.toString() ?? "0";
    };
    const getStatNum = (name: string): number => {
      const stat = stats.find((s: any) => s.name === name || s.abbreviation === name);
      return stat?.value ?? 0;
    };

    return {
      teamId: team.id || "",
      teamName: team.displayName || team.name || "",
      abbreviation: team.abbreviation || "",
      logo: team.logos?.[0]?.href || "",
      overall: `${getStat("wins")}-${getStat("losses")}`,
      wins: getStatNum("wins"),
      losses: getStatNum("losses"),
      winPercent: getStat("winPercent"),
      streak: getStat("streak"),
      runDifferential: getStat("pointDifferential"),
    };
  }).sort((a, b) => {
    // Sort by win%, then wins as tiebreaker
    const wpA = parseFloat(a.winPercent) || 0;
    const wpB = parseFloat(b.winPercent) || 0;
    if (wpB !== wpA) return wpB - wpA;
    return b.wins - a.wins;
  });
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
