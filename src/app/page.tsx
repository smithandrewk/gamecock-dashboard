"use client";

import { useState } from "react";
import { Sport } from "@/lib/espn";
import { useTeamData } from "@/hooks/useTeamData";
import { SportTabs } from "@/components/SportTabs";
import { SmartHero } from "@/components/SmartHero";
import { ScheduleList } from "@/components/ScheduleList";
import { ResultsList } from "@/components/ResultsList";
import { StreakChart } from "@/components/StreakChart";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const [sport, setSport] = useState<Sport>("mbb");
  const { data, isLoading, error } = useTeamData(sport);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-center mb-4 text-primary">
            Gamecock AI
          </h1>
          <SportTabs value={sport} onChange={setSport} />
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-8">
        {error ? (
          <div className="text-center text-destructive py-8">
            Failed to load data. Please try again.
          </div>
        ) : (
          <>
            <section>
              <SmartHero data={data} isLoading={isLoading} />
            </section>

            {data && (
              <>
                <div className="flex items-center justify-center gap-6 text-center">
                  <div>
                    <p className="text-2xl font-bold">{data.record.overall}</p>
                    <p className="text-sm text-muted-foreground">Overall</p>
                  </div>
                  <div className="w-px h-10 bg-border" />
                  <div>
                    <p className="text-2xl font-bold">{data.record.conference}</p>
                    <p className="text-sm text-muted-foreground">Conference</p>
                  </div>
                </div>

                <StreakChart games={data.schedule} />
              </>
            )}

            <section>
              <h2 className="text-lg font-semibold mb-4">Upcoming Games</h2>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : data ? (
                <ScheduleList games={data.schedule} />
              ) : null}
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-4">Recent Results</h2>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : data ? (
                <ResultsList games={data.schedule} />
              ) : null}
            </section>
          </>
        )}
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>Go Gamecocks!</p>
      </footer>
    </div>
  );
}
