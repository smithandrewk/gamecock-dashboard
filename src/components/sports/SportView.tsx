"use client";

import { useMemo, useState } from "react";
import { ChevronDown, MapPin, Tv } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBaseballStatus, gameVenueLine, getGameState, scView, type Game, type Sport, type TeamData } from "@/lib/espn";
import { useBaseballStandings, useGameSummary, useTeamData } from "@/hooks/useTeamData";
import { Card, ErrorState, HeroSkeleton, ListSkeleton, Rank, ResultChip, SectionTitle, StaleNote, StatStrip, TeamLogo } from "@/components/shared/bits";
import { ScheduleList, type ScheduleItem } from "@/components/shared/ScheduleList";
import { ago, countdown, daysUntil, formatDay, formatTimeZone, useNow } from "@/components/shared/format";
import { BaseballLinescore } from "@/components/BaseballLinescore";
import { SECStandings } from "@/components/SECStandings";

const COPY: Record<Sport, { name: string; start: string; period: (n?: number) => string }> = {
  wbb: { name: "Women's basketball", start: "tipoff", period: quarter },
  mbb: { name: "Men's basketball", start: "tipoff", period: half },
  baseball: { name: "Baseball", start: "first pitch", period: (n) => (n ? `Inning ${n}` : "") },
};

function quarter(n?: number) {
  if (!n) return "";
  return n <= 4 ? `Q${n}` : n === 5 ? "OT" : `${n - 4}OT`;
}
function half(n?: number) {
  if (!n) return "";
  return n === 1 ? "1st half" : n === 2 ? "2nd half" : n === 3 ? "OT" : `${n - 2}OT`;
}

function toItem(g: Game, sport: Sport): ScheduleItem {
  const v = scView(g);
  const state = getGameState(g);
  return {
    id: g.id,
    date: g.date,
    timeTBD: g.timeTBD,
    state: state === "live" ? "in" : state === "final" ? "post" : "pre",
    home: v.scHome,
    neutral: g.neutral,
    oppName: v.opp.name || v.opp.displayName,
    oppLogo: v.opp.logo,
    oppRank: v.opp.rank,
    tv: g.broadcast,
    conference: g.isConference,
    note: g.note,
    result: v.result,
    score: v.scScore !== undefined && v.oppScore !== undefined ? `${v.scScore}-${v.oppScore}` : undefined,
    liveLabel: state === "live" ? (sport === "baseball" ? formatBaseballStatus(g) : COPY[sport].period(g.status.period)) : undefined,
  };
}

/** Team name for display: never bare "USC" (that's also the Trojans). */
function teamLabel(t: Game["homeTeam"]) {
  if (t.abbreviation === "SC" || t.displayName?.includes("South Carolina")) return "South Carolina";
  return t.name || t.displayName;
}

/** "SEC Tournament - First Round" → "SEC Tournament" (the round reads as noise in a one-line row). */
function shortEvent(note?: string) {
  return note?.split(/\s+-\s+/)[0];
}

function Matchup({ game, big }: { game: Game; big?: boolean }) {
  const col = (t: Game["homeTeam"], score?: number, dim?: boolean) => (
    <div className={cn("flex min-w-0 flex-1 flex-col items-center text-center", dim && "opacity-55")}>
      <TeamLogo src={t.logo} alt={teamLabel(t)} size={big ? 56 : 48} />
      <div className="mt-2 max-w-full truncate text-[15px] font-semibold">
        <Rank rank={t.rank} />
        {teamLabel(t)}
      </div>
      {t.record && <div className="mt-0.5 text-[12px] text-muted-foreground tabular">{t.record}</div>}
      {score !== undefined && <div className="mt-2 text-[48px] font-semibold leading-none tracking-tight tabular">{score}</div>}
    </div>
  );
  const final = getGameState(game) === "final";
  const showScores = getGameState(game) !== "upcoming";
  const homeLost = final && (game.homeScore ?? 0) < (game.awayScore ?? 0);
  const awayLost = final && (game.awayScore ?? 0) < (game.homeScore ?? 0);
  return (
    <div className="flex items-start justify-between gap-1">
      {col(game.awayTeam, showScores ? game.awayScore : undefined, awayLost)}
      <div className="pt-5 text-[15px] font-medium text-white/40">{showScores ? "" : game.neutral ? "vs" : "at"}</div>
      {col(game.homeTeam, showScores ? game.homeScore : undefined, homeLost)}
    </div>
  );
}

