"use client";

import Script from "next/script";
import { useEffect } from "react";
import { track } from "@/lib/analytics/track";
import type { InstallState } from "@/hooks/useInstall";
import type { AppSport } from "@/lib/espn";

/** Vantage beacon + one app_open per load. Rendered by the fan dashboard only, so /admin visits never count. */
export function Analytics({ install, sport }: { install: InstallState; sport: AppSport }) {
  useEffect(() => {
    if (!install.ready) return;
    track("app_open", { standalone: install.standalone, platform: install.platform, sport });
    // Once per load: the sport is the landing tab, later switches are tab_view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [install.ready]);

  return <Script src="https://vantage.entrpy.co/b.js" data-site="gamecock" strategy="afterInteractive" />;
}
