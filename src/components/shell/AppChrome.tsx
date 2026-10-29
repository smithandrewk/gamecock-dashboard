"use client";

import Image from "next/image";
import { Bell, BellRing, SquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppSport } from "@/lib/espn";

export const SPORT_TABS: { id: AppSport; label: string; title: string }[] = [
  { id: "football", label: "Football", title: "Football" },
  { id: "wbb", label: "Women's BB", title: "Women's Basketball" },
  { id: "mbb", label: "Men's BB", title: "Men's Basketball" },
  { id: "baseball", label: "Baseball", title: "Baseball" },
];

interface HeaderProps {
  showInstall: boolean;
  subscribed: boolean;
  onInstall: () => void;
  onNotify: () => void;
}

/** Compact top bar: brand on the left, install + alerts on the right. The shell pads it below the status bar. */
export function AppHeader({ showInstall, subscribed, onInstall, onNotify }: HeaderProps) {
  return (
    <header className="z-40 flex-none border-b border-white/[0.06] bg-black">
      <div className="mx-auto flex h-12 max-w-lg items-center gap-2 px-4">
        <Image src="/gamecock.svg" alt="" width={20} height={22} className="pixelated" priority />
        <span className="text-[17px] font-semibold tracking-tight">Gamecock AI</span>
        <div className="ml-auto flex items-center gap-1.5">
          {showInstall && (
            <button
              type="button"
              onClick={onInstall}
              data-testid="install-open"
              className="relative flex h-8 items-center gap-1.5 rounded-full bg-white/[0.1] pr-3 pl-2.5 text-[13px] font-semibold before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] active:bg-white/[0.16]"
            >
              <SquarePlus className="size-4" aria-hidden />
              Get the app
            </button>
          )}
          <button
            type="button"
            onClick={onNotify}
            data-testid="notify-open"
            aria-label={subscribed ? "Game alerts (on)" : "Game alerts"}
            className="relative grid size-9 place-items-center rounded-full before:absolute before:-inset-1 before:content-[''] active:bg-white/[0.1]"
          >
            {subscribed ? <BellRing className="size-[21px]" /> : <Bell className="size-[21px]" />}
            {subscribed && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-garnet-bright ring-2 ring-black" />}
          </button>
        </div>
      </div>
    </header>
  );
}

function SportIcon({ sport, className }: { sport: AppSport; className?: string }) {
  const common = { className: cn("size-[26px]", className), viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (sport === "football") {
    return (
      <svg {...common}>
        <path d="M19.5 4.5c-5-1-10.3.3-13.2 3.2S2.6 15.9 3.6 20.9c5 1 10.3-.3 13.2-3.2s4.1-8.2 2.7-13.2Z" />
        <path d="m9 15 6-6M10.5 10.5l1 1M12.5 8.5l1 1M8.5 12.5l1 1M14.5 13.5l-1-1" />
      </svg>
    );
  }
  if (sport === "baseball") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M6.2 5.2c1.8 1.9 2.8 4.3 2.8 6.8s-1 4.9-2.8 6.8M17.8 5.2C16 7.1 15 9.5 15 12s1 4.9 2.8 6.8" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18M5.6 5.6c2.6 1.7 3.9 3.9 3.9 6.4s-1.3 4.7-3.9 6.4M18.4 5.6c-2.6 1.7-3.9 3.9-3.9 6.4s1.3 4.7 3.9 6.4" />
    </svg>
  );
}

/**
 * Bottom tab bar. Why bottom: 95% of visits are on a phone held in one hand, and the
 * bottom edge is where the thumb already rests (iOS apps put top-level sections there).
 * A top segmented control for four sports would sit in the hardest-to-reach band.
 */
export function SportTabBar({ value, onChange }: { value: AppSport; onChange: (s: AppSport) => void }) {
  return (
    <nav
      className="pb-safe z-40 flex-none border-t border-white/[0.08] bg-black"
      aria-label="Sports"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4" role="tablist">
        {SPORT_TABS.map((t) => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`sport-tab-${t.id}`}
              onClick={() => onChange(t.id)}
              className={cn(
                "flex h-[56px] flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors",
                active ? "text-white" : "text-white/45 active:text-white/70",
              )}
            >
              <SportIcon sport={t.id} className={active ? "text-garnet-bright" : undefined} />
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
