/** One cron tick: find South Carolina games, detect new events, fan out pushes. */
import { detect, type Alert, type GameState } from "./detect";
import { fetchJson as defaultFetch, findCandidates, summaryUrl, type FetchJson } from "./espn-server";
import { PUSH_SPORTS, type PushSport } from "./prefs";
import { fanOut, webPushSender, type FanOutResult, type Sender } from "./send";
import { blobStore, type PushStore, type SubRecord } from "./store";

export type NotifyDeps = {
  now?: Date;
  store?: PushStore;
  sender?: Sender;
  fetchJson?: FetchJson;
  sports?: readonly PushSport[];
};

export type GameReport = {
  sport: PushSport;
  eventId: string;
  phase?: string;
  alerts: string[];
  note?: string;
};

export type NotifyReport = {
  ok: boolean;
  at: string;
  games: GameReport[];
  delivery: FanOutResult & { subscribers: number };
  errors: string[];
};

function sameState(a: GameState, b: GameState) {
  return JSON.stringify({ ...a, updatedAt: "" }) === JSON.stringify({ ...b, updatedAt: "" });
}

export async function runNotify(deps: NotifyDeps = {}): Promise<NotifyReport> {
  const now = deps.now ?? new Date();
  const store = deps.store ?? blobStore;
  const sender = deps.sender ?? webPushSender;
  const get = deps.fetchJson ?? defaultFetch;
  const games: GameReport[] = [];
  const errors: string[] = [];
  const pending: Alert[] = [];

  for (const sport of deps.sports ?? PUSH_SPORTS) {
    let cands;
    try {
      cands = await findCandidates(sport, now, get);
    } catch (e) {
      errors.push(`${sport}: schedule: ${(e as Error).message}`);
      continue;
    }
    for (const c of cands) {
      const report: GameReport = { sport, eventId: c.eventId, alerts: [] };
      games.push(report);
      try {
        const prev = await store.getState(sport, c.eventId);
        if (prev?.state.done) {
          report.phase = "post";
          report.note = "done";
          continue;
        }
        const summary = await get(summaryUrl(sport, c.eventId));
        const { events, nextState } = detect(prev?.state ?? null, summary, now, sport);
        report.phase = nextState.phase;
        if (prev && sameState(prev.state, nextState)) continue;
        // Claim the events by saving state BEFORE sending: an overlapping run that loses the
        // conditional write sends nothing, so no subscriber gets a duplicate.
        const won = await store.putState(nextState, prev?.etag ?? null);
        if (!won) {
          report.note = "another run claimed this tick";
          continue;
        }
        report.alerts = events.map((a) => a.kind);
        if (!prev && nextState.phase !== "pre") report.note = "seeded silently";
        pending.push(...events);
      } catch (e) {
        errors.push(`${sport} ${c.eventId}: ${(e as Error).message}`);
      }
    }
  }

  let subs: SubRecord[] = [];
  let delivery: FanOutResult = { sent: 0, gone: 0, failed: 0 };
  if (pending.length) {
    try {
      subs = await store.listSubs();
      delivery = await fanOut(store, sender, subs, pending, now.getTime());
    } catch (e) {
      errors.push(`delivery: ${(e as Error).message}`);
    }
  }

  return {
    ok: errors.length === 0,
    at: now.toISOString(),
    games,
    delivery: { ...delivery, subscribers: subs.length },
    errors,
  };
}
