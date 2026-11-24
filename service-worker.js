/*
 * VEGAS V9 app-shell cache.
 * Network-first for navigations and static assets keeps Home Screen launches
 * current when online. Cached assets are fallback-only when the network fails.
 * Market data, IndexedDB and user settings are never cached or cleared here.
 */
const RELEASE = "v9-20261124-2";
const CACHE_PREFIX = "vegas-v9-static-";
const CACHE_NAME = CACHE_PREFIX + RELEASE;
const STATIC_DESTINATIONS = new Set(["script", "style", "image", "font"]);

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = (await caches.keys())
      .filter(name => name.startsWith(CACHE_PREFIX))
      .sort()
      .reverse();
    await Promise.all(names.slice(2).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("/version.json")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (request.mode !== "navigate" && !STATIC_DESTINATIONS.has(request.destination)) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: "no-store" });
      if (response.ok && response.type === "basic") {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const current = await caches.open(CACHE_NAME);
      const cached = await current.match(request);
      if (cached) return cached;

      const names = (await caches.keys())
        .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .sort()
        .reverse();
      for (const name of names) {
        const previous = await caches.open(name);
        const fallback = await previous.match(request);
        if (fallback) return fallback;
      }
      throw error;
    }
  })());
});
