/*
 * Home-screen and Safari entry update coordinator for VEGAS V9.
 * Checks the release marker on every launch/foreground return. Reloads at
 * most once per detected release. It never touches trading data or UI state.
 */
const RELEASE = "v9-20261124-1";
const BASE_URL = new URL("./", import.meta.url);
const VERSION_URL = new URL("version.json", BASE_URL);
const RELOAD_KEY = "vegas-v9-update-reload:";

async function checkRelease() {
  try {
    const response = await fetch(new URL(`version.json?check=${Date.now()}`, BASE_URL), {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return;
    const data = await response.json();
    const latest = typeof data?.version === "string" ? data.version : "";
    if (!latest || latest === RELEASE) {
      try { sessionStorage.removeItem(RELOAD_KEY + (latest || "unknown")); } catch (_) {}
      return;
    }
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
    const scope = BASE_URL.pathname;
    const registration = await navigator.serviceWorker.register(scriptURL, {
      scope,
      updateViaCache: "none"
    });
    // Explicit update check is important for a long-lived iOS home-screen app.
    await registration.update();
  } catch (error) {
    console.warn("[VEGAS V9 update] service worker unavailable", error);
  }
}

let checking = false;
async function refreshCheck() {
  if (checking || document.visibilityState === "hidden") return;
  checking = true;
  try {
    await checkRelease();
    await registerWorker();
  } finally {
    checking = false;
  }
}

void refreshCheck();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void refreshCheck();
});
window.addEventListener("pageshow", () => void refreshCheck());
