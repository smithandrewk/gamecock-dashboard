"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { StandingsEntry } from "@/lib/espn";
import { Card, SectionTitle, TeamLogo } from "@/components/shared/bits";
import { Skeleton } from "@/components/ui/skeleton";

interface SECStandingsProps {
  standings?: StandingsEntry[];
  isLoading?: boolean;
  title?: string;
}

/** Baseball SEC standings (ESPN standings API), sorted by SEC win %, collapsed to the rows around South Carolina. */
export function SECStandings({ standings, isLoading, title = "SEC standings" }: SECStandingsProps) {
  const [open, setOpen] = useState(false);
  if (isLoading) {
    return (
      <section>
        <SectionTitle>{title}</SectionTitle>
        <Skeleton className="h-48 w-full rounded-2xl bg-white/10" />
      </section>
    );
  }
  if (!standings || standings.length === 0) return null;
  const scIdx = standings.findIndex((e) => e.abbreviation === "SC" || e.teamName.includes("South Carolina"));
  const start = Math.max(0, Math.min(scIdx - 2, standings.length - 5));
  const shown = open || scIdx < 0 ? standings : standings.slice(start, start + 5);

  return (
    <section>
      <SectionTitle right="SEC % · Overall">{title}</SectionTitle>
      <Card className="overflow-hidden">
        <div className="divide-y divide-white/[0.06]">
          {shown.map((e) => {
            const sc = e.abbreviation === "SC" || e.teamName.includes("South Carolina");
            return (
              <div
                key={e.teamId}
                className={cn("flex items-center gap-3 px-4 py-2.5 text-[14px]", sc && "bg-white/[0.05] shadow-[inset_3px_0_0_var(--garnet-bright)]")}
              >
                <span className="w-5 text-right text-[12px] text-muted-foreground tabular">{standings.indexOf(e) + 1}</span>
                <TeamLogo src={e.logo} alt={e.abbreviation} size={20} />
                <span className={cn("flex-1 truncate", sc && "font-semibold")}>{e.shortName}</span>
                <span className="w-11 text-right font-medium tabular">{e.confWinPercent || "—"}</span>
                <span className="w-12 text-right text-muted-foreground tabular">{e.overall || "—"}</span>
              </div>
            );
          })}
        </div>
        {standings.length > 5 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-center gap-1 border-t border-white/[0.06] py-2.5 text-[13px] font-medium text-white/70"
          >
            {open ? "Show less" : `All ${standings.length} teams`}
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </Card>
    </section>
  );
}
