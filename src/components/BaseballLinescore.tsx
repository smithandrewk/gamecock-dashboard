"use client";

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

export function BaseballLinescore({
  linescore,
  homeTeamName,
  awayTeamName,
  homeRuns,
  awayRuns,
  homeHits,
  awayHits,
  homeErrors,
  awayErrors,
  currentInning,
  isLive,
}: BaseballLinescoreProps) {
  // Ensure at least 9 innings displayed
  const totalInnings = Math.max(9, linescore.length);
  const innings = Array.from({ length: totalInnings }, (_, i) => {
    const entry = linescore[i];
    return {
      inning: i + 1,
      homeRuns: entry?.homeRuns ?? "",
      awayRuns: entry?.awayRuns ?? "",
    };
  });

  return (
    <div className="rounded-lg overflow-hidden border border-amber-900/30 bg-[#1a1a2e]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="text-amber-400/80 border-b border-amber-900/30">
              <th className="text-left px-3 py-2 min-w-[80px] sticky left-0 bg-[#1a1a2e] z-10"></th>
              {innings.map((inn) => (
                <th
                  key={inn.inning}
                  className={`px-2 py-2 text-center min-w-[28px] ${
                    isLive && inn.inning === currentInning
                      ? "text-amber-300 font-bold"
                      : ""
                  }`}
                >
                  {inn.inning}
                </th>
              ))}
              <th className="px-2 py-2 text-center min-w-[32px] border-l border-amber-900/30 text-amber-300 font-bold">R</th>
              <th className="px-2 py-2 text-center min-w-[32px] text-amber-300 font-bold">H</th>
              <th className="px-2 py-2 text-center min-w-[32px] text-amber-300 font-bold">E</th>
            </tr>
          </thead>
          <tbody className="text-white">
            {/* Away team (bats first) */}
            <tr className="border-b border-amber-900/20">
              <td className="px-3 py-2 font-semibold sticky left-0 bg-[#1a1a2e] z-10 text-slate-200">
                {awayTeamName}
              </td>
              {innings.map((inn) => (
                <td
                  key={inn.inning}
                  className={`px-2 py-2 text-center ${
                    isLive && inn.inning === currentInning
                      ? "bg-amber-900/20 text-amber-200"
                      : "text-slate-300"
                  }`}
                >
                  {inn.awayRuns}
                </td>
              ))}
              <td className="px-2 py-2 text-center font-bold border-l border-amber-900/30 text-white">{awayRuns}</td>
              <td className="px-2 py-2 text-center text-slate-300">{awayHits}</td>
              <td className="px-2 py-2 text-center text-slate-300">{awayErrors}</td>
            </tr>
            {/* Home team */}
            <tr>
              <td className="px-3 py-2 font-semibold sticky left-0 bg-[#1a1a2e] z-10 text-slate-200">
                {homeTeamName}
              </td>
              {innings.map((inn) => (
                <td
                  key={inn.inning}
                  className={`px-2 py-2 text-center ${
                    isLive && inn.inning === currentInning
                      ? "bg-amber-900/20 text-amber-200"
                      : "text-slate-300"
                  }`}
                >
                  {inn.homeRuns}
                </td>
              ))}
              <td className="px-2 py-2 text-center font-bold border-l border-amber-900/30 text-white">{homeRuns}</td>
              <td className="px-2 py-2 text-center text-slate-300">{homeHits}</td>
              <td className="px-2 py-2 text-center text-slate-300">{homeErrors}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
