"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Game, getGameState } from "@/lib/espn";

interface SeriesTrackerProps {
  games: Game[];
}

interface Series {
  opponent: {
    name: string;
    abbreviation: string;
    logo: string;
  };
  games: Game[];
  isHome: boolean;
}

function groupIntoSeries(games: Game[]): Series[] {
  const sorted = [...games].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const series: Series[] = [];
  let current: Series | null = null;

  for (const game of sorted) {
    const isHomeUSC =
      game.homeTeam.abbreviation === "SC" ||
      game.homeTeam.displayName.includes("South Carolina");
    const opponent = isHomeUSC ? game.awayTeam : game.homeTeam;

    // Check if this game is part of the current series
    // (same opponent, within 3 days of the first game in series)
    if (current && current.opponent.abbreviation === opponent.abbreviation) {
      const firstGameDate = new Date(current.games[0].date);
      const thisGameDate = new Date(game.date);
      const daysDiff =
        (thisGameDate.getTime() - firstGameDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff <= 4 && current.games.length < 4) {
        current.games.push(game);
        continue;
      }
    }

    // Start a new series
    current = {
      opponent: {
        name: opponent.displayName,
        abbreviation: opponent.abbreviation,
        logo: opponent.logo,
      },
      games: [game],
      isHome: isHomeUSC,
    };
    series.push(current);
  }

  return series;
}

function GameDot({ game }: { game: Game }) {
  const state = getGameState(game);
  const isHomeUSC =
    game.homeTeam.abbreviation === "SC" ||
    game.homeTeam.displayName.includes("South Carolina");
  const uscScore = isHomeUSC ? game.homeScore : game.awayScore;
  const oppScore = isHomeUSC ? game.awayScore : game.homeScore;

  if (state === "final") {
    const won = (uscScore ?? 0) > (oppScore ?? 0);
    return (
      <div className="flex flex-col items-center gap-1">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
            won ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {won ? "W" : "L"}
        </div>
        <span className="text-xs text-muted-foreground">
          {uscScore}-{oppScore}
        </span>
      </div>
    );
  }

  if (state === "live") {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary text-white text-xs font-bold animate-pulse ring-2 ring-primary/50">
          {uscScore ?? 0}-{oppScore ?? 0}
        </div>
        <span className="text-xs text-primary font-medium">LIVE</span>
      </div>
    );
  }

  // Upcoming
  const gameDate = new Date(game.date);
  const dayName = gameDate.toLocaleDateString("en-US", { weekday: "short" });
  const time = gameDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/40 flex items-center justify-center">
        <span className="text-[10px] text-muted-foreground">{dayName}</span>
      </div>
      <span className="text-xs text-muted-foreground">{time}</span>
    </div>
  );
}

export function SeriesTracker({ games }: SeriesTrackerProps) {
  const allSeries = groupIntoSeries(games).filter((s) => s.games.length > 1);

  // Find the current/next series: first one with an upcoming or live game
  const relevantSeries = allSeries.filter((s) =>
    s.games.some((g) => {
      const state = getGameState(g);
      return state === "live" || state === "upcoming";
    })
  );

  // Also include the most recently completed series
  const completedSeries = allSeries.filter((s) =>
    s.games.every((g) => getGameState(g) === "final")
  );
  const lastCompleted = completedSeries[completedSeries.length - 1];

  const seriesToShow = [
    ...(lastCompleted ? [lastCompleted] : []),
    ...relevantSeries.slice(0, 2),
  ].slice(0, 3);

  if (seriesToShow.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Series Tracker</h2>
      <div className="space-y-3">
        {seriesToShow.map((series, idx) => {
          const hasLive = series.games.some((g) => getGameState(g) === "live");
          const allDone = series.games.every(
            (g) => getGameState(g) === "final"
          );
          const wins = series.games.filter((g) => {
            if (getGameState(g) !== "final") return false;
            const isHomeUSC =
              g.homeTeam.abbreviation === "SC" ||
              g.homeTeam.displayName.includes("South Carolina");
            const uscScore = isHomeUSC ? g.homeScore : g.awayScore;
            const oppScore = isHomeUSC ? g.awayScore : g.homeScore;
            return (uscScore ?? 0) > (oppScore ?? 0);
          }).length;
          const losses = series.games.filter((g) => {
            if (getGameState(g) !== "final") return false;
            const isHomeUSC =
              g.homeTeam.abbreviation === "SC" ||
              g.homeTeam.displayName.includes("South Carolina");
            const uscScore = isHomeUSC ? g.homeScore : g.awayScore;
            const oppScore = isHomeUSC ? g.awayScore : g.homeScore;
            return (uscScore ?? 0) < (oppScore ?? 0);
          }).length;

          return (
            <Card
              key={idx}
              className={hasLive ? "border-primary/50" : allDone ? "opacity-80" : ""}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  {series.opponent.logo && (
                    <img
                      src={series.opponent.logo}
                      alt={series.opponent.name}
                      className="w-8 h-8 object-contain"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {series.isHome ? "vs" : "@"} {series.opponent.name}
                    </p>
                    {allDone && (
                      <p className="text-xs text-muted-foreground">
                        Series: {wins > losses ? "Won" : wins < losses ? "Lost" : "Split"} {wins}-{losses}
                      </p>
                    )}
                  </div>
                  {series.games.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                      {series.games.length}-game series
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-center gap-4">
                  {series.games.map((game, gIdx) => (
                    <div key={gIdx} className="flex flex-col items-center">
                      <span className="text-[10px] text-muted-foreground mb-1">
                        G{gIdx + 1}
                      </span>
                      <GameDot game={game} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
