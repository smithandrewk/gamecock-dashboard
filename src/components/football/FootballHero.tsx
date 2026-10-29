"use client";

import { ChevronRight, MapPin, Tv } from "lucide-react";
import { cn } from "@/lib/utils";
import { flexWindow, periodLabel, venueLine, type FBGame, type FBSummary, type FBTeam } from "@/lib/football";
import { Rank, ResultChip, TeamLogo } from "@/components/shared/bits";
import { ago, countdown, formatDay, formatTime, formatTimeZone, useNow, daysUntil } from "@/components/shared/format";
import { Linescore, PossessionIcon, ScoringRow, isOT } from "./parts";

interface HeroProps {
  game: FBGame;
  summary?: FBSummary;
  /** Shown under the hero: last result (pregame) or next game (final) */
  context?: FBGame;
  updatedAt?: number;
  onOpen: (id: string) => void;
}

/** Tappable block (a div, since it wraps tables/blocks that a <button> may not contain). */
function Tappable({ className, onTap, children }: { className?: string; onTap: () => void; children: React.ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn("cursor-pointer outline-none active:bg-white/[0.02]", className)}
      onClick={onTap}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTap();
        }
      }}
    >
      {children}
    </div>
  );
}

function DemoBadge() {
  return (
    <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-medium text-white/60" data-testid="demo-badge">
      Demo data
    </span>
  );
}

function TeamColumn({ team, game, dim, big, conf }: { team: FBTeam; game: FBGame; dim?: boolean; big?: boolean; conf?: boolean }) {
  const isSC = team.id === game.sc.id;
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col items-center text-center", dim && "opacity-55")}>
      <TeamLogo src={team.logo} alt={team.shortName} size={big ? 56 : 48} />
      <div className="mt-2 flex max-w-full items-center gap-1 text-[15px] font-semibold leading-tight">
        <span className="truncate">
          <Rank rank={team.rank} />
          {isSC ? "South Carolina" : team.shortName}
        </span>
      </div>
      {team.record && (
        <div className="mt-0.5 text-[12px] text-muted-foreground tabular">
          {team.record}
          {conf && team.confRecord ? ` · ${team.confRecord} SEC` : ""}
        </div>
      )}
    </div>
  );
}

function ContextRow({ game, onOpen, label }: { game: FBGame; onOpen: (id: string) => void; label: string }) {
  const at = game.neutral ? "vs" : game.scHome ? "vs" : "at";
  return (
    <button
      type="button"
      onClick={() => onOpen(game.id)}
      className="flex w-full items-center gap-3 border-t border-white/[0.08] px-5 py-3 text-left active:bg-white/[0.04]"
    >
      <span className="w-10 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {game.result && <ResultChip result={game.result} />}
      <TeamLogo src={game.opp.logo} alt={game.opp.shortName} size={20} />
      {/* Two lines so the opponent name gets the full width instead of being cut to "Ten…". */}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px]">
          {game.result ? (
            <span className="mr-1 font-semibold tabular">
              {game.sc.score}-{game.opp.score}
            </span>
          ) : null}
          <span className="text-muted-foreground">{at} </span>
          <Rank rank={game.opp.rank} />
          {game.opp.shortName}
        </span>
        <span className="block truncate text-[12px] text-muted-foreground">
          {game.result ? formatDay(game.date) : `${formatDay(game.date)} · ${formatTime(game.date, game.timeTBD)}`}
        </span>
      </span>
      <ChevronRight className="-mr-1 size-4 shrink-0 text-white/25" />
    </button>
  );
}

function WinProbBar({ game, p }: { game: FBGame; p: number }) {
  const sc = Math.round(p * 100);
  const scLeft = !game.scHome; // bar follows the away-left / home-right layout
  const left = scLeft ? sc : 100 - sc;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] font-medium text-white/60 tabular">
        <span>
          {game.away.abbreviation} {scLeft ? sc : 100 - sc}%
        </span>
        <span className="text-white/40">Win probability</span>
        <span>
          {game.home.abbreviation} {scLeft ? 100 - sc : sc}%
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full", scLeft ? "bg-garnet-bright" : "bg-white/40")} style={{ width: `${left}%` }} />
        <div className={cn("h-full flex-1", scLeft ? "bg-white/40" : "bg-garnet-bright")} />
      </div>
    </div>
  );
}

