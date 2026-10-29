"use client";

import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { flexWindow, periodLabel, venueLine, type FBGame, type FBSummary } from "@/lib/football";
import { useFootballSummary } from "@/hooks/useFootball";
import { ErrorState, Rank, TeamLogo } from "@/components/shared/bits";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDay, formatTimeZone } from "@/components/shared/format";
import { Linescore, ScoringRow, isOT } from "./parts";

interface Props {
  /** Game from the schedule (always available) */
  game?: FBGame;
  /** Pre-built summary (demo mode) — skips the ESPN fetch */
  summary?: FBSummary;
  onClose: () => void;
}

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 mb-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{children}</h3>;
}

function Header({ g }: { g: FBGame }) {
  const side = (t: FBGame["home"]) => (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
      <TeamLogo src={t.logo} alt={t.shortName} size={44} />
      <div className="max-w-full text-[14px] font-semibold leading-tight">
        <Rank rank={t.rank} />
        {t.id === g.sc.id ? "South Carolina" : t.shortName}
      </div>
      {t.record && <div className="text-[12px] text-muted-foreground tabular">{t.record}</div>}
    </div>
  );
  const scores = g.state !== "pre" && g.away.score !== undefined && g.home.score !== undefined;
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-card px-3 py-4">
      {side(g.away)}
      <div className="shrink-0 text-center">
        {scores ? (
          <div className="flex items-center gap-2 text-[32px] font-semibold leading-none tabular">
            <span className={cn(g.away.winner === false && "text-white/45")}>{g.away.score}</span>
            <span className="text-[18px] text-white/25">–</span>
            <span className={cn(g.home.winner === false && "text-white/45")}>{g.home.score}</span>
          </div>
        ) : (
          <div className="text-[15px] text-white/40">{g.neutral ? "vs" : "at"}</div>
        )}
        <div className={cn("mt-1.5 text-[12px] font-medium", g.state === "in" ? "text-live" : "text-muted-foreground")}>
          {g.state === "in"
            ? `${periodLabel(g.period)} ${g.clock ?? ""}`
            : g.state === "post"
              ? isOT(g)
                ? "Final/OT"
                : "Final"
              : formatTimeZone(g.date, g.timeTBD)}
        </div>
      </div>
      {side(g.home)}
    </div>
  );
}

