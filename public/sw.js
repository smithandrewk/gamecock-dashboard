/* gamecock.ai service worker: push notifications ONLY.
 * Deliberately no fetch handler and no caching: scores must never come from a stale cache. */

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Remove any caches an older worker may have created.
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Gamecocks", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Gamecocks";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    timestamp: data.ts || Date.now(),
    data: { url: data.url || "/", kind: data.kind, sport: data.sport, eventId: data.eventId },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = all.find((c) => new URL(c.url).origin === target.origin);
      if (same) {
        await same.focus();
        if ("navigate" in same && same.url !== target.href) {
          try {
            await same.navigate(target.href);
          } catch {
            /* cross-origin or uncontrolled: focusing is enough */
          }
        }
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});

function b64urlToBytes(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// The push service rotated or expired our subscription: subscribe again and tell the server,
// which carries the old subscription's prefs over to the new endpoint.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription;
      let sub = event.newSubscription;
      if (!sub) {
        let key = old && old.options && old.options.applicationServerKey;
        if (!key) {
          const r = await fetch("/api/push/vapid", { cache: "no-store" });
          if (!r.ok) return;
          key = b64urlToBytes((await r.json()).publicKey);
        }
        sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      }
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), oldEndpoint: old ? old.endpoint : undefined }),
      });
    })(),
  );
});
