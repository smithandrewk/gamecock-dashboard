import type { PushSport } from "./prefs";

export type SportConfig = {
  sport: PushSport;
  /** ESPN path segment, e.g. football/college-football */
  path: string;
  /** South Carolina's ESPN team id for this sport. */
  teamId: string;
  /** Regulation periods (quarters / halves / innings). */
  regulation: number;
  /** Period after which halftime has passed (0 = no halftime). */
  halfPeriod: number;
  /** Words used in copy. */
  start: string; // "Kickoff" / "Tipoff" / "First pitch"
  startVerb: string; // "kick off" / "tip off" / "first pitch"
  /** Whether summary.scoringPlays exists and is worth alerting per play. */
  perPlayScores: boolean;
  /** Seasontypes to merge when reading the team schedule (football: regular + bowls). */
  seasontypes: (number | null)[];
};

export const SPORTS: Record<PushSport, SportConfig> = {
  football: {
    sport: "football",
    path: "football/college-football",
    teamId: "2579",
    regulation: 4,
    halfPeriod: 2,
    start: "Kickoff",
    startVerb: "kick off",
    perPlayScores: true,
    seasontypes: [2, 3],
  },
  wbb: {
    sport: "wbb",
    path: "basketball/womens-college-basketball",
    teamId: "2579",
    regulation: 4,
    halfPeriod: 2,
    start: "Tipoff",
    startVerb: "tip off",
    perPlayScores: false,
    seasontypes: [null],
  },
  mbb: {
    sport: "mbb",
    path: "basketball/mens-college-basketball",
    teamId: "2579",
    regulation: 2,
    halfPeriod: 1,
    start: "Tipoff",
    startVerb: "tip off",
    perPlayScores: false,
    seasontypes: [null],
  },
  baseball: {
    sport: "baseball",
    path: "baseball/college-baseball",
    teamId: "193",
    regulation: 9,
    halfPeriod: 0,
    start: "First pitch",
    startVerb: "start",
    perPlayScores: false,
    seasontypes: [null],
  },
};
