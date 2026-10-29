"use client";

import type { ReactNode } from "react";
import { Bell, Check, MoreHorizontal, MoreVertical } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import type { InstallState } from "@/hooks/useInstall";

/** The iOS share glyph (square with an arrow out the top), as Safari draws it. */
export function ShareGlyph({ className = "inline-block size-[18px] align-[-3px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#0a84ff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-label="Share">
      <path d="M8.5 9H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1.5" />
      <path d="M12 3v12" />
      <path d="M8.5 6.5 12 3l3.5 3.5" />
    </svg>
  );
}

/** iOS "Add to Home Screen" glyph (plus in a rounded square). */
function AddGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="inline-block size-[18px] align-[-3px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3 py-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-[13px] font-semibold tabular">{n}</span>
      <div className="min-w-0 flex-1 pt-0.5 text-[15px] leading-snug">{children}</div>
    </li>
  );
}

function WhyNote() {
  return (
    <div className="mt-4 rounded-2xl bg-white/[0.05] px-4 py-3 text-[13px] leading-snug text-white/70">
      <span className="font-semibold text-white">Why install?</span> iPhones only deliver game alerts (kickoff, scores, finals)
      to web apps opened from the Home Screen. Safari tabs can&apos;t receive them. That&apos;s Apple&apos;s rule, not ours.
    </div>
  );
}

function IOSSteps({ safari }: { safari: boolean }) {
  return (
    <>
      {!safari && (
        <p className="mb-1 rounded-xl bg-white/[0.05] px-3 py-2 text-[13px] text-white/70">
          Easiest in Safari. Chrome on iPhone works too: its Share button <ShareGlyph /> is in the address bar.
        </p>
      )}
      <ol className="divide-y divide-white/[0.06]">
        <Step n={1}>
          Tap the <MoreHorizontal className="inline size-4 align-[-3px]" /> button in Safari&apos;s toolbar
          <span className="mt-0.5 block text-[13px] text-muted-foreground">
            On older iPhones, tap the Share button <ShareGlyph /> instead.
          </span>
        </Step>
        <Step n={2}>
          Tap <span className="font-semibold">Add to Home Screen</span> <AddGlyph />
          <span className="mt-0.5 block text-[13px] text-muted-foreground">
            Don&apos;t see it? Tap <span className="font-semibold">Share</span> first and scroll down. Leave &ldquo;Open as Web App&rdquo; on.
          </span>
        </Step>
        <Step n={3}>
          Tap <span className="font-semibold">Add</span>, then open <span className="font-semibold">Gamecocks</span> from your Home Screen.
        </Step>
        <Step n={4}>
          In the app, tap the bell <Bell className="inline size-4 align-[-3px]" /> and turn on game alerts.
        </Step>
      </ol>
      <WhyNote />
    </>
  );
}

export function InstallSheet({ open, onClose, install }: { open: boolean; onClose: () => void; install: InstallState }) {
  const { platform, standalone, canPrompt, promptInstall } = install;
  return (
    <Sheet open={open} onClose={onClose} title="Add to Home Screen" subtitle="Get Gamecock AI as an app, with game alerts" testId="install-sheet">
      {standalone ? (
        <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-4">
          <Check className="size-5 text-white" />
          <p className="text-[15px]">You&apos;re already using the Home Screen app.</p>
        </div>
      ) : platform === "ios-safari" || platform === "ios-other" ? (
        <IOSSteps safari={platform === "ios-safari"} />
      ) : platform === "android" || canPrompt ? (
        <div>
          {canPrompt ? (
            <>
              <p className="text-[15px] text-white/80">Install it like an app: its own icon, full screen, and game alerts.</p>
              <button
                type="button"
                onClick={async () => {
                  const r = await promptInstall();
                  if (r === "accepted") onClose();
                }}
                className="mt-4 h-12 w-full rounded-full bg-white text-[16px] font-semibold text-black active:opacity-80"
              >
                Install Gamecock AI
              </button>
            </>
          ) : (
            <ol className="divide-y divide-white/[0.06]">
              <Step n={1}>
                Open the browser menu <MoreVertical className="inline size-4 align-[-3px]" /> (top right in Chrome).
              </Step>
              <Step n={2}>
                Tap <span className="font-semibold">Install app</span> or <span className="font-semibold">Add to Home screen</span>.
              </Step>
              <Step n={3}>Open Gamecocks from your home screen and tap the bell to turn on alerts.</Step>
            </ol>
          )}
        </div>
      ) : (
        <div className="space-y-3 text-[15px] text-white/80">
          <p>Gamecock AI is built for your phone. Open this page on your iPhone or Android phone to add it to your Home Screen.</p>
          <p className="text-[13px] text-muted-foreground">In desktop Chrome or Edge, use the install icon at the right end of the address bar.</p>
        </div>
      )}
    </Sheet>
  );
}
