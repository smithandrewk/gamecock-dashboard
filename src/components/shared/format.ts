// Date/time copy shared by every sport. All times render in the viewer's local zone.
import { useEffect, useState } from "react";

const DAY = 86_400_000;

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "4:15 PM" or "TBD" */
export function formatTime(iso: string, tbd: boolean): string {
  if (tbd) return "TBD";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** "4:15 PM EDT" or "Time TBD" */
export function formatTimeZone(iso: string, tbd: boolean): string {
  if (tbd) return "Time TBD";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}

/** "Today", "Tomorrow", "Sat, Oct 31" */
export function formatDay(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (sameDay(d, now)) return "Today";
  if (sameDay(d, new Date(now.getTime() + DAY))) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** "Oct 31" */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function daysUntil(iso: string, now = new Date()): number {
  const d = new Date(iso);
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / DAY);
}

export type Countdown = { days: number; hours: number; minutes: number; seconds: number; past: boolean };

export function countdown(iso: string, nowMs: number): Countdown {
  const diff = new Date(iso).getTime() - nowMs;
  const past = diff <= 0;
  const t = Math.max(0, diff);
  return {
    days: Math.floor(t / DAY),
    hours: Math.floor((t % DAY) / 3_600_000),
    minutes: Math.floor((t % 3_600_000) / 60_000),
    seconds: Math.floor((t % 60_000) / 1000),
    past,
  };
}

/** Re-render every `ms`; returns Date.now(). Starts at 0 on the server to avoid hydration drift. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first tick after mount (server has no clock)
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

/** "12s ago", "3 min ago" */
export function ago(ms: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return `${h} hr ago`;
}