function Body({ s, note }: { s: FBSummary; note?: string }) {
  const g = s.game;
  const flex = g.state === "pre" && g.timeTBD ? flexWindow(note) : undefined;
  const byQuarter = new Map<number, typeof s.scoringPlays>();
  for (const p of s.scoringPlays) {
    byQuarter.set(p.period, [...(byQuarter.get(p.period) ?? []), p]);
  }
  return (
    <div>
      <Header g={g} />
      <p className="mt-2 text-center text-[12px] text-muted-foreground">
        {[formatDay(g.date), venueLine(g), s.attendance ? `${s.attendance.toLocaleString()} att.` : undefined, g.tv.join(" / ") || undefined]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {flex && (
        <div className="mt-4 rounded-2xl bg-card px-4 py-3" data-testid="flex-window">
          <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Kickoff window</div>
          <div className="mt-1 text-[16px] font-semibold tabular">{flex}</div>
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
            The SEC and TV partners pick one of these slots. Kickoff times are usually announced 6 to 12 days before the game.
          </p>
        </div>
      )}

      {/* border-collapse tables ignore padding, so the card padding lives on a wrapper. */}
      {g.state !== "pre" && (
        <div className="mt-4 rounded-2xl bg-card px-4 py-2">
          <Linescore game={g} />
        </div>
      )}

      {g.state === "pre" && (s.odds?.details || s.odds?.overUnder !== undefined) && (
        <>
          <H>Betting line</H>
          <div className="flex justify-between rounded-2xl bg-card px-4 py-3 text-[15px]">
            <span>
              <span className="text-muted-foreground">Spread </span>
              <span className="font-semibold tabular">{s.odds?.details ?? "—"}</span>
            </span>
            <span>
              <span className="text-muted-foreground">O/U </span>
              <span className="font-semibold tabular">{s.odds?.overUnder ?? "—"}</span>
            </span>
          </div>
          {s.odds?.provider && <p className="mt-1 px-1 text-[11px] text-white/35">{s.odds.provider} via ESPN</p>}
        </>
      )}

      {s.scoringPlays.length > 0 && (
        <>
          <H>Scoring</H>
          <div className="rounded-2xl bg-card px-4">
            {[...byQuarter.entries()].map(([q, plays]) => (
              <div key={q} className="border-b border-white/[0.06] last:border-0">
                <div className="pt-3 text-[12px] font-semibold text-white/50">{q <= 4 ? `${["1st", "2nd", "3rd", "4th"][q - 1]} quarter` : periodLabel(q)}</div>
                <div className="divide-y divide-white/[0.06]">
                  {plays.map((p) => (
                    <ScoringRow key={p.id} play={p} game={g} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {s.teamStats.length > 0 && (
        <>
          <H>Team stats</H>
          <div className="rounded-2xl bg-card px-4 py-1">
            <div className="flex justify-between py-2 text-[12px] font-semibold text-white/50">
              <span>{g.away.abbreviation}</span>
              <span>{g.home.abbreviation}</span>
            </div>
            {s.teamStats.map((r) => (
              <div key={r.key} className="flex items-center justify-between border-t border-white/[0.06] py-2.5 text-[14px] tabular">
                <span className="w-20 font-semibold">{r.away}</span>
                <span className="flex-1 text-center text-[13px] text-muted-foreground">{r.label}</span>
                <span className="w-20 text-right font-semibold">{r.home}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {s.leaders.length > 0 && (
        <>
          <H>Leaders</H>
          <div className="space-y-2">
            {s.leaders.map((cat) => (
              <div key={cat.key} className="rounded-2xl bg-card px-4 py-3">
                <div className="mb-2 text-[12px] font-semibold text-white/50">{cat.label}</div>
                <div className="space-y-2.5">
                  {cat.entries.map((e) => (
                    <div key={e.teamId} className="flex items-center gap-3">
                      <TeamLogo src={(e.teamId === g.home.id ? g.home : g.away).logo} alt={e.teamAbbr} size={22} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium">
                          {e.name}
                          {e.position && <span className="ml-1 text-[12px] text-muted-foreground">{e.position}</span>}
                        </div>
                        <div className="truncate text-[12px] text-muted-foreground tabular">{e.line}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {g.state === "in" && s.demo && (
        <p className="mt-6 text-center text-[12px] text-muted-foreground">Demo snapshot: box score and leaders are hidden mid-game.</p>
      )}
      {g.state === "post" && !s.scoringPlays.length && !s.teamStats.length && (
        <p className="mt-6 text-center text-[13px] text-muted-foreground">ESPN hasn&apos;t posted a box score for this game.</p>
      )}
      <p className="mt-6 text-center text-[11px] text-white/30">Source: ESPN{s.demo ? " · demo fixture" : ""}</p>
    </div>
  );
}

export function GameDetailSheet({ game, summary, onClose }: Props) {
  const q = useFootballSummary(game, !summary && !!game);
  const s = summary ?? q.data;
  const g = s?.game ?? game;
  // Flex-window notes get their own card in the body; the subtitle keeps bowl names etc.
  const rawNote = game?.note ?? g?.note;
  const subNote = rawNote && !flexWindow(rawNote) ? rawNote : undefined;
  const title = g ? `${g.neutral ? "vs" : g.scHome ? "vs" : "at"} ${g.opp.shortName}` : "Game";
  return (
    <Sheet open={!!game} onClose={onClose} title={title} subtitle={g ? formatDay(g.date) + (subNote ? ` · ${subNote}` : "") : undefined} testId="game-detail">
      {s ? (
        <Body s={s} note={game?.note ?? g?.note} />
      ) : q.isError ? (
        <ErrorState title="Couldn't load this game" detail="ESPN didn't respond." onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-28 w-full rounded-2xl bg-white/10" />
          <Skeleton className="h-16 w-full rounded-2xl bg-white/10" />
          <Skeleton className="h-48 w-full rounded-2xl bg-white/10" />
        </div>
      )}
    </Sheet>
  );
}
