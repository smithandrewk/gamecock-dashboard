// Product analytics via Vantage (vantage.entrpy.co), Entrpy's own analytics store.
// The beacon (loaded by <Analytics/> on fan pages only, never on /admin) sends a
// pageview per load and per history change; these are the custom events behind the
// admin page's feature and funnel numbers. Event names are a contract with the SQL in
// src/lib/admin/queries.ts: rename one and its tile goes empty.

export type TrackEvent =
  | "app_open" //        { standalone, platform, sport }   once per page load
  | "tab_view" //        { sport }                          user switched sport tab
  | "game_open" //       { sport, state, source }           game detail sheet opened
  | "alerts_open" //     { subscribed, needsInstall }       bell tapped
  | "alerts_on" //       { sports, prefs }                  subscribed to push
  | "alerts_off" //      {}
  | "alerts_prefs" //    { prefs }                          changed toggles while subscribed
  | "alerts_test" //     {}
  | "install_open" //    { platform }                       "Get the app" / install sheet
  | "install_prompt"; // { outcome }                        Android/desktop native prompt

type Props = Record<string, string | number | boolean | string[] | null | undefined>;

declare global {
  interface Window {
    vantage?: (name: string, props?: Props) => void;
  }
}

// Events fired before the async beacon loads wait here. If it never loads (blocked or
// offline) they are dropped after ~10 s rather than piling up.
const queue: [TrackEvent, Props | undefined][] = [];
let waiting = false;

function flush(): boolean {
  if (!window.vantage) return false;
  for (const [n, p] of queue.splice(0)) window.vantage(n, p);
  return true;
}

export function track(name: TrackEvent, props?: Props) {
  if (typeof window === "undefined") return;
  // Review fixtures (?demo=) are not real usage.
  if (new URLSearchParams(window.location.search).has("demo")) return;
  queue.push([name, props]);
  if (flush() || waiting) return;
  waiting = true;
  let tries = 0;
  const id = window.setInterval(() => {
    if (flush() || ++tries >= 40) {
      window.clearInterval(id);
      queue.length = 0;
      waiting = false;
    }
  }, 250);
}
