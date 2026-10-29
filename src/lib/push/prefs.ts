// Shared between the client hook and the server routes. No server-only imports here.

export type PushSport = "football" | "wbb" | "mbb" | "baseball";
export const PUSH_SPORTS: readonly PushSport[] = ["football", "wbb", "mbb", "baseball"];

export type PushPrefs = {
  kickoffSoon: boolean;
  kickoff: boolean;
  scScores: boolean;
  oppScores: boolean;
  halftimeFinal: boolean;
  bigMoments: boolean;
  sports: PushSport[];
};

/** Boolean toggles in PushPrefs (everything except `sports`). */
export type PrefKey = Exclude<keyof PushPrefs, "sports">;
export const PREF_KEYS: readonly PrefKey[] = [
  "kickoffSoon",
  "kickoff",
  "scScores",
  "oppScores",
  "halftimeFinal",
  "bigMoments",
];

export const DEFAULT_PREFS: PushPrefs = {
  kickoffSoon: true,
  kickoff: true,
  scScores: true,
  oppScores: false,
  halftimeFinal: true,
  bigMoments: true,
  sports: ["football"],
};

/** Strict parse of untrusted prefs. Returns null if the shape is wrong. */
export function parsePrefs(input: unknown): PushPrefs | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const out = { ...DEFAULT_PREFS } as PushPrefs;
  for (const k of PREF_KEYS) {
    if (typeof o[k] !== "boolean") return null;
    out[k] = o[k] as boolean;
  }
  if (!Array.isArray(o.sports)) return null;
  const sports = o.sports.filter((s): s is PushSport =>
    PUSH_SPORTS.includes(s as PushSport),
  );
  if (sports.length !== o.sports.length) return null;
  out.sports = Array.from(new Set(sports));
  return out;
}
