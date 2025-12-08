import { useQuery } from "@tanstack/react-query";
import { getTeamData, getScoreboard, Sport, TeamData, Game } from "@/lib/espn";

// Refresh intervals based on game context
const REFRESH_INTERVALS = {
  live: 30 * 1000, // 30 seconds during live game
  gameDay: 5 * 60 * 1000, // 5 minutes on game day
  normal: 15 * 60 * 1000, // 15 minutes normally
} as const;

function getRefreshInterval(data?: TeamData): number {
  if (!data?.nextGame) return REFRESH_INTERVALS.normal;

  const gameState = data.nextGame.status.type.state;
  if (gameState === "in") return REFRESH_INTERVALS.live;

  const gameDate = new Date(data.nextGame.date);
  const now = new Date();
  const isToday = gameDate.toDateString() === now.toDateString();

  if (isToday) return REFRESH_INTERVALS.gameDay;
  return REFRESH_INTERVALS.normal;
}

export function useTeamData(sport: Sport) {
  return useQuery({
    queryKey: ["teamData", sport],
    queryFn: () => getTeamData(sport),
    refetchInterval: (query) => getRefreshInterval(query.state.data),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useScoreboard(sport: Sport) {
  return useQuery({
    queryKey: ["scoreboard", sport],
    queryFn: () => getScoreboard(sport),
    refetchInterval: REFRESH_INTERVALS.gameDay,
    staleTime: 60 * 1000,
  });
}
