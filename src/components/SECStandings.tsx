"use client";

import { StandingsEntry } from "@/lib/espn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SECStandingsProps {
  standings?: StandingsEntry[];
  isLoading?: boolean;
}

export function SECStandings({ standings, isLoading }: SECStandingsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">SEC Standings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!standings || standings.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">SEC Standings</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left pl-4 pr-2 py-2 font-medium">#</th>
                <th className="text-left px-2 py-2 font-medium">Team</th>
                <th className="text-center px-2 py-2 font-medium">W-L</th>
                <th className="text-center px-2 py-2 font-medium">Win%</th>
                <th className="text-center px-2 py-2 font-medium">Strk</th>
                <th className="text-center px-2 py-2 pr-4 font-medium">Diff</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((entry, index) => {
                const isSC = entry.abbreviation === "SC" || entry.teamName.includes("South Carolina");
                const diff = parseFloat(entry.runDifferential) || 0;

                return (
                  <tr
                    key={entry.teamId}
                    className={`border-b last:border-0 ${
                      isSC
                        ? "bg-primary/10 font-semibold"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <td className="pl-4 pr-2 py-2 text-muted-foreground">{index + 1}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        {entry.logo && (
                          <img
                            src={entry.logo}
                            alt={entry.abbreviation}
                            className="w-5 h-5 object-contain"
                          />
                        )}
                        <span className={isSC ? "text-primary" : ""}>
                          {entry.abbreviation}
                        </span>
                      </div>
                    </td>
                    <td className="text-center px-2 py-2">{entry.overall}</td>
                    <td className="text-center px-2 py-2">
                      {entry.winPercent !== "0" ? entry.winPercent : "-"}
                    </td>
                    <td className="text-center px-2 py-2">
                      <span className={
                        entry.streak.startsWith("W") ? "text-green-600 dark:text-green-400" :
                        entry.streak.startsWith("L") ? "text-red-600 dark:text-red-400" : ""
                      }>
                        {entry.streak || "-"}
                      </span>
                    </td>
                    <td className="text-center px-2 py-2 pr-4">
                      <span className={
                        diff > 0 ? "text-green-600 dark:text-green-400" :
                        diff < 0 ? "text-red-600 dark:text-red-400" : ""
                      }>
                        {diff > 0 ? `+${entry.runDifferential}` : entry.runDifferential || "-"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
