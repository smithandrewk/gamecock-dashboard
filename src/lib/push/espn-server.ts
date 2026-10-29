/** Server-side ESPN reads for the notifier (direct ESPN URLs, no proxy). */
import type { PushSport } from "./prefs";
import { SPORTS } from "./sports";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports";

export type FetchJson = (url: string, opts?: { revalidate?: number }) => Promise<unknown>;

export const fetchJson: FetchJson = async (url, opts) => {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    ...(opts?.revalidate ? { next: { revalidate: opts.revalidate } } : { cache: "no-store" }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${url.replace(ESPN, "")}`);
  return res.json();
};

export type Candidate = { eventId: string; date: string; state: string };

/** Games worth checking right now: live, starting within 35 min, or started in the last 8h. */
export async function findCandidates(sport: PushSport, now: Date, get: FetchJson = fetchJson): Promise<Candidate[]> {
  const cfg = SPORTS[sport];
  const out = new Map<string, Candidate>();
  for (const st of cfg.seasontypes) {
    const url = `${ESPN}/${cfg.path}/teams/${cfg.teamId}/schedule${st ? `?seasontype=${st}` : ""}`;
    let data: { events?: Array<{ id: string; date: string; competitions?: Array<{ status?: { type?: { state?: string } } }> }> };
    try {
      data = (await get(url, { revalidate: 120 })) as typeof data;
    } catch (e) {
      // Bowl schedule (seasontype=3) legitimately may not exist; regular season must.
      if (st === 3) continue;
      throw e;
    }
    for (const ev of data.events ?? []) {
      const state = ev.competitions?.[0]?.status?.type?.state ?? "pre";
      const t = Date.parse(ev.date);
      const dt = t - now.getTime();
      const live = state === "in";
      const soon = state === "pre" && dt <= 35 * 60_000 && dt > -3 * 3600_000;
      const recent = state === "post" && dt <= 0 && dt > -8 * 3600_000;
      if (live || soon || recent) out.set(String(ev.id), { eventId: String(ev.id), date: ev.date, state });
    }
  }
  return [...out.values()];
}

export function summaryUrl(sport: PushSport, eventId: string) {
  return `${ESPN}/${SPORTS[sport].path}/summary?event=${encodeURIComponent(eventId)}`;
}
