import test from "node:test";
import assert from "node:assert/strict";
import {
  formatSignalText,
  updateSignalLifecycle,
  BARK_SIGNAL_FEED_URL,
  beijingDateKey,
  isCurrentBeijingFeed,
  updateSignalLifecycleAfterFetchError,
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

test("detected signals remain stored until explicit reset", () => {
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

test("Beijing date key changes exactly at midnight UTC+8", () => {
  assert.equal(beijingDateKey("2026-11-23T15:59:59Z"), "2026-11-23");
  assert.equal(beijingDateKey("2026-11-23T16:00:00Z"), "2026-11-24");
});

test("feed from a prior Beijing date is rejected after midnight", () => {
  const payload = { ...feed(["BTC"]), generated_at: "2026-11-23T23:59:00+08:00" };
  assert.equal(isCurrentBeijingFeed(payload, "2026-11-24T00:00:00+08:00"), false);
  assert.equal(isCurrentBeijingFeed({ ...payload, generated_at: "2026-11-24T00:00:00+08:00" }, "2026-11-24T00:01:00+08:00"), true);
});

test("fetch failure cannot carry yesterday's cached symbols into the new Beijing day", () => {
  const yesterday = updateSignalLifecycle(feed(["BTC"]), {}, "2026-11-23T23:59:00+08:00");
  const afterMidnightFailure = updateSignalLifecycleAfterFetchError(yesterday, "2026-11-24T00:01:00+08:00");
  assert.deepEqual(afterMidnightFailure.records, {});
  assert.deepEqual(afterMidnightFailure.symbols, []);
  assert.deepEqual(afterMidnightFailure.lastFeedSymbols, []);
  assert.equal(afterMidnightFailure.dateKey, "2026-11-24");
});

test("fetch failure preserves today's cached symbols", () => {
  const today = updateSignalLifecycle(feed(["BTC"]), {}, "2026-11-24T09:00:00+08:00");
  const afterFailure = updateSignalLifecycleAfterFetchError(today, "2026-11-24T09:01:00+08:00");
  assert.deepEqual(afterFailure.symbols, ["BTC"]);
});

test("stored signals reset when the Beijing calendar date changes", () => {
  const beforeMidnight = updateSignalLifecycle(feed(["BTC"]), {}, "2026-11-23T23:59:00+08:00");
  const afterMidnight = updateSignalLifecycle(feed([]), beforeMidnight, "2026-11-24T00:00:00+08:00");
  assert.deepEqual(afterMidnight.records, {});
  assert.deepEqual(afterMidnight.symbols, []);
  assert.equal(afterMidnight.dateKey, "2026-11-24");
});
