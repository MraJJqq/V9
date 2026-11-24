/*
 * VEGAS V9 update coordinator for Safari and iOS Home Screen web apps.
 * Release metadata is always fetched from the network. App data and UI state
 * are not touched by this updater.
 */
const BUILD_RELEASE = "v9-20261124-2";
const BASE_URL = new URL("./", import.meta.url);
const RELOAD_KEY = "vegas-v9-update-reload:";
const CONTROLLER_RELOAD_KEY = "vegas-v9-controller-reload";
let checking = false;

async function checkRelease() {
  try {
    const url = new URL("version.json", BASE_URL);
    url.searchParams.set("check", String(Date.now()));
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return;
    const data = await response.json();
    const latest = typeof data?.version === "string" ? data.version : "";
    if (!latest || latest === BUILD_RELEASE) return;

    let alreadyReloaded = false;
    try { alreadyReloaded = sessionStorage.getItem(RELOAD_KEY + latest) === "1"; } catch (_) {}
    if (alreadyReloaded) return;
    try { sessionStorage.setItem(RELOAD_KEY + latest, "1"); } catch (_) {}
    location.reload();
  } catch (error) {
    console.warn("[VEGAS V9 update] release check deferred", error);
  }
}

async function registerWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const scriptURL = new URL("service-worker.js", BASE_URL);
    const registration = await navigator.serviceWorker.register(scriptURL, {
      scope: BASE_URL.pathname,
      updateViaCache: "none"
    });
    await registration.update();
    if (registration.waiting) {
      registration.waiting.postMessage({ type: "VEGAS_SKIP_WAITING" });
    }
  } catch (error) {
    console.warn("[VEGAS V9 update] service worker unavailable", error);
  }
}

async function refreshCheck() {
  if (checking || document.visibilityState === "hidden") return;
  checking = true;
  try {
    await registerWorker();
    await checkRelease();
  } finally {
    checking = false;
  }
}

const hadControllerAtStartup = !!navigator.serviceWorker?.controller;
if (hadControllerAtStartup && navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    let reloaded = false;
    try { reloaded = sessionStorage.getItem(CONTROLLER_RELOAD_KEY) === "1"; } catch (_) {}
    if (reloaded) return;
    try { sessionStorage.setItem(CONTROLLER_RELOAD_KEY, "1"); } catch (_) {}
    location.reload();
  });
}

void refreshCheck();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    try { sessionStorage.removeItem(CONTROLLER_RELOAD_KEY); } catch (_) {}
    void refreshCheck();
  }
});
window.addEventListener("pageshow", () => void refreshCheck());
