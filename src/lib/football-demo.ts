/* eslint-disable @typescript-eslint/no-explicit-any -- mutating a raw ESPN JSON fixture */
// Review-only hero states for ?demo=live|pregame|final. Built from the real ESPN summary
// of Tennessee at South Carolina (401856731, SC won 27-24) saved in src/lib/fixtures.
// Without a ?demo= param none of this is used.
import fixture from "@/lib/fixtures/football-401856731.json";
import { parseFootballSummary, type FBSummary, type FBTeam } from "@/lib/football";

export type DemoMode = "live" | "pregame" | "final";

export function parseDemoMode(v: string | null | undefined): DemoMode | null {
  return v === "live" || v === "pregame" || v === "final" ? v : null;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Undo one result on an "W-L" record string (pre-game records for the pregame demo). */
function minusGame(record: string | undefined, won: boolean | undefined): string | undefined {
  const m = record?.match(/^(\d+)-(\d+)$/);
  if (!m || won === undefined) return record;
  const w = Number(m[1]) - (won ? 1 : 0);
  const l = Number(m[2]) - (won ? 0 : 1);
  return `${w}-${l}`;
}

function finalDemo(): FBSummary {
  return { ...parseFootballSummary(clone(fixture)), demo: true };
}

/**
 * Frozen in the 3rd quarter at 9:11: SC ball, 2nd & 13 at SC 27, Tennessee up 21-17.
 * Situation, last play and win probability are the real ESPN values for that snap.
 */
function liveDemo(): FBSummary {
  const raw: any = clone(fixture);
  const comp = raw.header.competitions[0];
  const plays = raw.drives.previous[0].plays;
  const prev = plays[0]; // the snap just run
  const now = plays[1]; // the snap about to be run
  comp.status = {
    type: {
      id: "2",
      name: "STATUS_IN_PROGRESS",
      state: "in",
      completed: false,
      description: "In Progress",
      detail: `${now.clock.displayValue} - 3rd Quarter`,
      shortDetail: `${now.clock.displayValue} - 3rd`,
    },
    displayClock: now.clock.displayValue,
    period: 3,
  };
  raw.scoringPlays = raw.scoringPlays.filter((p: any) => p.period.number <= 2);
  const last = raw.scoringPlays[raw.scoringPlays.length - 1];
  for (const c of comp.competitors) {
    const home = c.homeAway === "home";
    c.score = String(home ? last.homeScore : last.awayScore);
    c.linescores = c.linescores.slice(0, 2).concat([{ displayValue: "0" }]);
    c.possession = c.id === "2579";
    delete c.winner;
  }
  const wp = raw.winprobability.find((w: any) => w.playId === prev.id);
  raw.winprobability = wp ? [wp] : [];
  raw.situation = {
    downDistanceText: now.start.downDistanceText,
    possession: "2579",
    isRedZone: false,
    lastPlay: { text: prev.text.replace(/^\(\d+:\d+\)\s*/, "") },
  };
  // Box score and leaders in the fixture are full-game numbers; don't show them mid-game.
  raw.boxscore = { teams: [] };
  raw.leaders = [];
  return { ...parseFootballSummary(raw), demo: true };
}

/** Same matchup as a future game: kickoff next Saturday at the real 3:30 PM ET slot. */
function pregameDemo(nowMs = Date.now()): FBSummary {
  const s = parseFootballSummary(clone(fixture));
  const now = new Date(nowMs);
  const kick = new Date(now);
  kick.setUTCDate(now.getUTCDate() + ((6 - now.getUTCDay() + 7) % 7 || 7));
  kick.setUTCHours(19, 30, 0, 0); // 19:30Z, the real kickoff slot (3:30 PM EDT)
  const reset = (t: FBTeam): FBTeam => ({
    ...t,
    score: undefined,
    winner: undefined,
    linescores: [],
    record: minusGame(t.record, t.winner),
    confRecord: minusGame(t.confRecord, t.winner),
  });
  const home = reset(s.game.home);
  const away = reset(s.game.away);
  return {
    ...s,
    game: {
      ...s.game,
      date: kick.toISOString(),
      state: "pre",
      completed: false,
      detail: "Scheduled",
      shortDetail: "Scheduled",
      period: undefined,
      clock: undefined,
      home,
      away,
      sc: s.game.scHome ? home : away,
      opp: s.game.scHome ? away : home,
      result: undefined,
    },
    scoringPlays: [],
    teamStats: [],
    leaders: [],
    scWinProb: undefined,
    attendance: undefined,
    demo: true,
  };
}

export function getDemoSummary(mode: DemoMode): FBSummary {
  if (mode === "live") return liveDemo();
  if (mode === "pregame") return pregameDemo();
  return finalDemo();
}
