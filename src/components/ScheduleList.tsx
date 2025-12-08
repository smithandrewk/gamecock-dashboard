"use client";

import { Game, getGameState } from "@/lib/espn";
import { GameCard } from "./GameCard";

interface ScheduleListProps {
  games: Game[];
  limit?: number;
}

export function ScheduleList({ games, limit = 5 }: ScheduleListProps) {
  const upcomingGames = games
    .filter((g) => getGameState(g) === "upcoming")
    .slice(0, limit);

  if (upcomingGames.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-4">
        No upcoming games scheduled
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {upcomingGames.map((game) => (
        <GameCard key={game.id} game={game} isUSC />
      ))}
    </div>
  );
}
