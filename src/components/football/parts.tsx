"use client";

import { cn } from "@/lib/utils";
import { periodLabel, type FBGame, type FBTeam, type ScoringPlay } from "@/lib/football";
import { TeamLogo } from "@/components/shared/bits";

/** Small football glyph marking the team with the ball. */
export function PossessionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 14" className={cn("h-2.5 w-[18px]", className)} aria-label="Has the ball" role="img">
      <ellipse cx="12" cy="7" rx="11" ry="6.2" fill="currentColor" />
      <path d="M8 7h8M10 5.2v3.6M12 5.2v3.6M14 5.2v3.6" stroke="#000" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

/** Quarter-by-quarter line score. Away on top, home below (ESPN order). */
export function Linescore({ game, className }: { game: FBGame; className?: string }) {
  const n = Math.max(4, game.away.linescores.length, game.home.linescores.length);
  if (!game.away.linescores.length && !game.home.linescores.length) return null;
  const cols = Array.from({ length: n }, (_, i) => i);
  const live = game.state === "in";
  const row = (t: FBTeam) => (
    <tr key={t.id} className={cn(t.id === game.sc.id && "text-white")}>
      <td className="py-1 pr-2 text-left font-semibold">{t.abbreviation}</td>
      {cols.map((i) => (
        <td key={i} className={cn("w-8 py-1 text-center", live && i + 1 === game.period && "text-white")}>
          {t.linescores[i] ?? ""}
        </td>
      ))}
      <td className="w-10 py-1 text-right font-semibold text-white">{t.score ?? ""}</td>
    </tr>
  );
  return (
    <table className={cn("w-full text-[13px] tabular text-white/70", className)}>
      <thead>
        <tr className="text-[11px] text-white/40">
          <th className="py-1 text-left font-medium" />
          {cols.map((i) => (
            <th key={i} className="w-8 py-1 text-center font-medium">
              {i < 4 ? i + 1 : i === 4 ? "OT" : `${i - 3}OT`}
            </th>
          ))}
          <th className="w-10 py-1 text-right font-medium">T</th>
        </tr>
      </thead>
      <tbody>
        {row(game.away)}
        {row(game.home)}
      </tbody>
    </table>
  );
}

function kindLabel(p: ScoringPlay) {
  if (p.kind) return p.kind;
  return p.typeText;
}

/** One scoring play: team, kind, description, quarter/clock, running score. */
export function ScoringRow({ play, game, compact }: { play: ScoringPlay; game: FBGame; compact?: boolean }) {
  const team = play.teamId === game.home.id ? game.home : game.away;
  const isSC = team.id === game.sc.id;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <TeamLogo src={team.logo} alt={team.shortName} size={22} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className={cn("text-[14px] leading-snug", compact && "truncate")}>
          <span className={cn("mr-1.5 font-semibold", isSC ? "text-garnet-bright" : "text-white")}>{kindLabel(play)}</span>
          <span className="text-white/85">{play.text}</span>
        </div>
        <div className="mt-0.5 text-[12px] text-muted-foreground tabular">
          {periodLabel(play.period)} {play.clock}
        </div>
      </div>
      {/* Running score in away-home order, matching the line score; the scoring side is bold. */}
      <div className="shrink-0 text-right text-[13px] tabular text-white/55" aria-label={`${game.away.abbreviation} ${play.awayScore}, ${game.home.abbreviation} ${play.homeScore}`}>
        <span className={cn(team.id === game.away.id && "font-semibold text-white")}>{play.awayScore}</span>-
        <span className={cn(team.id === game.home.id && "font-semibold text-white")}>{play.homeScore}</span>
      </div>
    </div>
  );
}

export function isOT(game: FBGame) {
  return /OT/.test(game.detail) || (game.period ?? 0) > 4;
}
