"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { flexWindow, periodLabel, pickHeroGame, placeLabel, type FBGame, type FBSummary, type FootballSeason } from "@/lib/football";
import { getDemoSummary, type DemoMode } from "@/lib/football-demo";
import { useFootballSeason, useFootballSummary } from "@/hooks/useFootball";
import { Card, ErrorState, HeroSkeleton, ListSkeleton, SectionTitle, StaleNote, StatStrip } from "@/components/shared/bits";
import { ScheduleList, type ScheduleItem } from "@/components/shared/ScheduleList";
import { ago, useNow } from "@/components/shared/format";
import { FootballHero } from "./FootballHero";
import { GameDetailSheet } from "./GameDetailSheet";
import { track } from "@/lib/analytics/track";
import { isOT } from "./parts";

function toItem(g: FBGame): ScheduleItem {
  return {
    id: g.id,
    date: g.date,
    timeTBD: g.timeTBD,
    state: g.state,
    home: g.scHome,
    neutral: g.neutral,
    oppName: g.opp.shortName,
    oppLogo: g.opp.logo,
    oppRank: g.opp.rank,
    tv: g.tv[0],
    conference: g.conference,
    // Flex kickoff windows ("FLEX: 3:30 - 4:30pm OR 6 - 8pm ET start") read as a short window.
    note: flexWindow(g.note) ? `Flex ${flexWindow(g.note)}` : g.note,
    result: g.result,
    score: g.sc.score !== undefined && g.opp.score !== undefined ? `${g.sc.score}-${g.opp.score}` : undefined,
    ot: g.state === "post" && isOT(g),
    liveLabel: g.state === "in" ? periodLabel(g.period) : undefined,
  };
}

function SeasonStrip({ season, standings }: { season: FootballSeason; standings?: FBSummary["standings"] }) {
  // Prefer the place computed from the same table the page shows (ties labelled), so the
  // tile and the table can't disagree; ESPN's standingSummary ("11th in SEC") hides ties.
  const scRow = standings?.rows.find((r) => r.teamId === "2579");
  const standing = scRow?.place ? placeLabel(scRow.place, scRow.tied) : season.standing?.replace(/ in SEC$/, "");
  return (
    <section aria-label="Season">
      <StatStrip
        items={[
          { label: "Record", value: season.overall },
          { label: "SEC", value: season.conference },
          { label: "Standing", value: standing, sub: standing ? "in SEC" : undefined },
          { label: "Streak", value: season.streak },
        ]}
      />
      {season.pointsFor !== undefined && season.pointsAgainst !== undefined && (
        <p className="mt-2 px-1 text-center text-[12px] text-muted-foreground tabular">
          Scoring {season.pointsFor.toFixed(1)} a game · allowing {season.pointsAgainst.toFixed(1)}
        </p>
      )}
    </section>
  );
}

function SecStandings({ standings }: { standings: NonNullable<FBSummary["standings"]> }) {
  const [open, setOpen] = useState(false);
  const rows = standings.rows;
  const scIdx = rows.findIndex((r) => r.teamId === "2579");
  const shown = open || scIdx < 0 ? rows : rows.slice(Math.max(0, scIdx - 2), Math.max(0, scIdx - 2) + 5);
  return (
    <section>
      <SectionTitle right="SEC · Overall">SEC standings</SectionTitle>
      <Card className="overflow-hidden">
        <div className="divide-y divide-white/[0.06]">
          {shown.map((r) => {
            const sc = r.teamId === "2579";
            return (
              <div key={r.teamId} className={cn("flex items-center gap-3 px-4 py-2.5 text-[14px]", sc && "bg-white/[0.05] shadow-[inset_3px_0_0_var(--garnet-bright)]")}>
                <span className="w-8 shrink-0 text-[12px] text-muted-foreground tabular">
                  {r.place ? `${r.tied ? "T-" : ""}${r.place}` : "—"}
                </span>
                <span className={cn("flex-1 truncate", sc && "font-semibold")}>{r.name}</span>
                <span className="w-10 text-right font-medium tabular">{r.conf || "—"}</span>
                <span className="w-10 text-right text-muted-foreground tabular">{r.overall || "—"}</span>
              </div>
            );
          })}
        </div>
        {rows.length > shown.length || open ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-center gap-1 border-t border-white/[0.06] py-2.5 text-[13px] font-medium text-white/70"
          >
            {open ? "Show less" : `All ${rows.length} teams`}
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        ) : null}
      </Card>
      <p className="mt-1.5 px-1 text-[11px] text-white/35">
        Placed by SEC win %; T = tied on SEC record. Tied teams are listed in ESPN&apos;s game-feed order, not by tiebreaker.
      </p>
    </section>
  );
}

