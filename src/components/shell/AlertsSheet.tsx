"use client";

import { useState } from "react";
import { BellOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import type { usePush, PushPrefs } from "@/hooks/usePush";
import type { AppSport } from "@/lib/espn";

type Push = ReturnType<typeof usePush>;
type ToggleKey = Exclude<keyof PushPrefs, "sports">;

type Toggle = { key: ToggleKey; label: string; detail: string; disabled?: boolean };

const START: Record<AppSport, string> = { football: "kickoff", wbb: "tipoff", mbb: "tipoff", baseball: "first pitch" };

function joinWords(words: string[], conj = "or") {
  const u = Array.from(new Set(words));
  return u.length <= 1 ? (u[0] ?? "") : `${u.slice(0, -1).join(", ")} ${conj} ${u[u.length - 1]}`;
}
function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Toggle copy for the sports picked, matching what src/lib/push/detect.ts really sends:
 * football alerts every score, baseball every run change, basketball no per-basket alerts;
 * baseball has no halftime; "big moments" differ by sport.
 */
function togglesFor(sports: AppSport[]): Toggle[] {
  const picked = sports.length ? sports : (["football"] as AppSport[]);
  const fb = picked.includes("football");
  const bsb = picked.includes("baseball");
  const bb = picked.some((s) => s === "wbb" || s === "mbb");
  const scoring = fb || bsb;
  const start = joinWords(picked.map((s) => START[s]));
  const scoreWord = fb && bsb ? "score or run" : fb ? "score" : "run";
  const noBB = bb ? " Not sent for basketball (too many baskets)." : "";

  const halftime = fb || bb;
  const big: string[] = [];
  if (fb || bsb) big.push("lead changes");
  big.push(bsb && !fb && !bb ? "extra innings" : bsb ? "overtime or extra innings" : "overtime");
  if (fb) big.push("a one-score game in the last 5 minutes");
  if (bb) big.push(fb ? "a 5-point basketball game in the last 4 minutes" : "a 5-point game in the last 4 minutes");
  if (bsb) big.push(fb || bb ? "a one-run baseball game from the 8th" : "a one-run game from the 8th inning");

  return [
    { key: "kickoffSoon", label: `${cap(start)} soon`, detail: "30 minutes before the game" },
    { key: "kickoff", label: cap(start), detail: "When the game starts" },
    {
      key: "scScores",
      label: fb && !bsb ? "Touchdowns & scores" : bsb && !fb ? "Gamecock runs" : "Gamecock scores",
      detail: scoring ? `Every South Carolina ${scoreWord}.${noBB}` : "Not sent for basketball (too many baskets).",
      disabled: !scoring,
    },
    {
      key: "oppScores",
      label: bsb && !fb ? "Opponent runs" : "Opponent scores",
      detail: scoring ? `When the other team scores.${bb ? " Not for basketball." : ""}` : "Not sent for basketball.",
      disabled: !scoring,
    },
    {
      key: "halftimeFinal",
      label: halftime ? "Halftime & final score" : "Final score",
      detail: halftime ? `Score at the half and at the end${bsb ? " (baseball: final only)" : ""}` : "Score when the game ends",
    },
    { key: "bigMoments", label: "Big moments", detail: cap(joinWords(big, "and")) },
  ];
}

const SPORTS: { id: AppSport; label: string }[] = [
  { id: "football", label: "Football" },
  { id: "wbb", label: "Women's BB" },
  { id: "mbb", label: "Men's BB" },
  { id: "baseball", label: "Baseball" },
];

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-garnet-bright" : "bg-white/15",
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow transition-transform",
          checked && "translate-x-[20px]",
        )}
      />
    </button>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  push: Push;
  onOpenInstall: () => void;
}

