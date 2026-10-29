import { useQuery } from "@tanstack/react-query";
import { getTeamData, getGameSummary, getBaseballStandings, Sport, TeamData } from "@/lib/espn";

// Refresh intervals based on game context
const REFRESH_INTERVALS = {
  live: 15 * 1000, // during a live game
  gameDay: 5 * 60 * 1000, // 5 minutes on game day
  normal: 15 * 60 * 1000, // 15 minutes normally
} as const;

function getRefreshInterval(data?: TeamData): number {
  if (!data?.nextGame) return REFRESH_INTERVALS.normal;

  const gameState = data.nextGame.status.type.state;
  if (gameState === "in") return REFRESH_INTERVALS.live;

  const start = new Date(data.nextGame.date).getTime();
  // Kickoff/tip has passed but ESPN still says "pre": poll fast so the switch to live shows.
  if (start <= Date.now()) return REFRESH_INTERVALS.live;
  const isToday = new Date(start).toDateString() === new Date().toDateString();
  return isToday ? REFRESH_INTERVALS.gameDay : REFRESH_INTERVALS.normal;
}

export function useTeamData(sport: Sport, enabled = true) {
  return useQuery({
    queryKey: ["teamData", sport],
    queryFn: () => getTeamData(sport),
    enabled,
    refetchInterval: (query) => getRefreshInterval(query.state.data),
    staleTime: 60 * 1000,
  });
}

/** Baseball linescore for a live or finished game. */
export function useGameSummary(eventId: string | undefined, live: boolean) {
  return useQuery({
    queryKey: ["gameSummary", eventId],
    queryFn: () => getGameSummary(eventId!),
    enabled: !!eventId,
    refetchInterval: live ? REFRESH_INTERVALS.live : false,
    staleTime: 30 * 1000,
  });
}

/** `season` must come from the team schedule: without it ESPN serves an older season. */
export function useBaseballStandings(season: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["baseballStandings", season],
    queryFn: () => getBaseballStandings(season),
    enabled: enabled && !!season,
    refetchInterval: REFRESH_INTERVALS.normal,
    staleTime: 5 * 60 * 1000,
  });
}