function Countdown({ game, start }: { game: Game; start: string }) {
  const now = useNow(1000);
  if (!now) return <div className="h-[58px]" />;
  if (game.timeTBD) {
    const d = daysUntil(game.date, new Date(now));
    return (
      <div className="text-center">
        <div className="text-[40px] font-semibold leading-none tabular">{d <= 0 ? "Today" : d === 1 ? "Tomorrow" : `${d} days`}</div>
        <div className="mt-1.5 text-[12px] text-muted-foreground">Time not announced</div>
      </div>
    );
  }
  const c = countdown(game.date, now);
  if (c.past) return <div className="text-center text-[24px] font-semibold">Starting</div>;
  const parts: [number, string][] =
    c.days > 0 ? [[c.days, "d"], [c.hours, "h"], [c.minutes, "m"]] : [[c.hours, "h"], [c.minutes, "m"], [c.seconds, "s"]];
  return (
    <div className="text-center">
      <div className="flex items-baseline justify-center gap-2 text-[44px] font-semibold leading-none tracking-tight tabular">
        {parts.map(([v, u]) => (
          <span key={u}>
            {u === "d" ? v : String(v).padStart(2, "0")}
            <span className="ml-0.5 text-[18px] font-medium text-muted-foreground">{u}</span>
          </span>
        ))}
      </div>
      <div className="mt-1.5 text-[12px] text-muted-foreground">until {start}</div>
    </div>
  );
}

const HERO_BG = "overflow-hidden rounded-3xl ring-1 ring-white/10 bg-[linear-gradient(180deg,rgba(115,0,10,0.42)_0%,rgba(17,17,19,1)_55%)]";

