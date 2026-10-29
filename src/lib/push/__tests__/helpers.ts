import { readFileSync } from "node:fs";
import { join } from "node:path";

/* eslint-disable @typescript-eslint/no-explicit-any */
const FIX = join(__dirname, "fixtures");
export const load = (id: string) => JSON.parse(readFileSync(join(FIX, `summary-${id}.json`), "utf8"));

export type Snap = {
  at: string; // wall clock "now"
  state: "pre" | "in" | "post";
  name?: string; // STATUS_*
  period?: number;
  clock?: string;
  plays: number; // number of scoringPlays visible
  date?: string; // override kickoff ISO
  timeValid?: boolean;
};

/** Build an ESPN-shaped summary as it would have looked at that moment. */
export function snapshot(full: any, s: Snap) {
  const d = structuredClone(full);
  const comp = d.header.competitions[0];
  d.scoringPlays = full.scoringPlays.slice(0, s.plays);
  const last = d.scoringPlays[d.scoringPlays.length - 1];
  for (const c of comp.competitors) {
    if (s.state === "pre") delete c.score;
    else c.score = String(last ? (c.homeAway === "home" ? last.homeScore : last.awayScore) : 0);
    if (s.state !== "post") delete c.winner;
  }
  if (s.date) comp.date = s.date;
  if (s.timeValid !== undefined) comp.timeValid = s.timeValid;
  const name =
    s.name ?? (s.state === "pre" ? "STATUS_SCHEDULED" : s.state === "in" ? "STATUS_IN_PROGRESS" : "STATUS_FINAL");
  comp.status = {
    period: s.period ?? 0,
    displayClock: s.clock ?? "0:00",
    type: {
      name,
      state: s.state,
      completed: s.state === "post" && name === "STATUS_FINAL",
      detail: s.state === "post" ? "Final" : "",
      shortDetail: "",
    },
  };
  return d;
}

