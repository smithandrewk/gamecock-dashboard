"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Game, TeamData, getGameState } from "@/lib/espn";

interface SmartHeroProps {
  data?: TeamData;
  isLoading?: boolean;
}

function formatCountdown(dateStr: string): string {
  const gameDate = new Date(dateStr);
  const now = new Date();
  const diff = gameDate.getTime() - now.getTime();

  if (diff < 0) return "Starting soon";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function LiveGameHero({ game }: { game: Game }) {
  const isHomeUSC = game.homeTeam.abbreviation === "SC" || game.homeTeam.displayName.includes("South Carolina");

  return (
    <Card className="bg-primary text-primary-foreground">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Badge variant="secondary" className="animate-pulse bg-white text-primary">
            LIVE
          </Badge>
          <span className="text-sm opacity-80">
            {game.status.displayClock} - {game.status.period}
            {game.status.period === 1
              ? "st"
              : game.status.period === 2
                ? "nd"
                : "th"} Half
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 text-center">
            {game.awayTeam.logo && (
              <img
                src={game.awayTeam.logo}
                alt={game.awayTeam.name}
                className="w-16 h-16 mx-auto mb-2 object-contain"
              />
            )}
            <p className="font-semibold truncate">{game.awayTeam.abbreviation}</p>
            <p className="text-3xl font-bold">{game.awayScore ?? 0}</p>
          </div>

          <div className="text-2xl font-light opacity-60">@</div>

          <div className="flex-1 text-center">
            {game.homeTeam.logo && (
              <img
                src={game.homeTeam.logo}
                alt={game.homeTeam.name}
                className="w-16 h-16 mx-auto mb-2 object-contain"
              />
            )}
            <p className="font-semibold truncate">{game.homeTeam.abbreviation}</p>
            <p className="text-3xl font-bold">{game.homeScore ?? 0}</p>
          </div>
        </div>

        {game.broadcast && (
          <p className="text-center text-sm opacity-80 mt-4">
            Watch on {game.broadcast}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingGameHero({ game }: { game: Game }) {
  const isHomeUSC = game.homeTeam.abbreviation === "SC" || game.homeTeam.displayName.includes("South Carolina");
  const opponent = isHomeUSC ? game.awayTeam : game.homeTeam;
  const isHome = isHomeUSC;

  const gameDate = new Date(game.date);
  const isToday = gameDate.toDateString() === new Date().toDateString();

  return (
    <Card className="border-primary/30">
      <CardContent className="p-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">
            {isToday ? "Today" : "Next Game"}
          </p>

          <div className="flex items-center justify-center gap-4 mb-4">
            {opponent.logo && (
              <img
                src={opponent.logo}
                alt={opponent.name}
                className="w-20 h-20 object-contain"
              />
            )}
            <div className="text-left">
              <p className="text-lg font-semibold">
                {isHome ? "vs" : "@"} {opponent.displayName}
              </p>
              {opponent.rank && (
                <Badge variant="secondary">#{opponent.rank}</Badge>
              )}
            </div>
          </div>

          <div className="text-4xl font-bold text-primary mb-2">
            {formatCountdown(game.date)}
          </div>

          <p className="text-sm text-muted-foreground">
            {gameDate.toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>

          {game.broadcast && (
            <Badge variant="outline" className="mt-3">
              {game.broadcast}
            </Badge>
          )}

          {game.venue && (
            <p className="text-xs text-muted-foreground mt-2">{game.venue}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentGameHero({ game, record }: { game: Game; record?: string }) {
  const isHomeUSC = game.homeTeam.abbreviation === "SC" || game.homeTeam.displayName.includes("South Carolina");
  const uscScore = isHomeUSC ? game.homeScore : game.awayScore;
  const oppScore = isHomeUSC ? game.awayScore : game.homeScore;
  const opponent = isHomeUSC ? game.awayTeam : game.homeTeam;
  const won = (uscScore ?? 0) > (oppScore ?? 0);

  return (
    <Card className={won ? "border-green-500/30" : "border-red-500/30"}>
      <CardContent className="p-6">
        <div className="text-center">
          <Badge variant={won ? "default" : "secondary"} className="mb-4">
            {won ? "WIN" : "LOSS"}
          </Badge>

          <div className="flex items-center justify-center gap-6 mb-4">
            <div className="text-center">
              <p className="text-3xl font-bold">{uscScore}</p>
              <p className="text-sm text-muted-foreground">USC</p>
            </div>
            <div className="text-2xl text-muted-foreground">-</div>
            <div className="text-center">
              <p className="text-3xl font-bold">{oppScore}</p>
              <p className="text-sm text-muted-foreground">{opponent.abbreviation}</p>
            </div>
          </div>

          <p className="text-muted-foreground">
            {isHomeUSC ? "vs" : "@"} {opponent.displayName}
          </p>

          {record && (
            <p className="text-sm text-muted-foreground mt-2">
              Season: {record}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SmartHero({ data, isLoading }: SmartHeroProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-8 w-24 mx-auto mb-4" />
          <div className="flex items-center justify-center gap-6">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-20 w-20 rounded-full" />
          </div>
          <Skeleton className="h-10 w-32 mx-auto mt-4" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No game data available
        </CardContent>
      </Card>
    );
  }

  // Check for live game first
  const liveGame = data.schedule.find((g) => getGameState(g) === "live");
  if (liveGame) {
    return <LiveGameHero game={liveGame} />;
  }

  // Then upcoming game
  if (data.nextGame && getGameState(data.nextGame) === "upcoming") {
    return <UpcomingGameHero game={data.nextGame} />;
  }

  // Fall back to most recent game
  if (data.lastGame) {
    return <RecentGameHero game={data.lastGame} record={data.record.overall} />;
  }

  return (
    <Card>
      <CardContent className="p-6 text-center text-muted-foreground">
        No upcoming games scheduled
      </CardContent>
    </Card>
  );
}