function Hero({ sport, data, now }: { sport: Sport; data: TeamData; now: number }) {
  const copy = COPY[sport];
  const live = data.schedule.find((g) => getGameState(g) === "live");
  const next = data.schedule.find((g) => getGameState(g) === "upcoming");
  const last = data.lastGame;
  const heroGame = live ?? (last && now && now - new Date(last.date).getTime() < 20 * 3600_000 ? last : undefined) ?? next ?? last;
  const isBaseball = sport === "baseball";
  const summary = useGameSummary(isBaseball && heroGame && getGameState(heroGame) !== "upcoming" ? heroGame.id : undefined, !!live);
  if (!heroGame) return <Card className="px-5 py-8 text-center text-muted-foreground">No games on ESPN&apos;s schedule yet.</Card>;

  const state = getGameState(heroGame);
  const opener = state === "upcoming" && !data.lastGame;
  const offseason = !next && !live;

  if (offseason && last) {
    const v = scView(last);
    return (
      <div className="overflow-hidden rounded-3xl bg-card ring-1 ring-white/10" data-testid="hero-offseason">
        <div className="px-5 pt-4 pb-5">
          <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/70">Offseason</div>
          <p className="mt-3 text-[15px] text-white/80">
            The {data.seasonYear ?? ""} season is over. ESPN hasn&apos;t posted the {data.seasonYear ? data.seasonYear + 1 : "next"} schedule yet.
          </p>
          <div className="mt-5 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Last season · final record</div>
          <div className="mt-1 text-[44px] font-semibold leading-none tracking-tight tabular">{data.record.overall ?? "—"}</div>
          {data.record.conference && <div className="mt-1 text-[14px] text-muted-foreground tabular">{data.record.conference} in SEC play</div>}
        </div>
        <div className="flex items-center gap-3 border-t border-white/[0.08] px-5 py-3 text-[14px]">
          <span className="w-10 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Last</span>
          {v.result && <ResultChip result={v.result} />}
          <TeamLogo src={v.opp.logo} alt={v.opp.name} size={20} />
          <span className="min-w-0 flex-1">
            <span className="block truncate">
              <span className="mr-1 font-semibold tabular">
                {v.scScore}-{v.oppScore}
              </span>
              <span className="text-muted-foreground">{v.scHome || last.neutral ? "vs" : "at"} </span>
              {v.opp.name}
            </span>
            <span className="line-clamp-2 block text-[12px] leading-snug text-muted-foreground">
              {[
                new Date(last.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                last.neutral ? [shortEvent(last.note), last.venueCity?.split(",")[0]].filter(Boolean).join(", ") || "Neutral site" : undefined,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={state === "final" && scView(heroGame).result !== "W" ? "overflow-hidden rounded-3xl bg-card ring-1 ring-white/10" : HERO_BG} data-testid={`hero-${state}`}>
      <div className="px-5 pt-4 pb-5">
        <div className="flex items-center justify-between">
          {state === "live" ? (
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              <span className="size-2 animate-pulse rounded-full bg-live" />
              LIVE
              <span className="font-medium text-white/80 tabular">
                {isBaseball ? formatBaseballStatus(heroGame) : `${copy.period(heroGame.status.period)} · ${heroGame.status.displayClock ?? ""}`}
              </span>
            </span>
          ) : (
            <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/70">
              {state === "final" ? `Final · ${formatDay(heroGame.date)}` : `${opener ? "Season opener" : "Next game"} · ${formatDay(heroGame.date)}`}
            </span>
          )}
          {heroGame.isConference && <span className="text-[12px] font-medium text-white/50">SEC</span>}
        </div>
        <div className="mt-4">
          <Matchup game={heroGame} big={state === "upcoming"} />
        </div>
        {state === "upcoming" && (
          <>
            <div className="mt-5">
              <Countdown game={heroGame} start={copy.start} />
            </div>
            <div className="mt-5 space-y-1.5 text-center text-[14px]">
              <div className="flex items-center justify-center gap-2 font-medium">
                <span className="tabular">{formatTimeZone(heroGame.date, heroGame.timeTBD)}</span>
                {heroGame.broadcast && (
                  <>
                    <span className="text-white/30">·</span>
                    <span className="flex items-center gap-1">
                      <Tv className="size-3.5 text-white/50" />
                      {heroGame.broadcast}
                    </span>
                  </>
                )}
              </div>
              {(heroGame.venue || heroGame.venueCity) && (
                <div className="flex items-center justify-center gap-1 text-[13px] text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {gameVenueLine(heroGame)}
                    {heroGame.neutral ? " · Neutral site" : ""}
                  </span>
                </div>
              )}
              {heroGame.note && (
                <div className="text-[13px] text-muted-foreground">
                  <span className="mr-1.5 text-[11px] font-semibold tracking-wider uppercase">Event</span>
                  {heroGame.note}
                </div>
              )}
            </div>
          </>
        )}
        {isBaseball && summary.data && summary.data.linescore.length > 0 && (
          <div className="mt-4">
            <BaseballLinescore
              linescore={summary.data.linescore}
              homeTeamName={heroGame.homeTeam.abbreviation}
              awayTeamName={heroGame.awayTeam.abbreviation}
              homeRuns={heroGame.homeScore ?? 0}
              awayRuns={heroGame.awayScore ?? 0}
              homeHits={summary.data.homeHits}
              awayHits={summary.data.awayHits}
              homeErrors={summary.data.homeErrors}
              awayErrors={summary.data.awayErrors}
              currentInning={heroGame.status.period}
              isLive={state === "live"}
            />
          </div>
        )}
      </div>
      {state === "final" && next && <NextRow game={next} />}
    </div>
  );
}

function NextRow({ game }: { game: Game }) {
  const v = scView(game);
  return (
    <div className="flex items-center gap-3 border-t border-white/[0.08] px-5 py-3 text-[14px]">
      <span className="w-10 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Next</span>
      <TeamLogo src={v.opp.logo} alt={v.opp.name} size={20} />
      <span className="min-w-0 flex-1 truncate">
        <span className="text-muted-foreground">{v.scHome || game.neutral ? "vs" : "at"} </span>
        <Rank rank={v.opp.rank} />
        {v.opp.name}
      </span>
      <span className="shrink-0 text-[13px] text-muted-foreground">{formatDay(game.date)}</span>
    </div>
  );
}

function Results({ items, label }: { items: ScheduleItem[]; label: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 8);
  return (
    <section>
      <SectionTitle right={`${items.length} games`}>{label}</SectionTitle>
      <ScheduleList items={shown} />
      {items.length > shown.length || all ? (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl py-2 text-[13px] font-medium text-white/70"
        >
          {all ? "Show fewer" : `Show all ${items.length}`}
          <ChevronDown className={cn("size-4 transition-transform", all && "rotate-180")} />
        </button>
      ) : null}
    </section>
  );
}

export function SportView({ sport }: { sport: Sport }) {
  const q = useTeamData(sport);
  const now = useNow(30_000);
  const data = q.data;
  const isBaseball = sport === "baseball";
  const standings = useBaseballStandings(data?.seasonYear, isBaseball && !!data);

  const { upcoming, results } = useMemo(() => {
    const games = data?.schedule ?? [];
    return {
      upcoming: games.filter((g) => getGameState(g) !== "final").map((g) => toItem(g, sport)),
      results: games
        .filter((g) => getGameState(g) === "final")
        .map((g) => toItem(g, sport))
        .reverse(),
    };
  }, [data, sport]);

  if (q.isPending) {
    return (
      <div className="space-y-6">
        <HeroSkeleton />
        <ListSkeleton rows={6} />
      </div>
    );
  }
  if (q.isError && !data) {
    return (
      <ErrorState
        title={`Couldn't load ${COPY[sport].name.toLowerCase()} from ESPN`}
        detail="ESPN didn't answer. Try again in a moment."
        onRetry={() => q.refetch()}
        retrying={q.isFetching}
      />
    );
  }
  const d = data!;
  const next = d.schedule.find((g) => getGameState(g) === "upcoming");
  const played = results.length > 0;
  const offseason = !next && !d.schedule.some((g) => getGameState(g) === "live");
  const seasonName = d.seasonLabel ? `${d.seasonLabel} season` : undefined;

  return (
    <div className="space-y-6">
      {q.isError && <StaleNote when={now ? ago(q.dataUpdatedAt, now) : undefined} onRetry={() => q.refetch()} />}
      <section aria-label="Featured game">
        <Hero sport={sport} data={d} now={now} />
      </section>

      {played && !offseason && (
        <StatStrip
          items={[
            { label: "Record", value: d.record.overall },
            { label: "SEC", value: d.record.conference },
          ]}
        />
      )}
      {!played && next && (
        <p className="-mt-2 px-1 text-center text-[13px] text-muted-foreground">
          {(() => {
            const n = daysUntil(next.date);
            return `Season starts ${n <= 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`} · no record yet`;
          })()}
        </p>
      )}

      {upcoming.length > 0 && (
        <section>
          <SectionTitle right={seasonName}>Schedule</SectionTitle>
          <ScheduleList items={upcoming} highlightId={next?.id} groupByMonth testId={`${sport}-schedule`} />
          <p className="mt-2 px-1 text-[11px] text-white/35">Times in your time zone. TBD = time not announced. Rankings via ESPN.</p>
        </section>
      )}

      {isBaseball && (
        <SECStandings
          standings={standings.data?.entries}
          isLoading={standings.isPending && !!data?.seasonYear}
          title={offseason ? `SEC standings · ${standings.data?.season ?? d.seasonYear ?? ""} final` : "SEC standings"}
        />
      )}

      {results.length > 0 && <Results items={results} label={offseason ? `Results · ${d.seasonYear ?? "last"} season` : "Results"} />}
    </div>
  );
}
