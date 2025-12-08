"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Game, getGameState } from "@/lib/espn";

interface GameCardProps {
  game: Game;
  isUSC?: boolean;
}

function formatGameDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === now.toDateString()) {
    return `Today, ${date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow, ${date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TeamRow({
  name,
  logo,
  score,
  rank,
  isWinner,
  isUSC,
}: {
  name: string;
  logo: string;
  score?: number;
  rank?: number;
  isWinner?: boolean;
  isUSC?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 ${isWinner ? "font-semibold" : ""} ${isUSC ? "text-primary" : ""}`}
    >
      {logo && (
        <img src={logo} alt={name} className="w-6 h-6 object-contain" />
      )}
      <span className="flex-1 truncate">
        {rank && <span className="text-muted-foreground text-sm mr-1">#{rank}</span>}
        {name}
      </span>
      {score !== undefined && !Number.isNaN(score) && (
        <span className="font-mono text-lg">{score}</span>
      )}
    </div>
  );
}

export function GameCard({ game, isUSC = false }: GameCardProps) {
  const state = getGameState(game);
  const isHomeUSC = game.homeTeam.abbreviation === "SC" || game.homeTeam.displayName.includes("South Carolina");
  const isAwayUSC = game.awayTeam.abbreviation === "SC" || game.awayTeam.displayName.includes("South Carolina");
  const isConference = game.isConference;

  const homeWon =
    state === "final" &&
    game.homeScore !== undefined &&
    game.awayScore !== undefined &&
    game.homeScore > game.awayScore;
  const awayWon =
    state === "final" &&
    game.homeScore !== undefined &&
    game.awayScore !== undefined &&
    game.awayScore > game.homeScore;

  return (
    <Card className={`${isUSC ? "border-primary/30" : ""} ${isConference ? "ring-2 ring-amber-400/50" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">
            {state === "final"
              ? "Final"
              : state === "live"
                ? `${game.status.displayClock} - ${game.status.period}${game.status.period === 1 ? "st" : game.status.period === 2 ? "nd" : "th"}`
                : formatGameDate(game.date)}
          </span>
          <div className="flex gap-2">
            {isConference && (
              <Badge variant="outline" className="border-amber-400 text-amber-600 text-xs">
                SEC
              </Badge>
            )}
            {state === "live" && (
              <Badge variant="destructive" className="animate-pulse">
                LIVE
              </Badge>
            )}
            {game.broadcast && (
              <Badge variant="secondary">{game.broadcast}</Badge>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <TeamRow
            name={game.awayTeam.displayName}
            logo={game.awayTeam.logo}
            score={game.awayScore}
            rank={game.awayTeam.rank}
            isWinner={awayWon}
            isUSC={isAwayUSC}
          />
          <TeamRow
            name={game.homeTeam.displayName}
            logo={game.homeTeam.logo}
            score={game.homeScore}
            rank={game.homeTeam.rank}
            isWinner={homeWon}
            isUSC={isHomeUSC}
          />
        </div>

        {game.venue && (
          <p className="text-xs text-muted-foreground mt-3">{game.venue}</p>
        )}

        {game.odds && (
          <div className="flex gap-4 text-xs text-muted-foreground mt-2">
            {game.odds.spread && <span>Spread: {game.odds.spread}</span>}
            {game.odds.overUnder && <span>O/U: {game.odds.overUnder}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
