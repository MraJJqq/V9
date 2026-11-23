import test from "node:test";
import assert from "node:assert/strict";
import {
  formatSignalText,
  updateSignalLifecycle,
  BARK_SIGNAL_FEED_URL,
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

test("detected signals remain stored without a 12-hour expiry", () => {
  const first = updateSignalLifecycle(feed(["BTC"]), {});
  const second = updateSignalLifecycle(feed(["BTC", "ETH"]), first);
  assert.deepEqual(second.records, { BTC: true, ETH: true });
  assert.deepEqual(second.symbols, ["BTC", "ETH"]);
});

test("signals remain visible when they disappear from the Bark feed", () => {
  const state = updateSignalLifecycle(feed(["BTC", "ETH"]), {});
  const later = updateSignalLifecycle(feed([]), state);
  assert.deepEqual(later.records, { BTC: true, ETH: true });
  assert.deepEqual(later.symbols, ["BTC", "ETH"]);
});

test("a symbol is not duplicated while continuously present in the feed", () => {
  const state = updateSignalLifecycle(feed(["BTC"]), {});
  const stillPresent = updateSignalLifecycle(feed(["BTC"]), state);
  assert.deepEqual(stillPresent.symbols, ["BTC"]);
  const absent = updateSignalLifecycle(feed([]), stillPresent);
  const detectedAgain = updateSignalLifecycle(feed(["BTC"]), absent);
  assert.deepEqual(detectedAgain.symbols, ["BTC"]);
});
