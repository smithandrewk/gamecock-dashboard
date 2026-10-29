"use client";

import { useCallback, useEffect, useState } from "react";

import { DEFAULT_PREFS, type PushPrefs } from "@/lib/push/prefs";

export { DEFAULT_PREFS };
export type { PushPrefs, PushSport } from "@/lib/push/prefs";

const PREFS_KEY = "gc-push-prefs";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function readPrefs(): PushPrefs | null {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<PushPrefs>) };
  } catch {
    return null;
  }
}

function writePrefs(prefs: PushPrefs | null) {
  try {
    if (prefs) window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    else window.localStorage.removeItem(PREFS_KEY);
  } catch {
    /* storage unavailable: server copy is the source of truth */
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function detectSupport() {
  if (typeof window === "undefined") return { supported: false, needsInstall: false };
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const apis =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  // iOS only exposes Web Push to Home Screen web apps (16.4+).
  const needsInstall = isIOS && !standalone;
  return { supported: apis && !needsInstall, needsInstall };
}

async function postJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* non-JSON body */
    }
    throw new Error(msg);
  }
  return res;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

export function usePush() {
  const [supported, setSupported] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );
  const [subscribed, setSubscribed] = useState(false);
  const [prefs, setPrefs] = useState<PushPrefs>(DEFAULT_PREFS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore state on load.
  useEffect(() => {
    const s = detectSupport();
    setSupported(s.supported);
    setNeedsInstall(s.needsInstall);
    if (!s.supported) return;
    setPermission(Notification.permission);
    const cached = readPrefs();
    if (cached) setPrefs(cached);
    let cancelled = false;
    (async () => {
      try {
        const reg = await getRegistration();
        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setSubscribed(!!sub);
        if (!sub) {
          writePrefs(null);
          return;
        }
        // Sync with the server copy (source of truth). If the server lost the record
        // (e.g. pruned after a failed send), re-register it with the cached prefs.
        const res = await fetch("/api/push/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        if (!res.ok || cancelled) return;
        const st = (await res.json()) as { subscribed: boolean; prefs?: PushPrefs };
        if (cancelled) return;
        if (st.subscribed && st.prefs) {
          writePrefs(st.prefs);
          setPrefs(st.prefs);
        } else {
          await postJSON("/api/push/subscribe", {
            subscription: sub.toJSON(),
            prefs: cached ?? DEFAULT_PREFS,
          });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  const subscribe = useCallback(
    (next: PushPrefs) =>
      run(async () => {
        if (!supported) throw new Error("Notifications aren't supported here.");
        if (!VAPID_PUBLIC_KEY) throw new Error("Push isn't configured (missing VAPID key).");
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== "granted") throw new Error("Notifications are blocked for this site.");
        const reg = await getRegistration();
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }
        await postJSON("/api/push/subscribe", { subscription: sub.toJSON(), prefs: next });
        writePrefs(next);
        setPrefs(next);
        setSubscribed(true);
      }),
    [run, supported],
  );

  const updatePrefs = useCallback(
    (next: PushPrefs) =>
      run(async () => {
        const reg = await getRegistration();
        const sub = await reg.pushManager.getSubscription();
        if (!sub) {
          // Not subscribed: just remember locally for when they turn alerts on.
          writePrefs(next);
          setPrefs(next);
          setSubscribed(false);
          return;
        }
        await postJSON("/api/push/subscribe", { subscription: sub.toJSON(), prefs: next });
        writePrefs(next);
        setPrefs(next);
      }),
    [run],
  );

  const unsubscribe = useCallback(
    () =>
      run(async () => {
        const reg = await getRegistration();
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await postJSON("/api/push/unsubscribe", { endpoint }).catch(() => {
            /* server prunes dead endpoints on next send (410) */
          });
        }
        writePrefs(null);
        setSubscribed(false);
      }),
    [run],
  );

  const sendTest = useCallback(
    () =>
      run(async () => {
        const reg = await getRegistration();
        const sub = await reg.pushManager.getSubscription();
        if (!sub) throw new Error("Turn on notifications first.");
        await postJSON("/api/push/test", { endpoint: sub.endpoint });
      }),
    [run],
  );

  return {
    supported,
    needsInstall,
    permission,
    subscribed,
    prefs,
    busy,
    error,
    subscribe,
    updatePrefs,
    unsubscribe,
    sendTest,
  };
}
