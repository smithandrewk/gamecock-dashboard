"use client";

import { Game, getGameState } from "@/lib/espn";
import { GameCard } from "./GameCard";

interface ResultsListProps {
  games: Game[];
  limit?: number;
}

export function ResultsList({ games, limit = 5 }: ResultsListProps) {
  const recentGames = games
    .filter((g) => getGameState(g) === "final")
    .reverse()
    .slice(0, limit);

  if (recentGames.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-4">
        No recent games
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {recentGames.map((game) => (
        <GameCard key={game.id} game={game} isUSC />
      ))}
    </div>
  );
}
