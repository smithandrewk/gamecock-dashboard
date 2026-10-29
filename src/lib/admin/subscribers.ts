import "server-only";
import { blobStore } from "@/lib/push/store";
import { sourced } from "./sourced";

// Game-alert subscribers, counted from the push store itself (Vercel Blob, subs/*):
// the ground truth for "alerts are on", unlike the alerts_on event, which only counts
// taps since tracking began. Platform comes from the push endpoint's host.

export type Subscribers = {
  total: number;
  apple: number;
  other: number;
  bySport: { label: string; value: number }[];
  byPref: { label: string; value: number }[];
  newestAt: string | null;
};

const PREF_LABELS: Record<string, string> = {
  kickoffSoon: "Kickoff soon",
  kickoff: "Kickoff",
  scScores: "Gamecocks scores",
  oppScores: "Opponent scores",
  halftimeFinal: "Halftime & final",
  bigMoments: "Big moments",
};
const SPORT_LABELS: Record<string, string> = { football: "Football", wbb: "Women's BB", mbb: "Men's BB", baseball: "Baseball" };

export const getSubscribers = () =>
  sourced("Push store · Vercel Blob subs/", async () => {
    const subs = await blobStore.listSubs();
    const count = (keys: string[], labels: Record<string, string>) =>
      Object.entries(labels)
        .map(([k, label]) => ({ label, value: keys.filter((x) => x === k).length }))
        .sort((a, b) => b.value - a.value);
    const apple = subs.filter((s) => /\.push\.apple\.com/.test(new URL(s.endpoint).host)).length;
    return {
      total: subs.length,
      apple,
      other: subs.length - apple,
      bySport: count(subs.flatMap((s) => s.prefs.sports), SPORT_LABELS),
      byPref: count(
        subs.flatMap((s) => Object.entries(s.prefs).filter(([k, v]) => k !== "sports" && v === true).map(([k]) => k)),
        PREF_LABELS,
      ),
      newestAt: subs.map((s) => s.createdAt).sort().at(-1) ?? null,
    } satisfies Subscribers;
  });
