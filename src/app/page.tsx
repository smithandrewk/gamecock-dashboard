"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AppSport } from "@/lib/espn";
import { parseDemoMode } from "@/lib/football-demo";
import { usePush } from "@/hooks/usePush";
import { useInstall } from "@/hooks/useInstall";
import { FootballView } from "@/components/football/FootballView";
import { SportView } from "@/components/sports/SportView";
import { AppHeader, SPORT_TABS, SportTabBar } from "@/components/shell/AppChrome";
import { InstallSheet } from "@/components/shell/InstallSheet";
import { AlertsSheet } from "@/components/shell/AlertsSheet";

const SPORT_IDS = SPORT_TABS.map((t) => t.id);

function Dashboard() {
  const params = useSearchParams();
  const initial = params.get("sport") as AppSport | null;
  const [sport, setSport] = useState<AppSport>(initial && SPORT_IDS.includes(initial) ? initial : "football");
  const demo = parseDemoMode(params.get("demo"));
  const [sheet, setSheet] = useState<"install" | "alerts" | null>(null);
  const push = usePush();
  const install = useInstall();
  const scrollRef = useRef<HTMLElement>(null);

  const changeSport = useCallback((s: AppSport) => {
    setSport(s);
    scrollRef.current?.scrollTo({ top: 0 });
    // Keep the tab in the URL so a shared link / reload lands on the same sport.
    const url = new URL(window.location.href);
    if (s === "football") url.searchParams.delete("sport");
    else url.searchParams.set("sport", s);
    window.history.replaceState(null, "", url);
  }, []);

  // Deep link from a notification or the install guide: /?alerts=1 opens the alerts sheet.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a URL flag
    if (params.get("alerts") === "1") setSheet("alerts");
  }, [params]);

  const tab = SPORT_TABS.find((t) => t.id === sport)!;
  const closeSheet = useCallback(() => setSheet(null), []);

  return (
    // Fixed full-screen shell; only <main> scrolls. The Home Screen app draws a
    // translucent status bar and iOS blurs whatever scrolls beneath the clock,
    // so nothing may scroll under it (same fix as Sistine's shell).
    <div className="pt-safe flex h-dvh flex-col overflow-hidden bg-background">
      <AppHeader
        showInstall={install.ready && !install.standalone}
        subscribed={push.subscribed}
        onInstall={() => setSheet("install")}
        onNotify={() => setSheet("alerts")}
      />

      <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-lg px-4 pt-4 pb-6">
        <div className="mb-4 px-1">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">{tab.title}</h1>
          <p className="text-[13px] text-muted-foreground">South Carolina Gamecocks</p>
        </div>
        {sport === "football" ? <FootballView demo={demo} /> : <SportView key={sport} sport={sport} />}
        <p className="mt-10 text-center text-[11px] text-white/30">Scores and schedules from ESPN. Not affiliated with the University of South Carolina.</p>
        </div>
      </main>

      <SportTabBar value={sport} onChange={changeSport} />

      <AlertsSheet open={sheet === "alerts"} onClose={closeSheet} push={push} onOpenInstall={() => setSheet("install")} />
      <InstallSheet open={sheet === "install"} onClose={closeSheet} install={install} />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <Dashboard />
    </Suspense>
  );
}
