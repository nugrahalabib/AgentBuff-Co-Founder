// AgentBuff Co-Founder — PWA service worker. PRD §14 (mobile-first, installable PWA).
// SECURITY: this cache must NEVER persist authenticated/per-user data or secrets on disk. It therefore
//   • never touches /api/* responses (they carry BYOK status, tokens, exports, project data) — network only,
//   • never caches navigations (authenticated HTML) — only an offline fallback to the public landing "/",
//   • only caches immutable static assets, and skips anything marked Cache-Control: no-store/private,
//   • can be wiped on sign-out via a {type:"clear-cache"} message (no PII left on a shared device).
// Bumped to v2 to evict any v1 cache that may have stored authenticated responses under the old strategy.

const CACHE = "agentbuff-v2";

function isCacheableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.startsWith("/icon") ||
    /\.(?:css|js|woff2?|png|svg|jpe?g|webp|ico|gif)$/.test(url.pathname)
  );
}

self.addEventListener("install", (event) => {
  // Precache only the PUBLIC landing page as the offline fallback (no per-user data).
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add("/"))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
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

// Let the app wipe all caches on sign-out so no cached page/asset lingers on a shared device.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear-cache") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ignore cross-origin (CDNs, favicons)
  if (url.pathname.startsWith("/api/")) return; // NEVER cache authenticated/API responses

  // Navigations: always network-first; offline → public landing shell (never store authenticated HTML).
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          return (await caches.match("/")) ?? Response.error();
        }
      })(),
    );
    return;
  }

  // Static assets only: cache-first, and only store immutable static files that don't opt out.
  if (!isCacheableAsset(url)) return;
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        const cc = res.headers.get("cache-control") || "";
        if (res.ok && !/(?:no-store|private)/i.test(cc)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      } catch {
        return (await caches.match(req)) ?? Response.error();
      }
    })(),
  );
});
