"use client";

import { useCallback, useEffect, useState } from "react";

/** Chrome/Edge/Samsung Internet's install prompt event (not in lib.dom). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallPlatform = "ios-safari" | "ios-other" | "android" | "desktop";

export interface InstallState {
  /** Detection runs after mount; until then nothing renders that depends on it. */
  ready: boolean;
  platform: InstallPlatform;
  /** Running from the home screen (display-mode: standalone) */
  standalone: boolean;
  /** A native install prompt is available (Android/desktop Chrome) */
  canPrompt: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

function detect(): { platform: InstallPlatform; standalone: boolean } {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  let platform: InstallPlatform = "desktop";
  if (ios) platform = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) ? "ios-other" : "ios-safari";
  else if (/Android/i.test(ua)) platform = "android";
  return { platform, standalone };
}

export function useInstall(): InstallState {
  const [ready, setReady] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>("desktop");
  const [standalone, setStandalone] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const d = detect();
    /* eslint-disable react-hooks/set-state-in-effect -- browser-only detection after mount */
    setPlatform(d.platform);
    setStandalone(d.standalone);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep it for our own button instead of Chrome's mini-infobar
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome;
  }, [deferred]);

  return { ready, platform, standalone, canPrompt: !!deferred, promptInstall };
}
