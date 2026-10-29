/**
 * Pure game-event detection for push alerts.
 *
 *   detect(prevState, espnSummary, now, sport) -> { events, nextState }
 *
 * No I/O. The cron loads prevState from blob storage, fetches the ESPN summary, calls this,
 * sends `events`, then saves `nextState`. Every alert has a stable `key`; keys go into
 * `nextState.sent`, so re-running on the same (or an older) snapshot never re-alerts.
 *
 * First sight of a game that is already in progress (prevState === null and state !== "pre")
 * seeds state silently: no backlog of old scoring plays, only new events after that.
 */
import type { PrefKey, PushSport } from "./prefs";
import { SPORTS, type SportConfig } from "./sports";

export type Phase = "pre" | "in" | "post";
export type Leader = "sc" | "opp";

export type GameState = {
  v: 1;
  sport: PushSport;
  eventId: string;
  phase: Phase;
  /** Dedup keys of alerts already sent (or deliberately suppressed). */
  sent: string[];
  /** Scoring play ids already processed. */
  plays: string[];
  scScore: number | null;
  oppScore: number | null;
  /** Last team to hold an outright lead (ties don't reset it). */
  leader: Leader | null;
  /** Game over (final, postponed, canceled): the cron can stop fetching it. */
  done: boolean;
  updatedAt: string;
};

export type AlertKind =
  | "kickoffSoon"
  | "kickoff"
  | "scScore"
  | "oppScore"
  | "scoreUpdate"
  | "halftime"
  | "overtime"
  | "nailBiter"
  | "final";

export type Alert = {
  key: string;
  kind: AlertKind;
  /** Send to a subscriber if ANY of these prefs is on. */
  prefs: PrefKey[];
  title: string;
  body: string;
  /** Notification tag: one per game + event, so a re-delivery collapses. */
  tag: string;
  url: string;
  /** Seconds the push service may hold the message for an offline device. */
  ttl: number;
  urgency: "normal" | "high";
  sport: PushSport;
  eventId: string;
};

export type DetectResult = { events: Alert[]; nextState: GameState };

// ---------------------------------------------------------------------------
// ESPN summary normalization (tolerant: ESPN omits fields freely)
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

type ScoringPlay = {
  id: string;
  teamId: string;
  type: string; // TD | FG | SF | ...
  typeText: string;
  text: string;
  homeScore: number;
  awayScore: number;
  period: number;
  clock: string;
};