function LiveHero({ game, summary, updatedAt, onOpen }: HeroProps) {
  const now = useNow(5000);
  const sit = summary?.situation;
  const hasBall = (t: FBTeam) => sit?.possessionTeamId === t.id;
  const lastScore = summary?.scoringPlays[summary.scoringPlays.length - 1];
  const halftime = /halftime/i.test(game.detail);
  const clockText = halftime ? "Halftime" : `${periodLabel(game.period)}${game.clock ? ` · ${game.clock}` : ""}`;
  const score = (t: FBTeam) => (
    <div className="flex items-center gap-2">
      <span className={cn("w-[18px]", !hasBall(t) && "invisible")}>
        <PossessionIcon className="text-[#c08a4a]" />
      </span>
      <span className="text-[56px] font-semibold leading-none tracking-tight tabular">{t.score ?? "–"}</span>
      <span className="w-[18px]" />
    </div>
  );
  return (
    <div
      className="overflow-hidden rounded-3xl bg-[linear-gradient(180deg,rgba(115,0,10,0.55)_0%,rgba(17,17,19,1)_62%)] ring-1 ring-white/10"
      data-testid="hero-live"
    >
      <Tappable className="block w-full px-5 pt-4 pb-4 text-left" onTap={() => onOpen(game.id)}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[13px] font-semibold">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-live" />
            </span>
            LIVE
            <span className="font-medium text-white/80 tabular">{clockText}</span>
          </span>
          {summary?.demo ? <DemoBadge /> : game.tv[0] ? <span className="text-[12px] text-white/60">{game.tv[0]}</span> : null}
        </div>

        <div className="mt-4 flex items-start justify-between gap-2">
          <TeamColumn team={game.away} game={game} />
          <TeamColumn team={game.home} game={game} />
        </div>
        <div className="mt-2 flex items-center justify-around">
          {score(game.away)}
          {score(game.home)}
        </div>

        {sit?.downDistanceText && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-[14px] font-semibold tabular">{sit.downDistanceText}</span>
            {sit.isRedZone && (
              <span className="rounded-full bg-live/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                Red zone
              </span>
            )}
          </div>
        )}
        {sit?.lastPlay && <p className="mx-auto mt-2 max-w-sm text-center text-[13px] leading-snug text-white/60">{sit.lastPlay}</p>}

        {summary?.scWinProb !== undefined && (
          <div className="mt-4">
            <WinProbBar game={game} p={summary.scWinProb} />
          </div>
        )}

        <Linescore game={game} className="mt-4" />

        {lastScore && (
          <div className="mt-3 border-t border-white/[0.08] pt-1">
            <div className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Last score</div>
            <ScoringRow play={lastScore} game={game} />
          </div>
        )}
      </Tappable>
      <div className="flex items-center justify-between border-t border-white/[0.08] px-5 py-2.5 text-[12px] text-muted-foreground">
        <span>{summary?.demo ? "Frozen 3rd-quarter snapshot from a real game" : updatedAt && now ? `Updated ${ago(updatedAt, now)} · refreshes every 15s` : "Live from ESPN"}</span>
        <button type="button" onClick={() => onOpen(game.id)} className="flex items-center font-medium text-white/80">
          Box score <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

function CountdownBlock({ game }: { game: FBGame }) {
  const now = useNow(1000);
  if (!now) return <div className="h-[58px]" />;
  if (game.timeTBD) {
    const d = daysUntil(game.date, new Date(now));
    return (
      <div className="text-center">
        <div className="text-[40px] font-semibold leading-none tracking-tight tabular">{d <= 0 ? "Today" : d === 1 ? "Tomorrow" : `${d} days`}</div>
        <div className="mt-1.5 text-[12px] text-muted-foreground">Kickoff time not announced</div>
        {flexWindow(game.note) && (
          <div className="mt-0.5 text-[12px] text-muted-foreground tabular">Flex window: {flexWindow(game.note)}</div>
        )}
      </div>
    );
  }
  const c = countdown(game.date, now);
  if (c.past) {
    return (
      <div className="text-center">
        <div className="text-[28px] font-semibold leading-none">Kickoff</div>
        <div className="mt-1.5 text-[12px] text-muted-foreground">Waiting on ESPN for the first snap</div>
      </div>
    );
  }
  const parts: [number, string][] =
    c.days > 0
      ? [
          [c.days, "d"],
          [c.hours, "h"],
          [c.minutes, "m"],
        ]
      : [
          [c.hours, "h"],
          [c.minutes, "m"],
          [c.seconds, "s"],
        ];
  return (
    <div className="text-center" aria-label="Countdown to kickoff">
      <div className="flex items-baseline justify-center gap-2 text-[44px] font-semibold leading-none tracking-tight tabular">
        {parts.map(([v, u]) => (
          <span key={u}>
            {u === "d" ? v : String(v).padStart(2, "0")}
            <span className="ml-0.5 text-[18px] font-medium text-muted-foreground">{u}</span>
          </span>
        ))}
      </div>
      <div className="mt-1.5 text-[12px] text-muted-foreground">until kickoff</div>
    </div>
  );
}

function PregameHero({ game, summary, context, onOpen }: HeroProps) {
  const odds = summary?.odds;
  return (
    <div
      className="overflow-hidden rounded-3xl bg-[linear-gradient(180deg,rgba(115,0,10,0.42)_0%,rgba(17,17,19,1)_55%)] ring-1 ring-white/10"
      data-testid="hero-pregame"
    >
      <Tappable className="block w-full px-5 pt-4 pb-5 text-left" onTap={() => onOpen(game.id)}>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/70">
            Next game · {formatDay(game.date)}
          </span>
          {summary?.demo ? <DemoBadge /> : game.conference ? <span className="text-[12px] font-medium text-white/50">SEC</span> : null}
        </div>
        <div className="mt-4 flex items-start justify-between gap-1">
          <TeamColumn team={game.away} game={game} big conf />
          <div className="pt-4 text-[15px] font-medium text-white/40">{game.neutral ? "vs" : "at"}</div>
          <TeamColumn team={game.home} game={game} big conf />
        </div>
        <div className="mt-5">
          <CountdownBlock game={game} />
        </div>
        <div className="mt-5 space-y-1.5 text-[14px]">
          <div className="flex items-center justify-center gap-2 font-medium">
            <span className="tabular">{formatTimeZone(game.date, game.timeTBD)}</span>
            {game.tv.length > 0 && (
              <>
                <span className="text-white/30">·</span>
                <span className="flex items-center gap-1">
                  <Tv className="size-3.5 text-white/50" />
                  {game.tv.join(" / ")}
                </span>
              </>
            )}
          </div>
          {game.venue && (
            <div className="flex items-center justify-center gap-1 text-[13px] text-muted-foreground">
              <MapPin className="size-3.5" />
              <span className="truncate">{venueLine(game)}</span>
            </div>
          )}
        </div>
        {(odds?.details || odds?.overUnder) && (
          <div className="mt-4 flex justify-center gap-2 text-[13px]">
            {odds.details && (
              <span className="rounded-full bg-white/[0.08] px-3 py-1">
                <span className="text-muted-foreground">Line </span>
                <span className="font-semibold tabular">{odds.details}</span>
              </span>
            )}
            {odds.overUnder !== undefined && (
              <span className="rounded-full bg-white/[0.08] px-3 py-1">
                <span className="text-muted-foreground">O/U </span>
                <span className="font-semibold tabular">{odds.overUnder}</span>
              </span>
            )}
          </div>
        )}
        {odds?.provider && <p className="mt-1.5 text-center text-[11px] text-white/35">Odds: {odds.provider} via ESPN</p>}
      </Tappable>
      {context && <ContextRow game={context} onOpen={onOpen} label="Last" />}
    </div>
  );
}

function FinalHero({ game, summary, context, onOpen }: HeroProps) {
  const won = game.result === "W";
  const plays = summary?.scoringPlays ?? [];
  const recent = plays.slice(-3);
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl ring-1 ring-white/10",
        won ? "bg-[linear-gradient(180deg,rgba(115,0,10,0.5)_0%,rgba(17,17,19,1)_60%)]" : "bg-card",
      )}
      data-testid="hero-final"
    >
      <Tappable className="block w-full px-5 pt-4 pb-4 text-left" onTap={() => onOpen(game.id)}>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/70">
            {isOT(game) ? "Final/OT" : "Final"} · {formatDay(game.date)}
          </span>
          {summary?.demo ? <DemoBadge /> : null}
        </div>
        {game.result && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[13px] font-bold tracking-wide",
                won ? "bg-white text-garnet" : "bg-white/10 text-white/70",
              )}
            >
              {won ? "WIN" : game.result === "L" ? "LOSS" : "TIE"}
            </span>
          </div>
        )}
        <div className="mt-3 flex items-start justify-between gap-2">
          <TeamColumn team={game.away} game={game} dim={game.away.winner === false} />
          <TeamColumn team={game.home} game={game} dim={game.home.winner === false} />
        </div>
        <div className="mt-2 flex items-center justify-around text-[56px] font-semibold leading-none tracking-tight tabular">
          <span className={cn(game.away.winner === false && "text-white/45")}>{game.away.score ?? "–"}</span>
          <span className={cn(game.home.winner === false && "text-white/45")}>{game.home.score ?? "–"}</span>
        </div>
        <Linescore game={game} className="mt-5" />
        {recent.length > 0 && (
          <div className="mt-3 border-t border-white/[0.08] pt-1">
            <div className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">How it ended</div>
            <div className="divide-y divide-white/[0.06]">
              {recent.map((p) => (
                <ScoringRow key={p.id} play={p} game={game} compact />
              ))}
            </div>
          </div>
        )}
        <div className="mt-2 flex items-center justify-center text-[13px] font-medium text-white/80">
          {plays.length > 0 ? `All ${plays.length} scoring plays, stats & leaders` : "Box score"}
          <ChevronRight className="size-4" />
        </div>
      </Tappable>
      {context && <ContextRow game={context} onOpen={onOpen} label="Next" />}
    </div>
  );
}

export function FootballHero(props: HeroProps) {
  const g = props.game;
  if (g.state === "in") return <LiveHero {...props} />;
  if (g.state === "post") return <FinalHero {...props} />;
  return <PregameHero {...props} />;
}
