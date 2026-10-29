/**
 * End-to-end cron tick against an in-memory store, mocked ESPN fetch and mocked web-push.
 *   npx tsx src/lib/push/__tests__/notify.test.ts
 */
import assert from "node:assert/strict";

import { DEFAULT_PREFS, type PushPrefs } from "../prefs";
import { runNotify } from "../notify";
import type { Sender } from "../send";
import { memoryStore, type SubRecord } from "../store";
import { load, snapshot, type Snap } from "./helpers";

const tenn = load("401856731");
const EVENT = "401856731";

const store = memoryStore();
const sub = (id: string, prefs: Partial<PushPrefs>): SubRecord => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
  keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) },
  prefs: { ...DEFAULT_PREFS, ...prefs },
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
});
async function main() {
await store.putSub(sub("fan", {})); // defaults: SC scores, no opp scores
await store.putSub(sub("everything", { oppScores: true }));
await store.putSub(sub("wbb-only", { sports: ["wbb"] }));
await store.putSub(sub("gone", {})); // push service says 410

const deliveries: { who: string; title: string; ttl: number; topic?: string }[] = [];
const sender: Sender = async (s, payload, opts) => {
  const who = s.endpoint.split("/").pop()!;
  if (who === "gone") return { statusCode: 410 };
  const p = JSON.parse(payload);
  assert.ok(p.title && p.body && p.tag && p.url === "/");
  deliveries.push({ who, title: p.title, ttl: opts.TTL, topic: opts.topic });
  return { statusCode: 201 };
};

let snap: Snap = { at: "", state: "pre", plays: 0 };
const fetchJson = async (url: string) => {
  if (url.includes("/schedule")) {
    if (url.includes("seasontype=3")) throw new Error("ESPN 404");
    return {
      events: [
        {
          id: EVENT,
          date: "2026-10-24T19:30Z",
          competitions: [{ status: { type: { state: snap.state } } }],
        },
      ],
    };
  }
  if (url.includes(`summary?event=${EVENT}`)) return snapshot(tenn, snap);
  throw new Error(`unexpected ${url}`);
};

async function tick(s: Snap) {
  snap = s;
  return runNotify({ now: new Date(s.at), store, sender, fetchJson, sports: ["football"] });
}

const r0 = await tick({ at: "2026-10-24T17:00:00Z", state: "pre", plays: 0 });
assert.equal(r0.games.length, 0, "game 2.5h out is not a candidate");
const r1 = await tick({ at: "2026-10-24T19:05:30Z", state: "pre", plays: 0 });
assert.deepEqual(r1.games[0].alerts, ["kickoffSoon"]);
assert.equal(r1.delivery.gone, 1, "410 subscription pruned");
assert.equal(await store.getSub("https://fcm.googleapis.com/fcm/send/gone"), null);
const r1b = await tick({ at: "2026-10-24T19:06:30Z", state: "pre", plays: 0 });
assert.deepEqual(r1b.games[0].alerts, [], "no repeat");
await tick({ at: "2026-10-24T19:31:00Z", state: "in", period: 1, clock: "15:00", plays: 0 });
await tick({ at: "2026-10-24T19:38:00Z", state: "in", period: 1, clock: "10:02", plays: 1 });
await tick({ at: "2026-10-24T20:05:00Z", state: "in", period: 2, clock: "14:12", plays: 3 });
await tick({ at: "2026-10-24T20:05:00Z", state: "in", period: 2, clock: "14:12", plays: 3 }); // same tick re-run
const fin = await tick({ at: "2026-10-24T22:40:00Z", state: "post", period: 4, plays: 9 });
assert.ok(fin.games[0].alerts.includes("final"));
const after = await tick({ at: "2026-10-24T22:41:00Z", state: "post", period: 4, plays: 9 });
assert.equal(after.games[0].note, "done", "finished game is skipped without a summary fetch");

const by = (who: string) => deliveries.filter((d) => d.who === who).map((d) => d.title);
console.log("fan got:       ", by("fan"));
console.log("everything got:", by("everything"));
assert.equal(by("wbb-only").length, 0, "football alerts never reach a wbb-only subscriber");
assert.ok(!by("fan").some((t) => t.startsWith("Tennessee touchdown")), "fan has oppScores off");
assert.ok(by("everything").includes("Tennessee touchdown"));
const keysPerWho = new Map<string, string[]>();
for (const d of deliveries) keysPerWho.set(d.who, [...(keysPerWho.get(d.who) ?? []), d.title + d.topic]);
for (const [who, list] of keysPerWho) assert.equal(new Set(list).size, list.length, `dup delivery to ${who}`);
assert.ok(deliveries.every((d) => d.topic && d.topic.length <= 32 && /^[A-Za-z0-9_-]+$/.test(d.topic)));
assert.equal(deliveries.find((d) => d.title === "Kickoff in 25 min")!.ttl, 1470);

// Conditional-write race: a second runner holding a stale etag must not send.
const st = await store.getState("football", EVENT);
assert.ok(st && st.state.done);
assert.equal(await store.putState(st.state, "stale-etag"), false);

console.log("\nnotify test passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