export type NormalizedGame = {
  eventId: string;
  state: Phase;
  statusName: string;
  completed: boolean;
  period: number;
  clockSec: number | null;
  displayClock: string;
  startMs: number | null;
  timeTbd: boolean;
  scHome: boolean;
  scScore: number | null;
  oppScore: number | null;
  oppName: string;
  oppAbbr: string;
  city: string | null;
  broadcast: string | null;
  plays: ScoringPlay[];
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseClock(display: unknown, raw: unknown): number | null {
  if (typeof display === "string") {
    const m = display.match(/^(\d+):(\d{2})(?:\.\d+)?$/);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    const s = display.match(/^(\d+(?:\.\d+)?)$/);
    if (s) return Number(s[1]);
  }
  return num(raw);
}

/** Kickoff time is TBD when ESPN parks it at 05:00Z, says TBD, or sets timeValid false. */
export function isTimeTbd(dateIso: string | undefined, comp: Json): boolean {
  const detail = `${comp?.status?.type?.detail ?? ""} ${comp?.status?.type?.shortDetail ?? ""}`;
  if (/\bTBD\b/i.test(detail)) return true;
  if (comp?.timeValid === false) return true;
  if (dateIso && /T05:00(:00)?(\.000)?Z$/.test(dateIso)) return true;
  return false;
}

export function normalizeSummary(summary: Json, cfg: SportConfig): NormalizedGame {
  const comp = summary?.header?.competitions?.[0];
  if (!comp) throw new Error("ESPN summary has no header.competitions[0]");
  const competitors: Json[] = comp.competitors ?? [];
  const sc = competitors.find((c) => String(c.id ?? c.team?.id) === cfg.teamId);
  const opp = competitors.find((c) => String(c.id ?? c.team?.id) !== cfg.teamId);
  if (!sc || !opp) throw new Error(`South Carolina (${cfg.teamId}) not in this game`);

  const st = comp.status ?? {};
  const type = st.type ?? {};
  const rawState = String(type.state ?? "pre");
  const state: Phase = rawState === "in" || rawState === "post" ? rawState : "pre";
  const dateIso: string | undefined = comp.date ?? summary?.header?.competitions?.[0]?.date;
  const startMs = dateIso ? Date.parse(dateIso) : NaN;
  const broadcasts: Json[] = comp.broadcasts ?? [];
  const tv = broadcasts.find((b) => b?.type?.shortName === "TV") ?? broadcasts[0];

  const plays: ScoringPlay[] = cfg.perPlayScores
    ? ((summary?.scoringPlays ?? []) as Json[])
        .filter((p) => p && p.id != null)
        .map((p) => ({
          id: String(p.id),
          teamId: String(p.team?.id ?? ""),
          type: String(p.scoringType?.abbreviation ?? p.type?.abbreviation ?? ""),
          typeText: String(p.scoringType?.displayName ?? p.type?.text ?? ""),
          text: String(p.text ?? ""),
          homeScore: num(p.homeScore) ?? 0,
          awayScore: num(p.awayScore) ?? 0,
          period: num(p.period?.number) ?? 0,
          clock: String(p.clock?.displayValue ?? ""),
        }))
    : [];

  return {
    eventId: String(summary?.header?.id ?? comp.id ?? ""),
    state,
    statusName: String(type.name ?? ""),
    completed: type.completed === true,
    period: num(st.period) ?? 0,
    clockSec: parseClock(st.displayClock, st.clock),
    displayClock: String(st.displayClock ?? ""),
    startMs: Number.isFinite(startMs) ? startMs : null,
    timeTbd: isTimeTbd(dateIso, comp),
    scHome: sc.homeAway === "home",
    scScore: num(sc.score),
    oppScore: num(opp.score),
    oppName: String(opp.team?.location ?? opp.team?.shortDisplayName ?? opp.team?.displayName ?? "Opponent"),
    oppAbbr: String(opp.team?.abbreviation ?? opp.team?.location ?? "OPP"),
    city: summary?.gameInfo?.venue?.address?.city ?? null,
    broadcast: tv?.media?.shortName ?? null,
    plays,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Copy helpers
// ---------------------------------------------------------------------------

const ET = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
});

function scoreLine(g: { oppAbbr: string }, sc: number | null, opp: number | null) {
  return `SC ${sc ?? 0}, ${g.oppAbbr} ${opp ?? 0}`;
}

function periodLabel(sport: PushSport, period: number): string {
  const cfg = SPORTS[sport];
  if (sport === "baseball") return `inning ${period}`;
  if (period > cfg.regulation) {
    const n = period - cfg.regulation;
    return n === 1 ? "OT" : `${n}OT`;
  }
  if (sport === "mbb") return period === 1 ? "1st half" : "2nd half";
  return `Q${period}`;
}

/** "LaNorris Sellers 31 Yd Run (Malik Orsan Kick)" -> "LaNorris Sellers 31-yd run" */
export function tidyPlayText(text: string): string {
  let t = text.replace(/\s+/g, " ").trim();
  // Drop a successful PAT parenthetical; keep failed/2-pt info.
  t = t.replace(/\s*\(([^)]*)\)\s*$/, (m, inner: string) =>
    /kick\s*$/i.test(inner) && !/fail|block|miss|no good/i.test(inner) ? "" : m,
  );
  t = t.replace(/(\d+) Yds? /g, "$1-yd ");
  t = t.replace(
    /\b(Run|Pass|Field Goal|Interception Return|Fumble Return|Punt Return|Kickoff Return|Blocked Punt Return|Blocked Field Goal Return|Return|Fumble Recovery)\b/g,
    (w) => w.toLowerCase(),
  );
  return t.replace(/\s+$/, "");
}

function vsAt(g: NormalizedGame) {
  return `South Carolina ${g.scHome ? "vs" : "at"} ${g.oppName}`;
}

function marginText(sc: number, opp: number) {
  if (sc === opp) return "all square";
  const d = Math.abs(sc - opp);
  return sc > opp ? `Gamecocks lead by ${d}` : `Gamecocks trail by ${d}`;
}

function leaderOf(sc: number | null, opp: number | null): Leader | null {
  if (sc === null || opp === null || sc === opp) return null;
  return sc > opp ? "sc" : "opp";
}

// ---------------------------------------------------------------------------
// detect
// ---------------------------------------------------------------------------

