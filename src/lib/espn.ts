const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

// USC team IDs
export const USC_TEAM_IDS = {
  mbb: "2579", // Men's Basketball
  wbb: "2579", // Women's Basketball (same ID, different endpoint)
} as const;

export type Sport = "mbb" | "wbb";

const SPORT_PATHS: Record<Sport, string> = {
  mbb: "basketball/mens-college-basketball",
  wbb: "basketball/womens-college-basketball",
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

function parseGame(event: any): Game {
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

  // SEC team abbreviations for fallback conference detection
  const SEC_TEAMS = [
    "ALA", "ARK", "AUB", "FLA", "UGA", "UK", "LSU", "MISS", "MSST",
    "MIZZ", "SC", "TENN", "TAMU", "VAN", "OKLA", "TEX",
    // Alternative abbreviations
    "BAMA", "KENTUCKY", "OLE MISS", "TEXAS", "OKLAHOMA"
  ];

  const homeAbbr = homeCompetitor?.team?.abbreviation?.toUpperCase();
  const awayAbbr = awayCompetitor?.team?.abbreviation?.toUpperCase();
  const bothSEC = SEC_TEAMS.includes(homeAbbr) && SEC_TEAMS.includes(awayAbbr);

  // Check if conference game - ESPN marks this in conferenceCompetition or notes
  const isConference =
    competition?.conferenceCompetition === true ||
    event.notes?.some((n: any) => n.headline?.includes("SEC")) ||
    competition?.notes?.some((n: any) => n.headline?.includes("SEC")) ||
    bothSEC;

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
  };
}

export async function getTeamSchedule(sport: Sport): Promise<Game[]> {
  const path = SPORT_PATHS[sport];
  const teamId = USC_TEAM_IDS[sport];
  const url = `${ESPN_BASE}/${path}/teams/${teamId}/schedule`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN API error: ${res.status}`);

  const data = await res.json();
  return (data.events || []).map(parseGame);
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
  return (data.events || []).map(parseGame);
}

export function isUSCGame(game: Game): boolean {
  return (
    game.homeTeam.abbreviation === "SC" ||
    game.awayTeam.abbreviation === "SC" ||
    game.homeTeam.displayName.includes("South Carolina") ||
    game.awayTeam.displayName.includes("South Carolina")
  );
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
