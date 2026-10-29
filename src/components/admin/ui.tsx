import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Sourced } from "@/lib/admin/sourced";

// Admin building blocks. Server components only: plain SVG/CSS, no chart library, no
// client JS. Every block that shows data takes a Sourced<T> and renders its error
// instead of a 0 when the source failed.

export const fmt = (n: number) => n.toLocaleString("en-US");
export const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

export function Section({ title, kicker, children, foot }: { title: string; kicker?: string; children: ReactNode; foot?: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="px-1">
        <h2 className="text-[19px] font-semibold tracking-tight">{title}</h2>
        {kicker && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{kicker}</p>}
      </div>
      {children}
      {foot && <p className="px-1 text-[11px] leading-snug text-white/35">{foot}</p>}
    </section>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4", className)}>{children}</div>;
}

export function ErrorNote({ error, source }: { error: string; source: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-[13px] text-red-300">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>
        Couldn&apos;t load from {source}: <span className="font-mono text-[12px]">{error}</span>
      </span>
    </div>
  );
}

/** Render a Sourced block: data → children, error → the error, never a blank or a 0. */
export function From<T>({ s, children }: { s: Sourced<T>; children: (data: T) => ReactNode }) {
  if (!s.ok) return <ErrorNote error={s.error} source={s.source} />;
  return <>{children(s.data)}</>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-3 text-center text-[13px] text-muted-foreground">{children}</p>;
}

// ---------- stat tile ----------

export function Delta({ now, prev, label }: { now: number; prev: number; label: string }) {
  if (prev === 0) return <span className="text-white/40">{now > 0 ? `new vs ${label}` : `— vs ${label}`}</span>;
  const d = Math.round(((now - prev) / prev) * 100);
  return (
    <span className={d > 0 ? "text-emerald-400" : d < 0 ? "text-red-400" : "text-white/50"}>
      {d > 0 ? "▲" : d < 0 ? "▼" : "•"} {Math.abs(d)}% <span className="text-white/40">vs {label}</span>
    </span>
  );
}

export function Stat({ label, value, sub, chart, accent }: { label: ReactNode; value: ReactNode; sub?: ReactNode; chart?: ReactNode; accent?: boolean }) {
  return (
    <Card className={cn("flex min-h-[120px] flex-col gap-1 p-3.5", accent && "border-garnet/40 bg-garnet/[0.12]")}>
      <div className="text-[11px] font-semibold tracking-wider text-white/50 uppercase">{label}</div>
      <div className="text-[28px] leading-none font-bold tracking-tight tabular-nums">{value}</div>
      {sub && <div className="text-[12px] leading-snug text-white/60">{sub}</div>}
      {chart && <div className="mt-auto pt-2">{chart}</div>}
    </Card>
  );
}

// ---------- charts ----------

/** Tiny bar sparkline. null = no data that day (before collection began), drawn as a gap. */
export function Spark({ values, className }: { values: (number | null)[]; className?: string }) {
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  const w = 100 / values.length;
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className={cn("h-6 w-full", className)} aria-hidden>
      {values.map((v, i) =>
        v == null ? (
          <rect key={i} x={i * w + w * 0.15} y={22.5} width={w * 0.7} height={1.5} className="fill-white/10" />
        ) : (
          <rect key={i} x={i * w + w * 0.15} y={24 - Math.max(1.5, (v / max) * 24)} width={w * 0.7} height={Math.max(1.5, (v / max) * 24)} className="fill-garnet-bright/80" />
        ),
      )}
    </svg>
  );
}

export type StackedDay = { day: string; a: number; b: number; noData: boolean };

