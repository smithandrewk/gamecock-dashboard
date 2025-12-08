"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Game, getGameState } from "@/lib/espn";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface StreakChartProps {
  games: Game[];
  limit?: number;
}

interface ChartData {
  name: string;
  value: number;
  win: boolean;
  opponent: string;
  score: string;
  isConference: boolean;
}

function getUSCResult(game: Game): { won: boolean; uscScore: number; oppScore: number; opponent: string } | null {
  const isHomeUSC =
    game.homeTeam.abbreviation === "SC" ||
    game.homeTeam.displayName.includes("South Carolina");

  const uscScore = isHomeUSC ? game.homeScore : game.awayScore;
  const oppScore = isHomeUSC ? game.awayScore : game.homeScore;
  const opponent = isHomeUSC ? game.awayTeam : game.homeTeam;

  if (uscScore === undefined || oppScore === undefined) return null;

  return {
    won: uscScore > oppScore,
    uscScore,
    oppScore,
    opponent: opponent.abbreviation || opponent.name,
  };
}

export function StreakChart({ games, limit = 10 }: StreakChartProps) {
  const completedGames = games
    .filter((g) => getGameState(g) === "final")
    .reverse()
    .slice(0, limit)
    .reverse(); // Reverse again so oldest is first (left to right)

  const chartData: ChartData[] = completedGames
    .map((game) => {
      const result = getUSCResult(game);
      if (!result) return null;

      return {
        name: result.opponent,
        value: result.won ? 1 : -1,
        win: result.won,
        opponent: result.opponent,
        score: `${result.uscScore}-${result.oppScore}`,
        isConference: game.isConference || false,
      };
    })
    .filter((d): d is ChartData => d !== null);

  if (chartData.length === 0) {
    return null;
  }

  const wins = chartData.filter((d) => d.win).length;
  const losses = chartData.length - wins;
  const currentStreak = calculateStreak(chartData);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {wins}W-{losses}L
            </span>
            <span className="text-xs text-amber-600">● SEC</span>
          </div>
          {currentStreak.count > 1 && (
            <span
              className={
                currentStreak.type === "W"
                  ? "text-sm text-green-600 font-medium"
                  : "text-sm text-muted-foreground font-medium"
              }
            >
              {currentStreak.count} {currentStreak.type === "W" ? "W" : "L"} streak
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                interval={0}
                tick={(props: any) => {
                  const { x, y, payload } = props;
                  const entry = chartData[payload.index];
                  return (
                    <text
                      x={x}
                      y={y + 10}
                      textAnchor="middle"
                      fontSize={9}
                      fill={entry?.isConference ? "#d97706" : "hsl(var(--muted-foreground))"}
                      fontWeight={entry?.isConference ? 600 : 400}
                    >
                      {payload.value}
                    </text>
                  );
                }}
              />
              <YAxis hide domain={[-1.5, 1.5]} />
              <Bar dataKey="value" radius={[4, 4, 4, 4]} maxBarSize={32}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.win ? "hsl(142, 76%, 36%)" : "hsl(var(--muted-foreground))"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

      </CardContent>
    </Card>
  );
}

function calculateStreak(data: ChartData[]): { type: "W" | "L"; count: number } {
  if (data.length === 0) return { type: "W", count: 0 };

  const reversed = [...data].reverse();
  const firstResult = reversed[0].win;
  let count = 0;

  for (const game of reversed) {
    if (game.win === firstResult) {
      count++;
    } else {
      break;
    }
  }

  return { type: firstResult ? "W" : "L", count };
}
