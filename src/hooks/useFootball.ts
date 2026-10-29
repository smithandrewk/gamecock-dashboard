import { useQuery } from "@tanstack/react-query";
import { getFootballSeason, getFootballSummary, type FBGame, type FBSummary, type FootballSeason } from "@/lib/football";

const SEC = 1000;
const MIN = 60 * SEC;

function seasonInterval(season?: FootballSeason): number {
  const games = season?.games ?? [];
  if (games.some((g) => g.state === "in")) return 30 * SEC;
  const next = games.find((g) => g.state === "pre");
  if (next) {
    const until = new Date(next.date).getTime() - Date.now();
    if (until < 30 * MIN) return 30 * SEC; // kickoff window (and ESPN lagging past kickoff)
    if (until < 12 * 60 * MIN) return 5 * MIN;
  }
  return 15 * MIN;
}

export function useFootballSeason() {
  return useQuery({
    queryKey: ["football", "season"],
    queryFn: getFootballSeason,
    refetchInterval: (q) => seasonInterval(q.state.data),
    staleTime: 60 * SEC,
  });
}

/**
 * One game's summary. Live games refresh every 15s; a game whose kickoff is close (or
 * passed while ESPN still says "pre") every 30s; finished games don't refresh.
 */
export function useFootballSummary(game: Pick<FBGame, "id" | "date" | "state"> | undefined, enabled = true) {
  return useQuery<FBSummary>({
    queryKey: ["football", "summary", game?.id],
    queryFn: () => getFootballSummary(game!.id),
    enabled: enabled && !!game?.id,
    refetchInterval: (q) => {
      const state = q.state.data?.game.state ?? game?.state;
      if (state === "in") return 15 * SEC;
      if (state === "post") return false;
      const until = game ? new Date(game.date).getTime() - Date.now() : Infinity;
      if (until < 60 * MIN) return 30 * SEC;
      return 10 * MIN;
    },
    staleTime: 10 * SEC,
  });
}
