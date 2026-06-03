// AgentBuff Co-Founder — PWA service worker. PRD §14 (mobile-first, installable PWA).
// Strategy: NETWORK-FIRST (always fresh when online) with a runtime cache fallback for offline.
// Only GETs to our own origin are cached; auth/dynamic data therefore stays current online, and the
// app still opens offline. Conservative on purpose — never serves stale content while connected.

const CACHE = "agentbuff-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // don't touch cross-origin (CDNs, favicons)

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      } catch {
        const cached = await caches.match(req);
        return cached ?? (await caches.match("/")) ?? Response.error();
      }
    })(),
  );
});
