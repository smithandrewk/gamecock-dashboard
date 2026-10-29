"use client";

import { cn } from "@/lib/utils";
import { LinescoreEntry } from "@/lib/espn";

interface BaseballLinescoreProps {
  linescore: LinescoreEntry[];
  homeTeamName: string;
  awayTeamName: string;
  homeRuns: number;
  awayRuns: number;
  homeHits: number;
  awayHits: number;
  homeErrors: number;
  awayErrors: number;
  currentInning?: number;
  isLive?: boolean;
}

/** Inning-by-inning line score with R/H/E. Scrolls sideways for extra innings. */
export function BaseballLinescore(p: BaseballLinescoreProps) {
  const total = Math.max(9, p.linescore.length);
  const innings = Array.from({ length: total }, (_, i) => p.linescore[i]);
  const cur = (i: number) => p.isLive && i + 1 === p.currentInning;
  const row = (name: string, side: "away" | "home") => (
    <tr>
      <td className="sticky left-0 bg-card py-1.5 pr-2 text-left font-semibold text-white">{name}</td>
      {innings.map((e, i) => (
        <td key={i} className={cn("min-w-[22px] py-1.5 text-center", cur(i) && "text-white")}>
          {side === "away" ? e?.awayRuns ?? "" : e?.homeRuns ?? ""}
        </td>
      ))}
      <td className="min-w-[26px] border-l border-white/10 py-1.5 pl-1 text-center font-semibold text-white">
        {side === "away" ? p.awayRuns : p.homeRuns}
      </td>
      <td className="min-w-[24px] py-1.5 text-center">{side === "away" ? p.awayHits : p.homeHits}</td>
      <td className="min-w-[24px] py-1.5 text-center">{side === "away" ? p.awayErrors : p.homeErrors}</td>
    </tr>
  );
  return (
    <div className="no-scrollbar overflow-x-auto">
      <table className="w-full text-[13px] tabular text-white/65">
        <thead>
          <tr className="text-[11px] text-white/40">
            <th className="sticky left-0 bg-card" />
            {innings.map((_, i) => (
              <th key={i} className={cn("py-1 text-center font-medium", cur(i) && "text-white")}>
                {i + 1}
              </th>
            ))}
            <th className="border-l border-white/10 py-1 pl-1 text-center font-medium">R</th>
            <th className="py-1 text-center font-medium">H</th>
            <th className="py-1 text-center font-medium">E</th>
          </tr>
        </thead>
        <tbody>
          {row(p.awayTeamName, "away")}
          {row(p.homeTeamName, "home")}
        </tbody>
      </table>
    </div>
  );
}
