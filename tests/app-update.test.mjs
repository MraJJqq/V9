import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("V9 entry installs the home-screen update coordinator without changing app layout", async () => {
  const html = await read("../index.html");
  assert.match(html, /app-update\\.js\\?v=v9-20261124-2/);
  assert.match(html, /id="kline-host"/);
  assert.match(html, /id="logo-frame"/);
  assert.match(html, /id="timeframe-frame"/);
  assert.match(html, /id="rolling-cards-frame"/);
});

test("release checker bypasses HTTP cache and checks on launch and foreground", async () => {
  const source = await read("../app-update.js");
  assert.match(source, /cache:\s*"no-store"/);
  assert.match(source, /registration\.update\(\)/);
  assert.match(source, /updateViaCache:\s*"none"/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /pageshow/);
  assert.match(source, /sessionStorage\.setItem/);
});

test("service worker keeps navigation fresh and isolates app cache from market data", async () => {
  const source = await read("../service-worker.js");
  assert.match(source, /request\.mode === "navigate"/);
  assert.match(source, /fetch\(request, \{ cache: "no-store" \}\)/);
  assert.match(source, /STATIC_DESTINATIONS/);
  assert.match(source, /version\.json/);
  assert.doesNotMatch(source, /indexedDB|deleteDatabase|localStorage\.clear/);
  assert.match(source, /self\\.skipWaiting\\s*\\(/);
});

test("release marker matches deployed client version", async () => {
  const marker = JSON.parse(await read("../version.json"));
  const updater = await read("../app-update.js");
  const worker = await read("../service-worker.js");
  assert.equal(marker.version, "v9-20261124-2");
  assert.match(updater, new RegExp(marker.version));
  assert.match(worker, new RegExp(marker.version));
});
