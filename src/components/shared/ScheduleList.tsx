"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, Rank, ResultChip, TeamLogo } from "./bits";
import { formatShortDate, formatTime } from "./format";

export interface ScheduleItem {
  id: string;
  date: string;
  timeTBD: boolean;
  state: "pre" | "in" | "post";
  home: boolean;
  neutral?: boolean;
  oppName: string;
  oppLogo?: string;
  oppRank?: number;
  tv?: string;
  conference?: boolean;
  /** Bowl / tournament name */
  note?: string;
  result?: "W" | "L" | "T";
  /** "27-24", SC score first */
  score?: string;
  /** "Final/OT" style suffix */
  ot?: boolean;
  liveLabel?: string;
}

interface Props {
  items: ScheduleItem[];
  /** id of the next game, highlighted */
  highlightId?: string;
  onSelect?: (id: string) => void;
  /** Group rows under month headers (long basketball/baseball schedules) */
  groupByMonth?: boolean;
  testId?: string;
}

function Row({ g, highlight, onSelect }: { g: ScheduleItem; highlight: boolean; onSelect?: (id: string) => void }) {
  const d = new Date(g.date);
  const content = (
    <>
      <div className="w-12 shrink-0 whitespace-nowrap text-center leading-tight">
        <div className="text-[11px] font-medium uppercase text-muted-foreground">
          {d.toLocaleDateString("en-US", { weekday: "short" })}
        </div>
        <div className="text-[14px] font-semibold tabular">{formatShortDate(g.date)}</div>
      </div>
      <TeamLogo src={g.oppLogo} alt={g.oppName} size={28} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium leading-tight">
          <span className="mr-1 text-muted-foreground">{g.neutral ? "vs" : g.home ? "vs" : "at"}</span>
          <Rank rank={g.oppRank} />
          {g.oppName}
        </div>
        <div className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
          {[g.note, g.state === "pre" ? g.tv : undefined, g.neutral ? "Neutral site" : undefined, g.conference ? "SEC" : undefined]
            .filter(Boolean)
            .join(" · ") || " "}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-right">
        {g.state === "post" && g.result ? (
          <>
            <span className="text-[15px] font-semibold tabular">
              {g.score}
              {g.ot && <span className="ml-0.5 text-[11px] font-medium text-muted-foreground">OT</span>}
            </span>
            <ResultChip result={g.result} />
          </>
        ) : g.state === "in" ? (
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-live">
            <span className="size-1.5 animate-pulse rounded-full bg-live" />
            {g.liveLabel ?? "Live"} {g.score}
          </span>
        ) : g.state === "post" ? (
          <span className="text-[13px] text-muted-foreground">Final</span>
        ) : (
          <span className={cn("text-[14px] tabular", g.timeTBD ? "text-muted-foreground" : "font-medium")}>
            {formatTime(g.date, g.timeTBD)}
          </span>
        )}
        {onSelect && <ChevronRight className="-mr-1 size-4 text-white/25" />}
      </div>
    </>
  );
  const cls = cn(
    "flex w-full items-center gap-3 px-4 py-3 text-left",
    highlight && "bg-white/[0.04] shadow-[inset_3px_0_0_var(--garnet-bright)]",
  );
  return onSelect ? (
    <button type="button" className={cn(cls, "active:bg-white/[0.06]")} onClick={() => onSelect(g.id)}>
      {content}
    </button>
  ) : (
    <div className={cls}>{content}</div>
  );
}

export function ScheduleList({ items, highlightId, onSelect, groupByMonth, testId }: Props) {
  if (!items.length) return null;
  if (!groupByMonth) {
    return (
      <Card className="divide-y divide-white/[0.06] overflow-hidden" data-testid={testId}>
        {items.map((g) => (
          <Row key={g.id} g={g} highlight={g.id === highlightId} onSelect={onSelect} />
        ))}
      </Card>
    );
  }
  const groups: { key: string; label: string; rows: ScheduleItem[] }[] = [];
  for (const g of items) {
    const d = new Date(g.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let grp = groups[groups.length - 1];
    if (!grp || grp.key !== key) {
      grp = { key, label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }), rows: [] };
      groups.push(grp);
    }
    grp.rows.push(g);
  }
  return (
    <div className="space-y-4" data-testid={testId}>
      {groups.map((grp) => (
        <div key={grp.key}>
          <div className="mb-1.5 px-1 text-[12px] font-medium text-muted-foreground">{grp.label}</div>
          <Card className="divide-y divide-white/[0.06] overflow-hidden">
            {grp.rows.map((g) => (
              <Row key={g.id} g={g} highlight={g.id === highlightId} onSelect={onSelect} />
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}
