/*
 * VEGAS V9 app-shell cache.
 * Only same-origin static app resources are cached. Market data and IndexedDB
 * are deliberately outside this cache and are never cleared by this worker.
 */
const RELEASE = "v9-20261124-1";
const CACHE_PREFIX = "vegas-v9-static-";
const CACHE_NAME = CACHE_PREFIX + RELEASE;
const STATIC_DESTINATIONS = new Set(["script", "style", "image", "font"]);

self.addEventListener("install", () => {
  // Do not skipWaiting: an active session must finish on its current release.
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX));
    const previous = names.filter(name => name !== CACHE_NAME).sort().reverse();
    await Promise.all(previous.slice(1).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Release metadata must always come from the network, never from this cache.
  if (url.pathname.endsWith("/version.json")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;
        const fallback = await caches.match(new URL("./", self.registration.scope).href);
        if (fallback) return fallback;
        throw error;
      }
    })());
    return;
  }

  if (!STATIC_DESTINATIONS.has(request.destination)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