/** Daily stacked bars: a (bottom, garnet) + b (top, white). */
export function StackedBars({ days, aLabel, bLabel }: { days: StackedDay[]; aLabel: string; bLabel: string }) {
  const max = Math.max(1, ...days.map((d) => d.a + d.b));
  const w = 100 / days.length;
  const label = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const peak = days.reduce((m, d) => (d.a + d.b > m.a + m.b ? d : m), days[0]);
  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-[12px] text-white/60">
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-garnet-bright" />{aLabel}</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-white/70" />{bLabel}</span>
        <span className="ml-auto tabular-nums">peak {fmt(peak.a + peak.b)} · {label(peak.day)}</span>
      </div>
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label={`${aLabel} and ${bLabel} by day`}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2="100" y1={60 * f} y2={60 * f} className="stroke-white/[0.06]" strokeWidth="0.3" />)}
        {days.map((d, i) => {
          const x = i * w + w * 0.12, bw = w * 0.76;
          if (d.noData) return <rect key={d.day} x={x} y={58.8} width={bw} height={1.2} className="fill-white/10" />;
          const ha = (d.a / max) * 58, hb = (d.b / max) * 58;
          return (
            <g key={d.day}>
              <rect x={x} y={60 - ha} width={bw} height={ha} className="fill-garnet-bright" />
              <rect x={x} y={60 - ha - hb} width={bw} height={hb} className="fill-white/70" />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-white/40 tabular-nums">
        <span>{label(days[0].day)}</span>
        <span>{label(days[Math.floor(days.length / 2)].day)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

export function BarList({ rows, total, unit = "visitors", max: maxRows = 8 }: { rows: { label: string; value: number; hint?: string }[]; total?: number; unit?: string; max?: number }) {
  if (!rows.length) return <Empty>Nothing yet.</Empty>;
  const top = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.slice(0, maxRows).map((r) => (
        <li key={r.label} className="relative overflow-hidden rounded-md bg-white/[0.025]">
          <div className="absolute inset-y-0 left-0 bg-garnet/50" style={{ width: `${(r.value / top) * 100}%` }} />
          <div className="relative flex items-center justify-between gap-3 px-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-[14px]">{r.label}</span>
              {r.hint && <span className="block truncate text-[11px] text-white/50">{r.hint}</span>}
            </span>
            <span className="shrink-0 text-[14px] tabular-nums text-white/85">
              {fmt(r.value)}
              {total ? <span className="ml-1.5 text-[12px] text-white/45">{pct(r.value, total)}</span> : null}
            </span>
          </div>
        </li>
      ))}
      <li className="sr-only">{unit}</li>
    </ul>
  );
}

export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const first = steps[0]?.value ?? 0;
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].value : s.value;
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-baseline justify-between text-[13px]">
              <span className="text-white/80">{s.label}</span>
              <span className="tabular-nums">
                <b className="text-[15px]">{fmt(s.value)}</b>
                {i > 0 && <span className="ml-1.5 text-white/45">{pct(s.value, prev)} of previous</span>}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-garnet-bright" style={{ width: first ? `${Math.max(2, (s.value / first) * 100)}%` : "0%" }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Weekly cohort retention. Cells are the share of the cohort active again N weeks later. */
export function RetentionGrid({ cohorts }: { cohorts: { week: string; size: number; retained: (number | null)[] }[] }) {
  if (!cohorts.length) return <Empty>No cohorts yet. The first one forms this week.</Empty>;
  const cols = cohorts[0].retained.length;
  const label = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full border-separate border-spacing-[3px] text-[11px] tabular-nums">
        <thead>
          <tr className="text-white/45">
            <th className="pr-1 text-left font-medium">Week of</th>
            <th className="font-medium">Fans</th>
            {Array.from({ length: cols }, (_, i) => <th key={i} className="font-medium">+{i + 1}w</th>)}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.week}>
              <td className="pr-1 whitespace-nowrap text-white/70">{label(c.week)}</td>
              <td className="text-center text-white/80">{fmt(c.size)}</td>
              {c.retained.map((r, i) => (
                <td
                  key={i}
                  className={cn("h-7 min-w-[30px] rounded text-center", r == null ? "bg-transparent text-white/15" : "text-white")}
                  style={r == null ? undefined : { backgroundColor: `rgba(224, 65, 79, ${0.08 + r * 0.92})` }}
                >
                  {r == null ? "·" : `${Math.round(r * 100)}`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Sessions by weekday × hour (Eastern). */
export function Heatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(1, ...grid.flat());
  const order = [6, 0, 1, 2, 3, 4, 5]; // Saturday first: it's football season
  const hours = [0, 6, 12, 18];
  let best = { d: 0, h: 0, n: -1 };
  grid.forEach((row, d) => row.forEach((n, h) => { if (n > best.n) best = { d, h, n }; }));
  const hr = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
  return (
    <div>
      <div className="grid grid-cols-[30px_1fr] gap-x-1.5 gap-y-[3px] text-[10px] text-white/45">
        {order.map((d) => (
          <div key={d} className="contents">
            <div className="self-center">{DOW[d]}</div>
            <div className="grid grid-cols-24 gap-[2px]">
              {grid[d].map((n, h) => (
                <div key={h} className="aspect-square rounded-[2px]" title={`${DOW[d]} ${hr(h)}: ${n}`}
                  style={{ backgroundColor: n ? `rgba(224, 65, 79, ${0.12 + (n / max) * 0.88})` : "rgba(255,255,255,0.04)" }} />
              ))}
            </div>
          </div>
        ))}
        <div />
        <div className="relative mt-1 h-3">
          {hours.map((h) => <span key={h} className="absolute" style={{ left: `${(h / 24) * 100}%` }}>{hr(h)}</span>)}
        </div>
      </div>
      {best.n > 0 && <p className="mt-2 text-[12px] text-white/60">Busiest: <b className="text-white">{DOW[best.d]} {hr(best.h)}</b> ET · {fmt(best.n)} sessions started</p>}
    </div>
  );
}

export function Pill({ tone, children }: { tone: "good" | "warn" | "bad" | "muted"; children: ReactNode }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
      tone === "good" && "bg-emerald-500/15 text-emerald-300",
      tone === "warn" && "bg-amber-500/15 text-amber-300",
      tone === "bad" && "bg-red-500/15 text-red-300",
      tone === "muted" && "bg-white/[0.07] text-white/70",
    )}>
      {children}
    </span>
  );
}

export function ago(iso: string, nowMs: number) {
  const s = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 1000));
  if (s < 90) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function duration(sec: number | null) {
  if (sec == null) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return m < 60 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