export function AlertsSheet({ open, onClose, push, onOpenInstall }: Props) {
  const [draft, setDraft] = useState<PushPrefs | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const prefs = draft ?? push.prefs;

  const change = async (next: PushPrefs) => {
    setDraft(next);
    setNotice(null);
    if (push.subscribed) {
      try {
        await push.updatePrefs(next);
      } catch {
        /* push.error shows it */
      }
    }
  };

  const blocked = push.permission === "denied";
  const toggles = togglesFor(prefs.sports);
  const noneOn = prefs.sports.length === 0 || !toggles.some((t) => !t.disabled && prefs[t.key]);

  let body;
  if (push.needsInstall) {
    body = (
      <div className="rounded-2xl bg-card px-4 py-5">
        <p className="text-[16px] font-semibold">Alerts need the Home Screen app</p>
        <p className="mt-1.5 text-[14px] leading-snug text-white/70">
          iPhones only deliver notifications to web apps opened from the Home Screen, not to Safari tabs. Add Gamecock AI to
          your Home Screen, open it from there, then come back to this bell.
        </p>
        <button
          type="button"
          onClick={onOpenInstall}
          className="mt-4 h-12 w-full rounded-full bg-white text-[16px] font-semibold text-black active:opacity-80"
          data-testid="alerts-go-install"
        >
          Show me how
        </button>
      </div>
    );
  } else if (!push.supported) {
    body = (
      <div className="flex gap-3 rounded-2xl bg-card px-4 py-5">
        <BellOff className="mt-0.5 size-5 shrink-0 text-white/60" />
        <p className="text-[14px] leading-snug text-white/75">
          This browser can&apos;t receive push notifications. On iPhone, add the app to your Home Screen; on Android, use Chrome.
        </p>
      </div>
    );
  } else {
    body = (
      <>
        {blocked && (
          <div className="mb-4 rounded-2xl bg-white/[0.06] px-4 py-3 text-[14px] leading-snug text-white/80">
            Notifications are blocked for Gamecock AI. Turn them back on in your phone&apos;s Settings → Notifications (or the
            browser&apos;s site settings), then try again.
          </div>
        )}
        <div className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Sports</div>
        <div className="mb-5 flex flex-wrap gap-2">
          {SPORTS.map((s) => {
            const on = prefs.sports.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                disabled={push.busy}
                onClick={() =>
                  change({ ...prefs, sports: on ? prefs.sports.filter((x) => x !== s.id) : [...prefs.sports, s.id] })
                }
                className={cn(
                  "h-11 rounded-full px-4 text-[14px] font-medium transition-colors",
                  on ? "bg-white text-black" : "bg-white/[0.08] text-white/75",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Alert me for</div>
        <div className="divide-y divide-white/[0.06] rounded-2xl bg-card">
          {toggles.map((t) => (
            <label key={t.key} className={cn("flex items-center gap-3 px-4 py-3", t.disabled && "opacity-50")}>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium">{t.label}</div>
                <div className="text-[12px] leading-snug text-muted-foreground">{t.detail}</div>
              </div>
              <Switch
                label={t.label}
                checked={!t.disabled && prefs[t.key]}
                disabled={push.busy || t.disabled}
                onChange={(v) => change({ ...prefs, [t.key]: v })}
              />
            </label>
          ))}
        </div>

        <div className="mt-5 space-y-2">
          {!push.subscribed ? (
            <button
              type="button"
              disabled={push.busy || blocked || noneOn}
              onClick={async () => {
                setNotice(null);
                try {
                  await push.subscribe(prefs);
                  setNotice("Alerts are on.");
                } catch {
                  /* push.error shows it */
                }
              }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[16px] font-semibold text-black active:opacity-80 disabled:opacity-40"
              data-testid="alerts-subscribe"
            >
              {push.busy && <Loader2 className="size-4 animate-spin" />}
              Turn on alerts
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={push.busy}
                onClick={async () => {
                  setNotice(null);
                  try {
                    await push.sendTest();
                    setNotice("Test alert sent. It should arrive in a few seconds.");
                  } catch {
                    /* push.error shows it */
                  }
                }}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white/[0.1] text-[16px] font-semibold active:bg-white/[0.15] disabled:opacity-40"
                data-testid="alerts-test"
              >
                {push.busy && <Loader2 className="size-4 animate-spin" />}
                Send test alert
              </button>
              <button
                type="button"
                disabled={push.busy}
                onClick={async () => {
                  setNotice(null);
                  try {
                    await push.unsubscribe();
                    setNotice("Alerts are off on this device.");
                  } catch {
                    /* push.error shows it */
                  }
                }}
                className="h-10 w-full text-[14px] font-medium text-white/60"
              >
                Turn off alerts on this device
              </button>
            </>
          )}
          {!push.subscribed && !blocked && (
            <p className="px-1 text-center text-[12px] text-muted-foreground">Your phone will ask once for permission to send notifications.</p>
          )}
          {push.error && (
            <p className="rounded-xl bg-destructive/15 px-3 py-2 text-[13px] text-[#ff8a80]" role="alert">
              {push.error}
            </p>
          )}
          {notice && !push.error && <p className="px-1 text-center text-[13px] text-white/80">{notice}</p>}
        </div>
      </>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Game alerts"
      subtitle={push.subscribed ? "On for this device · changes save automatically" : "Kickoffs, scores and finals, pushed to your phone"}
      testId="alerts-sheet"
    >
      {body}
    </Sheet>
  );
}
