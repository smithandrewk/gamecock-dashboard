/**
 * Replays real ESPN summaries through detect() snapshot by snapshot.
 *   npx tsx src/lib/push/__tests__/detect.replay.ts      (or: npm run test:push)
 * Exits non-zero on the first failed assertion.
 */
import assert from "node:assert/strict";

import { detect, tidyPlayText, type Alert, type GameState } from "../detect";
import { load, snapshot, type Snap } from "./helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

function run(full: any, snaps: Snap[], start: GameState | null = null) {
  let state = start;
  const timeline: { at: string; alerts: Alert[] }[] = [];
  for (const s of snaps) {
    const { events, nextState } = detect(state, snapshot(full, s), new Date(s.at), "football");
    // round-trip through JSON like the blob store does
    state = JSON.parse(JSON.stringify(nextState)) as GameState;
    timeline.push({ at: s.at, alerts: events });
  }
  return { timeline, state: state! };
}

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL ${name}\n     ${(e as Error).message.split("\n").join("\n     ")}`);
  }
}

const tenn = load("401856731"); // SC 27, TENN 24 (home), kickoff 2026-10-24T19:30Z
const uk = load("401856709"); // UK 35, SC 34

// Full Tennessee replay, one snapshot per scoring play plus key status moments.
const TENN_SNAPS: Snap[] = [
  { at: "2026-10-24T17:30:00Z", state: "pre", plays: 0 },
  { at: "2026-10-24T19:05:30Z", state: "pre", plays: 0 }, // 25 min out
  { at: "2026-10-24T19:10:00Z", state: "pre", plays: 0 }, // dup window
  { at: "2026-10-24T19:31:00Z", state: "in", period: 1, clock: "15:00", plays: 0 },
  { at: "2026-10-24T19:38:00Z", state: "in", period: 1, clock: "10:02", plays: 1 },
  { at: "2026-10-24T19:39:00Z", state: "in", period: 1, clock: "9:50", plays: 1 }, // repeat
  { at: "2026-10-24T19:42:00Z", state: "in", period: 1, clock: "8:17", plays: 2 },
  { at: "2026-10-24T20:05:00Z", state: "in", period: 2, clock: "14:12", plays: 3 },
  { at: "2026-10-24T20:20:00Z", state: "in", period: 2, clock: "8:06", plays: 4 },
  { at: "2026-10-24T20:40:00Z", state: "in", period: 2, clock: "1:44", plays: 5 },
  { at: "2026-10-24T20:46:00Z", state: "in", period: 2, clock: "0:24", plays: 6 },
  { at: "2026-10-24T20:50:00Z", state: "in", name: "STATUS_HALFTIME", period: 2, clock: "0:00", plays: 6 },
  { at: "2026-10-24T20:55:00Z", state: "in", name: "STATUS_HALFTIME", period: 2, clock: "0:00", plays: 6 },
  { at: "2026-10-24T21:15:00Z", state: "in", period: 3, clock: "15:00", plays: 6 },
  { at: "2026-10-24T22:00:00Z", state: "in", period: 4, clock: "11:46", plays: 7 },
  { at: "2026-10-24T22:20:00Z", state: "in", period: 4, clock: "4:58", plays: 7 },
  { at: "2026-10-24T22:21:00Z", state: "in", period: 4, clock: "4:12", plays: 7 },
  { at: "2026-10-24T22:32:00Z", state: "in", period: 4, clock: "1:17", plays: 8 },
  { at: "2026-10-24T22:40:00Z", state: "post", period: 4, clock: "0:00", plays: 9 },
  { at: "2026-10-24T22:41:00Z", state: "post", period: 4, clock: "0:00", plays: 9 },
];

const tennRun = run(tenn, TENN_SNAPS);
const all = tennRun.timeline.flatMap((t) => t.alerts);

console.log("\nTennessee replay (401856731) alert sequence:");
for (const t of tennRun.timeline)
  for (const a of t.alerts) console.log(`  ${t.at.slice(11, 16)}Z  [${a.kind}|${a.prefs.join(",")}] ${a.title} — ${a.body}`);
console.log("");

check("tidyPlayText", () => {
  assert.equal(
    tidyPlayText("Mazeo Bennett Jr. 17 Yd pass from LaNorris Sellers (Malik Orsan Kick)"),
    "Mazeo Bennett Jr. 17-yd pass from LaNorris Sellers",
  );
  assert.equal(tidyPlayText("Malik Orsan 48 Yd Field Goal "), "Malik Orsan 48-yd field goal");
  assert.equal(tidyPlayText("X 3 Yd Run (Y Kick Failed)"), "X 3-yd run (Y Kick Failed)");
});

check("expected alert sequence", () => {
  assert.deepEqual(
    all.map((a) => a.kind),
    [
      "kickoffSoon",
      "kickoff",
      "scScore",
      "scScore",
      "oppScore",
      "oppScore",
      "scScore",
      "oppScore", // lead change
      "halftime",
      "oppScore",
      "nailBiter",
      "scScore", // tie
      "scScore", // walk-off FG, lead change
      "final",
    ],
  );
});

check("no duplicate keys or tags", () => {
  const keys = all.map((a) => a.key);
  assert.equal(new Set(keys).size, keys.length, `dup keys: ${keys}`);
  const tags = all.map((a) => a.tag);
  assert.equal(new Set(tags).size, tags.length);
});

check("repeat snapshots produce nothing", () => {
  for (const i of [0, 2, 5, 12, 13, 16, 19]) assert.equal(tennRun.timeline[i].alerts.length, 0, `snap ${i}`);
});

check("copy", () => {
  const by = (k: string) => all.find((a) => a.key === k)!;
  assert.equal(all[0].title, "Kickoff in 25 min");
  assert.match(all[0].body, /^South Carolina vs Tennessee · 3:30 PM ET on ESPN$/);
  assert.equal(by("play:40185673164").title, "TOUCHDOWN Gamecocks!");
  assert.equal(
    by("play:40185673164").body,
    "Mazeo Bennett Jr. 17-yd pass from LaNorris Sellers. SC 7, TENN 0 · Q1 10:02",
  );
  assert.equal(by("play:401856731384").title, "Tennessee takes the lead");
  assert.deepEqual(by("play:401856731384").prefs, ["oppScores", "bigMoments"]);
  assert.equal(by("play:401856731264").title, "Tennessee ties it");
  assert.equal(by("halftime").title, "Halftime: SC 17, TENN 21");
  assert.equal(by("halftime").body, "Gamecocks trail by 4 at the break.");
  assert.equal(by("play:401856731823").title, "Gamecocks take the lead!");
  assert.equal(by("final").title, "Final: Gamecocks beat Tennessee");
  assert.equal(by("final").body, "South Carolina 27, Tennessee 24.");
  for (const a of all) assert.doesNotMatch(`${a.title} ${a.body}`, /\bUSC\b/);
});

check("final state", () => {
  assert.equal(tennRun.state.done, true);
  assert.equal(tennRun.state.plays.length, 9);
  assert.equal(tennRun.state.leader, "sc");
});

check("first sight mid-game seeds silently, then only new plays", () => {
  const r = run(tenn, [
    { at: "2026-10-24T21:15:00Z", state: "in", period: 3, clock: "15:00", plays: 6 },
    { at: "2026-10-24T21:16:00Z", state: "in", period: 3, clock: "14:00", plays: 6 },
    { at: "2026-10-24T22:00:00Z", state: "in", period: 4, clock: "11:46", plays: 7 },
  ]);
  assert.equal(r.timeline[0].alerts.length, 0);
  assert.equal(r.timeline[1].alerts.length, 0);
  assert.deepEqual(r.timeline[2].alerts.map((a) => a.key), ["play:401856731640"]);
  assert.equal(r.timeline[2].alerts[0].title, "Tennessee field goal");
});

check("first sight after final: silent", () => {
  const r = run(tenn, [{ at: "2026-10-24T22:45:00Z", state: "post", period: 4, plays: 9 }]);
  assert.equal(r.timeline[0].alerts.length, 0);
  assert.equal(r.state.done, true);
});

check("missed whole game (pre -> post): only the final", () => {
  const r = run(tenn, [
    { at: "2026-10-24T17:00:00Z", state: "pre", plays: 0 },
    { at: "2026-10-24T22:45:00Z", state: "post", period: 4, plays: 9 },
  ]);
  assert.deepEqual(r.timeline[1].alerts.map((a) => a.kind), ["final"]);
});

check("cron outage mid-game collapses a backlog into one update", () => {
  const r = run(tenn, [
    { at: "2026-10-24T19:42:00Z", state: "in", period: 1, clock: "8:17", plays: 2 },
    { at: "2026-10-24T20:47:00Z", state: "in", period: 2, clock: "0:20", plays: 6 },
  ]);
  assert.deepEqual(r.timeline[1].alerts.map((a) => a.kind), ["scoreUpdate"]);
  assert.equal(r.timeline[1].alerts[0].body, "SC 17, TENN 21 · Q2");
});

check("TBD kickoff never sends a kickoff-soon alert", () => {
  const r = run(tenn, [
    { at: "2026-11-14T04:40:00Z", state: "pre", plays: 0, date: "2026-11-14T05:00Z", timeValid: false },
    { at: "2026-11-14T04:50:00Z", state: "pre", plays: 0, date: "2026-11-14T05:00Z" },
  ]);
  assert.equal(r.timeline.flatMap((t) => t.alerts).length, 0);
});

check("Kentucky replay: loss final, no dups", () => {
  const n = uk.scoringPlays.length;
  const snaps: Snap[] = [{ at: "2026-10-01T00:00:00Z", state: "pre", plays: 0 }];
  snaps.push({ at: "2026-10-01T00:00:00Z", state: "in", period: 1, clock: "15:00", plays: 0 });
  for (let i = 1; i <= n; i++) {
    const p = uk.scoringPlays[i - 1];
    snaps.push({ at: "2026-10-01T01:00:00Z", state: "in", period: p.period.number, clock: p.clock.displayValue, plays: i });
  }
  snaps.push({ at: "2026-10-01T04:00:00Z", state: "post", period: 4, plays: n });
  const r = run(uk, snaps);
  const a = r.timeline.flatMap((t) => t.alerts);
  const keys = a.map((x) => x.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(a.filter((x) => x.key.startsWith("play:")).length, n);
  const fin = a.find((x) => x.kind === "final")!;
  assert.equal(fin.title, "Final: Gamecocks fall to Kentucky");
  assert.equal(fin.body, "Kentucky 35, South Carolina 34.");
  console.log("\n  Kentucky replay alerts:");
  for (const x of a) console.log(`    [${x.kind}] ${x.title} — ${x.body}`);
  console.log("");
});

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