export const KICKOFF_SOON_MIN = 30;
/** More new scoring plays than this in one pass (cron outage) collapse into one update. */
export const MAX_PLAY_ALERTS_PER_RUN = 2;

export function initialState(sport: PushSport, eventId: string, now: Date): GameState {
  return {
    v: 1,
    sport,
    eventId,
    phase: "pre",
    sent: [],
    plays: [],
    scScore: null,
    oppScore: null,
    leader: null,
    done: false,
    updatedAt: now.toISOString(),
  };
}

function isNailBiter(sport: PushSport, g: NormalizedGame): boolean {
  if (g.state !== "in" || g.scScore === null || g.oppScore === null) return false;
  const cfg = SPORTS[sport];
  const margin = Math.abs(g.scScore - g.oppScore);
  const inOT = g.period > cfg.regulation;
  const lastPeriod = g.period === cfg.regulation;
  const clock = g.clockSec;
  switch (sport) {
    case "football":
      // 4th quarter, 5:00 or less, one-score game (<= 8)
      return margin <= 8 && (inOT || (lastPeriod && clock !== null && clock <= 300));
    case "wbb":
    case "mbb":
      return margin <= 5 && (inOT || (lastPeriod && clock !== null && clock <= 240));
    case "baseball":
      return margin <= 1 && g.period >= 8;
  }
}

