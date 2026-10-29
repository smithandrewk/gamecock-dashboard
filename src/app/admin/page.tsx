import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Home, Smartphone, Repeat } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  RANGES, type Range, getBreakdowns, getCollection, getDaily, getFeatures, getFrequency, getGameOpens,
  getHeatmap, getLive, getPlatforms, getRecentSessions, getRetention, getSports, getSummary,
} from "@/lib/admin/queries";
import { getSubscribers } from "@/lib/admin/subscribers";
import {
  BarList, Card, Delta, Empty, ErrorNote, From, Funnel, Heatmap, Pill, RetentionGrid, Section, Spark,
  StackedBars, Stat, ago, duration, fmt, pct,
} from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · Gamecock AI", robots: { index: false, follow: false } };

const SPORTS: Record<string, string> = { football: "Football", wbb: "Women's BB", mbb: "Men's BB", baseball: "Baseball" };
const DID: Record<string, string> = {
  game_open: "opened a game", tab_view: "switched sports", alerts_open: "opened alerts", alerts_on: "turned alerts on",
  alerts_off: "turned alerts off", alerts_prefs: "changed alerts", alerts_test: "test alert", install_open: "install guide",
  install_prompt: "install prompt",
};
const FEATURES: { name: string; label: string; hint: string }[] = [
  { name: "game_open", label: "Opened a game", hint: "box score / detail sheet" },
  { name: "tab_view", label: "Switched sports", hint: "tapped another tab" },
  { name: "alerts_open", label: "Opened game alerts", hint: "tapped the bell" },
  { name: "alerts_on", label: "Turned alerts on", hint: "" },
  { name: "alerts_test", label: "Sent a test alert", hint: "" },
  { name: "install_open", label: "Opened install guide", hint: "Get the app" },
];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdmin();
  const r = Number((await searchParams).range);
  const range: Range = (RANGES as readonly number[]).includes(r) ? (r as Range) : 30;

  const [collection, live, summary, daily, frequency, retention, sports, features, gameOpens, platforms, heatmap, breakdowns, sessions, subs] =
    await Promise.all([
      getCollection(), getLive(), getSummary(range), getDaily(range), getFrequency(range), getRetention(8),
      getSports(range), getFeatures(range), getGameOpens(range), getPlatforms(range), getHeatmap(range),
      getBreakdowns(range), getRecentSessions(15), getSubscribers(),
    ]);
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const now = Date.now();

  // Days before the first event aren't zeros, they're "not collecting yet".
  const firstDay = collection.ok && collection.data.firstEvent
    ? new Date(collection.data.firstEvent).toLocaleDateString("en-CA", { timeZone: "America/New_York" })
    : null;
  const noData = (day: string) => !firstDay || day < firstDay;
  const windowLabel = `${range} d`;
  const prevLabel = `prior ${range} d`;

  return (
    <div className="min-h-dvh bg-background">
      <header className="pt-app-top sticky top-0 z-30 border-b border-white/[0.06] bg-black">
        <div className="mx-auto flex h-12 max-w-lg items-center gap-2 px-4">
          <Image src="/gamecock.svg" alt="" width={20} height={22} className="pixelated" />
          <span className="text-[17px] font-semibold tracking-tight">Admin</span>
          <nav className="ml-auto flex rounded-full bg-white/[0.07] p-0.5 text-[13px] font-medium" aria-label="Range">
            {RANGES.map((d) => (
              <Link key={d} href={`/admin?range=${d}`} className={cn("rounded-full px-3 py-1.5", d === range ? "bg-white text-black" : "text-white/70")}>
                {d}d
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-9 px-4 pt-5 pb-16">
        {/* Status: are we collecting, how fresh, who's here now */}
        <div className="space-y-3">
          <div>
            <h1 className="text-[28px] leading-tight font-bold tracking-tight">Gamecock AI</h1>
            <p className="text-[13px] text-muted-foreground">How fans use the app. Last {range} days, Eastern time.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <From s={collection}>
              {(c) => {
                const beatAge = c.lastBeat ? (now - Date.parse(c.lastBeat)) / 60000 : Infinity;
                if (c.openGap || beatAge > 10)
                  return <Pill tone="bad">Not collecting{c.openGap ? ` since ${ago(c.openGap.startedAt, now)}` : ""}</Pill>;
                if (!c.lastEvent) return <Pill tone="warn">Collector up · no events yet</Pill>;
                return <Pill tone="good">Collecting · last event {ago(c.lastEvent, now)}</Pill>;
              }}
            </From>
            <From s={live}>
              {(l) => (
                <Pill tone={l.now5 ? "good" : "muted"}>
                  <span className={cn("size-1.5 rounded-full", l.now5 ? "animate-pulse bg-emerald-400" : "bg-white/40")} />
                  {fmt(l.now5)} here now · {fmt(l.now30)} in 30 min
                </Pill>
              )}
            </From>
          </div>
          {collection.ok && collection.data.firstEvent && (
            <p className="text-[12px] text-white/45">
              Tracking since {new Date(collection.data.firstEvent).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET
              · {fmt(collection.data.events)} events. Earlier days show as empty, not zero.
            </p>
          )}
        </div>

        {/* Headline */}
        <From s={summary}>
          {(s) => {
            const spark = daily.ok ? daily.data.map((d) => (noData(d.day) ? null : d.visitors)) : [];
            const sparkS = daily.ok ? daily.data.map((d) => (noData(d.day) ? null : d.sessions)) : [];
            return (
              <div className="grid grid-cols-2 gap-2.5">
                <Stat accent label="Visitors" value={fmt(s.visitors)} sub={<Delta now={s.visitors} prev={s.prevVisitors} label={prevLabel} />} chart={<Spark values={spark} />} />
                <Stat label="Came back" value={pct(s.returningVisitors, s.visitors)} sub={`${fmt(s.returningVisitors)} of ${fmt(s.visitors)} returned on a later day`} />
                <Stat label="Sessions" value={fmt(s.sessions)} sub={<Delta now={s.sessions} prev={s.prevSessions} label={prevLabel} />} chart={<Spark values={sparkS} />} />
                <Stat label="Visits per fan" value={s.visitors ? (s.sessions / s.visitors).toFixed(1) : "—"} sub={`Median visit ${duration(s.medianSessionSec)}`} />
                <Stat label="Interacted" value={pct(s.engagedSessions, s.sessions)} sub={`${fmt(s.engagedSessions)} sessions did more than look`} />
                <Stat label="From Home Screen" value={pct(s.standaloneSessions, s.sessions)} sub={`${fmt(s.standaloneSessions)} sessions in the installed app`} />
              </div>
            );
          }}
        </From>

        <Section title="New vs returning" kicker="Fans active each day: first-timers versus people who had been here on an earlier day.">
          <Card>
            <From s={daily}>
              {(days) =>
                days.every((d) => noData(d.day)) ? <Empty>No days collected yet.</Empty> : (
                  <StackedBars aLabel="Returning" bLabel="New" days={days.map((d) => ({ day: d.day, a: d.returning, b: d.newVisitors, noData: noData(d.day) }))} />
                )
              }
            </From>
          </Card>
        </Section>

        <Section title="How often they come back" kicker={`Different days each fan showed up in the last ${windowLabel}.`}>
          <Card>
            <From s={frequency}>
              {(rows) => {
                const total = rows.reduce((a, r) => a + r.value, 0);
                return total ? <BarList rows={rows} total={total} /> : <Empty>No visitors yet.</Empty>;
              }}
            </From>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><Repeat className="size-4 text-garnet-bright" />Weekly retention</div>
            <p className="mb-3 text-[12px] leading-snug text-white/55">Fans grouped by the week (Mon–Sun) of their first visit. Each cell: % of that group active again that many weeks later. Dots are weeks that haven&apos;t happened yet.</p>
            <From s={retention}>{(c) => <RetentionGrid cohorts={c} />}</From>
          </Card>
        </Section>

        <Section title="What fans use" kicker="Share of visitors in the window who did each thing at least once.">
          <Card className="space-y-3">
            <div className="text-[13px] font-semibold">Sports</div>
            <From s={sports}>
              {(rows) => {
                const total = summary.ok ? summary.data.visitors : 0;
                return rows.length ? (
                  <BarList total={total} rows={rows.map((r) => ({ label: SPORTS[r.sport] ?? r.sport, value: r.visitors, hint: `${fmt(r.landed)} landed · ${fmt(r.switched)} switched in` }))} />
                ) : <Empty>No tab activity yet.</Empty>;
              }}
            </From>
          </Card>
          <Card className="space-y-3">
            <div className="text-[13px] font-semibold">Features</div>
            <From s={features}>
              {(rows) => {
                const by = new Map(rows.map((x) => [x.name, x]));
                const total = summary.ok ? summary.data.visitors : 0;
                return (
                  <BarList total={total} rows={FEATURES.map((f) => ({ label: f.label, value: by.get(f.name)?.visitors ?? 0, hint: by.get(f.name) ? `${fmt(by.get(f.name)!.events)} times` : f.hint }))} />
                );
              }}
            </From>
            <From s={gameOpens}>
              {(rows) => {
                const n = rows.reduce((a, x) => a + x.n, 0);
                if (!n) return null;
                const st = (k: string) => rows.filter((x) => x.state === k).reduce((a, x) => a + x.n, 0);
                const hero = rows.filter((x) => x.source === "hero").reduce((a, x) => a + x.n, 0);
                return (
                  <p className="text-[12px] leading-snug text-white/55">
                    Game opens: {pct(st("post"), n)} finished games, {pct(st("pre"), n)} upcoming, {pct(st("in"), n)} live. {pct(hero, n)} came from the hero card, the rest from the schedule.
                  </p>
                );
              }}
            </From>
          </Card>
        </Section>

        <Section title="Funnels" kicker="Where fans drop off on the way to alerts and the Home Screen app.">
          <Card className="space-y-5">
            <From s={features}>
              {(rows) => {
                const v = (n: string) => rows.find((x) => x.name === n)?.visitors ?? 0;
                const visitors = summary.ok ? summary.data.visitors : 0;
                return (
                  <>
                    <div>
                      <div className="mb-2 text-[13px] font-semibold">Game alerts</div>
                      <Funnel steps={[{ label: "Visited", value: visitors }, { label: "Tapped the bell", value: v("alerts_open") }, { label: "Turned alerts on", value: v("alerts_on") }]} />
                    </div>
                    <From s={platforms}>
                      {(p) => {
                        const iosSafari = p.filter((x) => x.platform === "ios-safari" && !x.standalone).reduce((a, x) => a + x.visitors, 0);
                        const homeScreen = p.filter((x) => x.standalone).reduce((a, x) => a + x.visitors, 0);
                        return (
                          <div>
                            <div className="mb-2 text-[13px] font-semibold">Home Screen app (iPhone)</div>
                            <Funnel steps={[{ label: "iPhone Safari visitors", value: iosSafari }, { label: "Opened install guide", value: v("install_open") }, { label: "Opened from Home Screen", value: homeScreen }]} />
                            <p className="mt-2 text-[11px] leading-snug text-white/40">The installed app has its own storage, so an install shows up as a new visitor. Steps are counted independently, not per person.</p>
                          </div>
                        );
                      }}
                    </From>
                  </>
                );
              }}
            </From>
          </Card>
        </Section>

        <Section title="Game alert subscribers" kicker="Devices with alerts on right now, from the push store (not just taps since tracking began).">
          <From s={subs}>
            {(sb) => (
              <div className="space-y-2.5">
                <div className="grid grid-cols-3 gap-2.5">
                  <Stat label="Devices" value={fmt(sb.total)} sub={sb.newestAt ? `newest ${ago(sb.newestAt, now)}` : "none yet"} />
                  <Stat label={<span className="flex items-center gap-1"><Smartphone className="size-3" />Apple</span>} value={fmt(sb.apple)} sub="iPhone / Mac" />
                  <Stat label="Other" value={fmt(sb.other)} sub="Chrome / Android" />
                </div>
                {sb.total > 0 && (
                  <Card className="space-y-3">
                    <div className="text-[13px] font-semibold">Alert types they kept on</div>
                    <BarList rows={sb.byPref} total={sb.total} unit="devices" />
                    <div className="text-[13px] font-semibold">Sports</div>
                    <BarList rows={sb.bySport.filter((x) => x.value)} total={sb.total} unit="devices" />
                  </Card>
                )}
              </div>
            )}
          </From>
        </Section>

        <Section title="When they show up" kicker="Sessions started, by weekday and hour (Eastern). Saturday on top.">
          <Card><From s={heatmap}>{(g) => (g.flat().some(Boolean) ? <Heatmap grid={g} /> : <Empty>No sessions yet.</Empty>)}</From></Card>
        </Section>

        <Section title="Where they come from">
          <From s={breakdowns}>
            {(b) => (
              <div className="space-y-2.5">
                <Card className="space-y-3"><div className="text-[13px] font-semibold">Sources</div><BarList rows={b.sources} /></Card>
                <Card className="space-y-3"><div className="text-[13px] font-semibold">States</div><BarList rows={b.regions} /></Card>
                <Card className="space-y-3"><div className="text-[13px] font-semibold">Cities</div><BarList rows={b.cities} /></Card>
                <Card className="space-y-3"><div className="text-[13px] font-semibold">Phones and computers</div><BarList rows={b.os} /></Card>
              </div>
            )}
          </From>
        </Section>

        <Section title="Recent sessions" kicker="The last 15 visits, newest first.">
          <From s={sessions}>
            {(rows) =>
              rows.length ? (
                <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.035]">
                  {rows.map((x) => (
                    <li key={x.started + x.place} className="flex gap-3 px-4 py-3">
                      <div className="w-16 shrink-0 text-[12px] text-white/50 tabular-nums">{ago(x.started, now)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[14px]">
                          {x.standalone ? <Home className="size-3.5 text-garnet-bright" aria-label="Home Screen app" /> : null}
                          <span className="truncate">{x.place ?? "Unknown place"}</span>
                          {x.returning && <span className="rounded bg-white/[0.08] px-1.5 text-[10px] font-semibold text-white/70">RETURNING</span>}
                        </div>
                        <div className="truncate text-[12px] text-white/50">
                          {[x.os, duration(x.durationSec), `${fmt(x.events)} events`, x.did.length ? x.did.map((d) => DID[d] ?? d).join(", ") : "looked around"].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <Card><Empty>No sessions in the last 14 days.</Empty></Card>
            }
          </From>
        </Section>

        <footer className="space-y-1.5 px-1 text-[11px] leading-snug text-white/35">
          <p>Source: Vantage (vantage.entrpy.co), site &ldquo;gamecock&rdquo;, read-only. Internal traffic marked in Vantage is excluded. Your own visits to /admin are never tracked.</p>
          <p>A visitor is one browser profile: Safari and the Home Screen app on the same phone count as two. A session ends after 30 minutes idle.</p>
          {!summary.ok && <ErrorNote error={summary.error} source={summary.source} />}
        </footer>
      </main>
    </div>
  );
}
