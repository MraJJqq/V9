import test from "node:test";
import assert from "node:assert/strict";
import {
  formatSignalText,
  updateSignalLifecycle,
  BARK_SIGNAL_FEED_URL,
  SIGNAL_TTL_MS
} from "../modules/signal-ticker/signal-ticker.js";

const feed = symbols => ({ schema_version: 1, source: "Vegasbark", symbols });

test("Bark feed URL points to the Vegasbark public signal feed", () => {
  assert.equal(BARK_SIGNAL_FEED_URL, "https://raw.githubusercontent.com/MraJJqq/Vegasbark/main/public/signals.json");
});

test("signal text preserves Bark order and separator spacing", () => {
  assert.equal(formatSignalText(feed(["BTC", "ETH", "XAU"])), "BTC ▰\u00A0ETH ▰\u00A0XAU");
});

test("empty successful Bark feed displays the exact no-signal text", () => {
  assert.equal(formatSignalText(feed([])), "𝐍𝐨 𝐒𝐢𝐠𝐧𝐚𝐥");
});

test("invalid feed payload is rejected instead of being displayed as no signal", () => {
  assert.throws(() => formatSignalText({ schema_version: 1, source: "other", symbols: [] }), /Invalid Bark signal feed/);
});

test("each signal starts its own 12-hour timer when V9 first detects it", () => {
  const start = 1_000_000;
  const first = updateSignalLifecycle(feed(["BTC"]), {}, start);
  const second = updateSignalLifecycle(feed(["BTC", "ETH"]), first, start + 60_000);
  assert.deepEqual(second.records, { BTC: start, ETH: start + 60_000 });
  assert.deepEqual(second.symbols, ["BTC", "ETH"]);
});

test("signals remain visible until their own 12-hour expiry, independent of midnight", () => {
  const start = 1_000_000;
  const state = updateSignalLifecycle(feed(["BTC", "ETH"]), {}, start);
  const later = updateSignalLifecycle(feed([]), state, start + SIGNAL_TTL_MS - 1);
  assert.deepEqual(later.symbols, ["BTC", "ETH"]);
  const expired = updateSignalLifecycle(feed([]), later, start + SIGNAL_TTL_MS);
  assert.deepEqual(expired.records, {});
  assert.deepEqual(expired.symbols, []);
});

test("an expired signal still present in the feed does not reappear", () => {
  const start = 1_000_000;
  const state = updateSignalLifecycle(feed(["BTC"]), {}, start);
  const expired = updateSignalLifecycle(feed(["BTC"]), state, start + SIGNAL_TTL_MS);
  assert.deepEqual(expired.records, {});
  assert.deepEqual(expired.symbols, []);
  const stillPresent = updateSignalLifecycle(feed(["BTC"]), expired, start + SIGNAL_TTL_MS + 15_000);
  assert.deepEqual(stillPresent.symbols, []);
  const absent = updateSignalLifecycle(feed([]), stillPresent, start + SIGNAL_TTL_MS + 30_000);
  const detectedAgain = updateSignalLifecycle(feed(["BTC"]), absent, start + SIGNAL_TTL_MS + 45_000);
  assert.deepEqual(detectedAgain.symbols, ["BTC"]);
});

test("different symbols expire independently", () => {
  const start = 1_000_000;
  const first = updateSignalLifecycle(feed(["BTC"]), {}, start);
  const second = updateSignalLifecycle(feed(["BTC", "ETH"]), first, start + 60_000);
  const later = updateSignalLifecycle(feed(["BTC", "ETH"]), second, start + SIGNAL_TTL_MS);
  assert.deepEqual(later.symbols, ["ETH"]);
  assert.deepEqual(later.records, { ETH: start + 60_000 });
});