export function detect(
  prevState: GameState | null,
  espnSummary: unknown,
  now: Date,
  sport: PushSport = prevState?.sport ?? "football",
): DetectResult {
  const cfg = SPORTS[sport];
  const g = normalizeSummary(espnSummary, cfg);
  const eventId = g.eventId || prevState?.eventId || "";
  const state: GameState = prevState
    ? { ...prevState, sent: [...prevState.sent], plays: [...prevState.plays] }
    : initialState(sport, eventId, now);
  const sent = new Set(state.sent);
  const seenPlays = new Set(state.plays);
  const events: Alert[] = [];
  const url = "/";
  const base = { sport, eventId, url };
  const tag = (k: string) => `${sport}-${eventId}-${k}`;

  const emit = (a: Omit<Alert, "sport" | "eventId" | "url" | "tag"> & { tag?: string }) => {
    if (sent.has(a.key)) return;
    sent.add(a.key);
    events.push({ ...base, tag: a.tag ?? tag(a.key), ...a });
  };
  const mark = (key: string) => sent.add(key);
  const finish = (): DetectResult => {
    state.sent = [...sent];
    state.plays = [...seenPlays];
    state.phase = g.state;
    if (g.scScore !== null) state.scScore = g.scScore;
    if (g.oppScore !== null) state.oppScore = g.oppScore;
    state.updatedAt = now.toISOString();
    return { events, nextState: state };
  };

  const pastHalf = cfg.halfPeriod > 0 && g.period > cfg.halfPeriod;

  // ---- First sight of a game already underway: seed silently. -------------------------
  if (!prevState && g.state !== "pre") {
    mark("kickoffSoon");
    mark("kickoff");
    for (const p of g.plays) seenPlays.add(p.id);
    if (pastHalf || g.state === "post" || g.statusName === "STATUS_HALFTIME") mark("halftime");
    if (g.period > cfg.regulation) mark("overtime");
    if (isNailBiter(sport, g)) mark("nailBiter");
    if (g.state === "post") {
      mark("final");
      state.done = true;
    }
    state.leader = leaderOf(g.scScore, g.oppScore);
    return finish();
  }

  // ---- Pre-game ------------------------------------------------------------------------
  if (g.state === "pre") {
    if (!g.timeTbd && g.startMs !== null) {
      const msLeft = g.startMs - now.getTime();
      const minLeft = Math.ceil(msLeft / 60000);
      if (msLeft > 0 && minLeft <= KICKOFF_SOON_MIN) {
        const when = ET.format(new Date(g.startMs));
        emit({
          key: "kickoffSoon",
          kind: "kickoffSoon",
          prefs: ["kickoffSoon"],
          title: `${cfg.start} in ${minLeft} min`,
          body: `${vsAt(g)} · ${when} ET${g.broadcast ? ` on ${g.broadcast}` : ""}`,
          ttl: Math.max(60, Math.floor(msLeft / 1000)),
          urgency: "normal",
        });
      }
    }
    return finish();
  }

  // ---- Missed the whole game (prev pre, now post): just the final. ----------------------
  const catchUpWholeGame = state.phase === "pre" && g.state === "post";

  // ---- Kickoff -------------------------------------------------------------------------
  mark("kickoffSoon");
  if (state.phase === "pre" && g.state === "in") {
    // Only alert kickoff if we're still early; a late first sighting just seeds.
    const early = g.period <= 1 && g.plays.length <= 1;
    if (early) {
      emit({
        key: "kickoff",
        kind: "kickoff",
        prefs: ["kickoff"],
        title: `${cfg.start}: ${vsAt(g)}`,
        body: `We're underway${g.city ? ` in ${g.city}` : ""}. Go Gamecocks.`,
        ttl: 300,
        urgency: "high",
      });
    }
  }
  mark("kickoff");

  // ---- Scoring -------------------------------------------------------------------------
  if (cfg.perPlayScores) {
    const fresh = g.plays.filter((p) => !seenPlays.has(p.id));
    const collapse = catchUpWholeGame || fresh.length > MAX_PLAY_ALERTS_PER_RUN;
    for (const p of fresh) {
      seenPlays.add(p.id);
      const sc = g.scHome ? p.homeScore : p.awayScore;
      const opp = g.scHome ? p.awayScore : p.homeScore;
      const after = leaderOf(sc, opp);
      const leadChange = after !== null && state.leader !== null && after !== state.leader;
      if (after !== null) state.leader = after;
      if (collapse) continue;

      const isSc = p.teamId === SPORTS[sport].teamId;
      const tied = sc === opp;
      const detail = tidyPlayText(p.text);
      // College football OT has no game clock; ESPN reports 0:00 there.
      const showClock = p.clock && !(sport === "football" && p.period > cfg.regulation);
      const when = `${periodLabel(sport, p.period)}${showClock ? ` ${p.clock}` : ""}`;
      let title: string;
      if (isSc) {
        const head =
          p.type === "TD"
            ? "TOUCHDOWN Gamecocks!"
            : p.type === "FG"
              ? "Gamecocks field goal"
              : p.type === "SF"
                ? "Safety! Two for the Gamecocks"
                : "Gamecocks score";
        title = leadChange
          ? "Gamecocks take the lead!"
          : tied
            ? p.type === "TD"
              ? `${head} All tied up`
              : `${head}, all tied up`
            : head;
      } else {
        const head =
          p.type === "TD"
            ? `${g.oppName} touchdown`
            : p.type === "FG"
              ? `${g.oppName} field goal`
              : p.type === "SF"
                ? `Safety, ${g.oppName}`
                : `${g.oppName} scores`;
        title = leadChange ? `${g.oppName} takes the lead` : tied ? `${g.oppName} ties it` : head;
      }
      const prefs: PrefKey[] = [isSc ? "scScores" : "oppScores"];
      if (leadChange) prefs.push("bigMoments");
      emit({
        key: `play:${p.id}`,
        kind: isSc ? "scScore" : "oppScore",
        prefs,
        title,
        body: `${detail ? `${detail}. ` : ""}${scoreLine(g, sc, opp)} · ${when}`,
        ttl: 600,
        urgency: "high",
      });
    }
    // At the final whistle the final alert carries the score; skip a redundant update.
    if (collapse && fresh.length > 0 && !catchUpWholeGame && g.state !== "post") {
      const last = fresh[fresh.length - 1];
      emit({
        key: `catchup:${last.id}`,
        kind: "scoreUpdate",
        prefs: ["scScores", "oppScores"],
        title: "Score update",
        body: `${scoreLine(g, g.scScore, g.oppScore)} · ${periodLabel(sport, g.period)}`,
        tag: tag("score"),
        ttl: 600,
        urgency: "normal",
      });
    }
  } else if (g.scScore !== null && g.oppScore !== null) {
    // Header-score sports. Baseball: alert per run change. Basketball: too many baskets to
    // alert on, so only track the leader.
    const prevSc = state.scScore ?? 0;
    const prevOpp = state.oppScore ?? 0;
    const after = leaderOf(g.scScore, g.oppScore);
    const leadChange = after !== null && state.leader !== null && after !== state.leader;
    if (after !== null) state.leader = after;
    if (sport === "baseball" && !catchUpWholeGame) {
      const line = `${scoreLine(g, g.scScore, g.oppScore)} · ${g.displayClock || periodLabel(sport, g.period)}`;
      if (g.scScore > prevSc) {
        const runs = g.scScore - prevSc;
        emit({
          key: `runs:sc:${g.scScore}`,
          kind: "scScore",
          prefs: leadChange ? ["scScores", "bigMoments"] : ["scScores"],
          title: `Gamecocks ${runs === 1 ? "score" : `score ${runs}`}${leadChange ? ", take the lead" : ""}`,
          body: line,
          ttl: 600,
          urgency: "high",
        });
      }
      if (g.oppScore > prevOpp) {
        const runs = g.oppScore - prevOpp;
        emit({
          key: `runs:opp:${g.oppScore}`,
          kind: "oppScore",
          prefs: leadChange ? ["oppScores", "bigMoments"] : ["oppScores"],
          title: `${g.oppName} ${runs === 1 ? "scores" : `scores ${runs}`}${leadChange ? ", takes the lead" : ""}`,
          body: line,
          ttl: 600,
          urgency: "high",
        });
      }
    }
  }

  // ---- Halftime ------------------------------------------------------------------------
  if (cfg.halfPeriod > 0) {
    if (g.statusName === "STATUS_HALFTIME" && !catchUpWholeGame) {
      const sc = g.scScore ?? 0;
      const opp = g.oppScore ?? 0;
      const m = marginText(sc, opp);
      emit({
        key: "halftime",
        kind: "halftime",
        prefs: ["halftimeFinal"],
        title: `Halftime: ${scoreLine(g, sc, opp)}`,
        body: `${m.charAt(0).toUpperCase()}${m.slice(1)} at the break.`,
        ttl: 900,
        urgency: "normal",
      });
    } else if (pastHalf || g.state === "post") {
      mark("halftime"); // missed it; don't send late
    }
  }

  // ---- Overtime / extras -----------------------------------------------------------------
  if (g.state === "in" && g.period > cfg.regulation) {
    emit({
      key: "overtime",
      kind: "overtime",
      prefs: ["bigMoments"],
      title: sport === "baseball" ? "Extra innings" : "Overtime!",
      body: `${scoreLine(g, g.scScore, g.oppScore)}. Not done yet.`,
      ttl: 600,
      urgency: "high",
    });
  } else if (g.state === "post" && g.period > cfg.regulation) {
    mark("overtime");
  }

  // ---- Nail-biter ------------------------------------------------------------------------
  if (isNailBiter(sport, g)) {
    const sc = g.scScore ?? 0;
    const opp = g.oppScore ?? 0;
    const left =
      sport === "baseball"
        ? `${g.displayClock || periodLabel(sport, g.period)}`
        : `${g.displayClock} left in ${periodLabel(sport, g.period)}`;
    const mood =
      sc === opp ? "Tied up." : sc > opp ? "Gamecocks hanging on." : "Gamecocks need a score.";
    emit({
      key: "nailBiter",
      kind: "nailBiter",
      prefs: ["bigMoments"],
      title:
        sport === "football"
          ? "One-score game"
          : sport === "baseball"
            ? "One-run game"
            : "Close one",
      body: `${scoreLine(g, sc, opp)} · ${left}. ${mood}`,
      ttl: 300,
      urgency: "high",
    });
  }

  // ---- Final ---------------------------------------------------------------------------
  if (g.state === "post") {
    state.done = true;
    if (g.completed && g.scScore !== null && g.oppScore !== null) {
      const sc = g.scScore;
      const opp = g.oppScore;
      const title =
        sc > opp
          ? `Final: Gamecocks beat ${g.oppName}`
          : sc < opp
            ? `Final: Gamecocks fall to ${g.oppName}`
            : `Final: South Carolina and ${g.oppName} tie`;
      const body =
        sc >= opp
          ? `South Carolina ${sc}, ${g.oppName} ${opp}${g.period > cfg.regulation ? ` (${periodLabel(sport, g.period)})` : ""}.`
          : `${g.oppName} ${opp}, South Carolina ${sc}${g.period > cfg.regulation ? ` (${periodLabel(sport, g.period)})` : ""}.`;
      emit({
        key: "final",
        kind: "final",
        prefs: ["halftimeFinal"],
        title,
        body,
        ttl: 3600,
        urgency: "normal",
      });
    } else {
      mark("final"); // postponed / canceled / no score: never invent a result
    }
  }

  return finish();
}
