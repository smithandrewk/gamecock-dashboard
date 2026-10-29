"use client";

import type { ReactNode } from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function TeamLogo({ src, alt, size = 28, className }: { src?: string; alt: string; size?: number; className?: string }) {
  if (!src) {
    return (
      <div
        className={cn("grid shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-semibold text-white/70", className)}
        style={{ width: size, height: size }}
        aria-label={alt}
      >
        {alt.slice(0, 3).toUpperCase()}
      </div>
    );
  }
  // ESPN CDN logos; next/image would need remotePatterns and buys nothing at these sizes.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={size} height={size} className={cn("shrink-0 object-contain", className)} style={{ width: size, height: size }} />;
}

export function ResultChip({ result, className }: { result: "W" | "L" | "T"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid h-6 w-6 shrink-0 place-items-center rounded-md text-[12px] font-bold",
        result === "W" ? "bg-garnet text-white" : "bg-white/10 text-white/60",
        className,
      )}
      aria-label={result === "W" ? "Win" : result === "L" ? "Loss" : "Tie"}
    >
      {result}
    </span>
  );
}

export function Rank({ rank }: { rank?: number }) {
  if (!rank) return null;
  return <span className="mr-1 text-[0.8em] font-medium text-muted-foreground tabular">{rank}</span>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between px-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{children}</h2>
      {right && <div className="text-[13px] text-muted-foreground">{right}</div>}
    </div>
  );
}

export function Card({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl bg-card", className)} {...rest}>
      {children}
    </div>
  );
}

/** Row of labeled numbers; a missing value renders "—", never a made-up zero. */
export function StatStrip({ items }: { items: { label: string; value?: ReactNode; sub?: ReactNode }[] }) {
  return (
    <Card className="grid divide-x divide-white/[0.06]" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0 px-2 py-3 text-center">
          <div className="truncate text-[20px] font-semibold leading-none tracking-tight tabular">{it.value ?? "—"}</div>
          <div className="mt-1.5 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{it.label}</div>
          {it.sub && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{it.sub}</div>}
        </div>
      ))}
    </Card>
  );
}

export function ErrorState({ title, detail, onRetry, retrying }: { title: string; detail?: string; onRetry?: () => void; retrying?: boolean }) {
  return (
    <Card className="px-5 py-8 text-center" role="alert">
      <p className="text-[17px] font-semibold">{title}</p>
      {detail && <p className="mx-auto mt-1 max-w-xs text-[14px] text-muted-foreground">{detail}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-semibold text-black active:opacity-80 disabled:opacity-60"
        >
          <RotateCw className={cn("size-4", retrying && "animate-spin")} />
          {retrying ? "Retrying…" : "Try again"}
        </button>
      )}
    </Card>
  );
}

/** Inline note when a refresh failed but older data is still on screen. */
export function StaleNote({ when, onRetry }: { when?: string; onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-2 text-[13px] text-muted-foreground"
    >
      <RotateCw className="size-3.5" />
      Couldn&apos;t refresh from ESPN{when ? ` · showing data from ${when}` : ""} · Tap to retry
    </button>
  );
}

export function HeroSkeleton() {
  return (
    <Card className="p-5" aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-6 h-4 w-28 bg-white/10" />
      <div className="flex items-center justify-between">
        <Skeleton className="size-16 rounded-full bg-white/10" />
        <Skeleton className="h-12 w-28 bg-white/10" />
        <Skeleton className="size-16 rounded-full bg-white/10" />
      </div>
      <Skeleton className="mx-auto mt-6 h-4 w-40 bg-white/10" />
    </Card>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="divide-y divide-white/[0.06]" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-8 w-10 bg-white/10" />
          <Skeleton className="size-7 rounded-full bg-white/10" />
          <Skeleton className="h-4 flex-1 bg-white/10" />
          <Skeleton className="h-4 w-12 bg-white/10" />
        </div>
      ))}
    </Card>
  );
}