export function FootballView({ demo }: { demo: DemoMode | null }) {
  const season = useFootballSeason();
  const [selected, setSelected] = useState<string | null>(null);
  const now = useNow(30_000);

  const games = useMemo(() => season.data?.games ?? [], [season.data]);
  const heroGame = useMemo(() => (now ? pickHeroGame(games, now) : pickHeroGame(games)), [games, now]);
  const heroQuery = useFootballSummary(heroGame, !demo);
  const demoSummary = useMemo(() => (demo ? getDemoSummary(demo) : undefined), [demo]);

  const heroSummary = demoSummary ?? heroQuery.data;
  const hero = heroSummary?.game ?? heroGame;

  // If the summary says the game moved on (pre→in, in→post) the schedule is stale: refetch it.
  const { refetch: refetchSeason } = season;
  const summaryState = heroQuery.data?.game.state;
  useEffect(() => {
    if (!demo && heroGame && summaryState && summaryState !== heroGame.state) refetchSeason();
  }, [demo, heroGame, summaryState, refetchSeason]);

  const context = useMemo(() => {
    if (!hero) return undefined;
    if (hero.state === "post") return games.find((g) => g.state === "pre" && g.id !== hero.id);
    if (hero.state === "pre") return [...games].reverse().find((g) => g.state === "post" && g.id !== hero.id);
    return undefined;
  }, [games, hero]);

  const items = useMemo(() => games.map(toItem), [games]);
  // "hero" = opened from the hero card (uses the hero's live/demo summary); otherwise a schedule id.
  const selectedGame = selected === "hero" ? hero : selected ? games.find((g) => g.id === selected) : undefined;
  const openGame = (id: string, source: "hero" | "schedule") => {
    const g = id === "hero" ? hero : games.find((x) => x.id === id);
    track("game_open", { sport: "football", state: g?.state ?? null, source });
    setSelected(id);
  };
  const openFromHero = (id: string) => openGame(id === hero?.id ? "hero" : id, "hero");

  if (season.isPending) {
    return (
      <div className="space-y-6">
        <HeroSkeleton />
        <ListSkeleton rows={6} />
      </div>
    );
  }
  if (season.isError && !season.data) {
    return (
      <ErrorState
        title="Couldn't load football from ESPN"
        detail="Scores and the schedule come from ESPN, and it didn't answer. Nothing below would be accurate without it."
        onRetry={() => season.refetch()}
        retrying={season.isFetching}
      />
    );
  }
  const data = season.data!;

  return (
    <div className="space-y-6">
      {season.isError && <StaleNote when={now ? ago(season.dataUpdatedAt, now) : undefined} onRetry={() => season.refetch()} />}

      <section aria-label="Featured game">
        {hero ? (
          <FootballHero
            game={hero}
            summary={heroSummary}
            context={demo ? undefined : context}
            updatedAt={heroQuery.dataUpdatedAt || undefined}
            onOpen={openFromHero}
          />
        ) : (
          <Card className="px-5 py-8 text-center text-muted-foreground">No games on ESPN&apos;s schedule yet.</Card>
        )}
        {!demo && heroQuery.isError && hero && (
          <p className="mt-2 px-1 text-center text-[12px] text-muted-foreground">
            Game details didn&apos;t load from ESPN; showing schedule info.{" "}
            <button type="button" className="underline" onClick={() => heroQuery.refetch()}>
              Retry
            </button>
          </p>
        )}
      </section>

      {/* The demo hero is a frozen fixture; a live-season strip under it would show two records for SC. */}
      {!demo && <SeasonStrip season={data} standings={heroSummary?.standings} />}

      <section>
        <SectionTitle right={data.seasonLabel ? `${data.seasonLabel} season` : undefined}>Schedule</SectionTitle>
        <ScheduleList items={items} highlightId={heroGame?.state === "pre" ? heroGame.id : undefined} onSelect={(id) => openGame(id, "schedule")} testId="football-schedule" />
        <p className="mt-2 px-1 text-[11px] text-white/35">Times in your time zone. TBD = kickoff not announced yet. Rankings via ESPN.</p>
      </section>

      {heroSummary?.standings && !demo && <SecStandings standings={heroSummary.standings} />}

      <GameDetailSheet
        game={selectedGame}
        summary={demo && selected === "hero" ? demoSummary : undefined}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
