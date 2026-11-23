export const BARK_SIGNAL_FEED_URL = "https://raw.githubusercontent.com/MraJJqq/Vegasbark/main/public/signals.json";
export const SIGNAL_STATE_KEY = "vegas-v9-signal-lifecycle-v1";

export function beijingDateKey(value = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value instanceof Date ? value : new Date(value));
  const part = type => parts.find(item => item.type === type)?.value;
  return part("year") + "-" + part("month") + "-" + part("day");
}

export function isCurrentBeijingFeed(payload, now = Date.now()) {
  if (!payload || typeof payload.generated_at !== "string") return false;
  const generated = new Date(payload.generated_at);
  return Number.isFinite(generated.getTime()) && beijingDateKey(generated) === beijingDateKey(now);
}

export function formatSignalText(payload) {
  if (!payload || payload.schema_version !== 1 || payload.source !== "Vegasbark" || !Array.isArray(payload.symbols)) {
    throw new TypeError("Invalid Bark signal feed");
  }
  const symbols = payload.symbols
    .map(value => String(value).trim())
    .filter(value => /^[A-Z0-9]{2,16}$/.test(value));
  return symbols.length ? symbols.join(" ▰\u00A0") : "𝐍𝐨 𝐒𝐢𝐠𝐧𝐚𝐥";
}

export function updateSignalLifecycle(payload, state = {}, now = Date.now()) {
  if (!payload || payload.schema_version !== 1 || payload.source !== "Vegasbark" || !Array.isArray(payload.symbols)) {
    throw new TypeError("Invalid Bark signal feed");
  }

  const incoming = [...new Set(payload.symbols
    .map(value => String(value).trim())
    .filter(value => /^[A-Z0-9]{2,16}$/.test(value)))];
  const dateKey = beijingDateKey(now);
  const sameDay = state.dateKey === dateKey;
  const previousFeed = new Set(sameDay && Array.isArray(state.lastFeedSymbols) ? state.lastFeedSymbols : []);
  const records = sameDay && state.records && typeof state.records === "object" ? { ...state.records } : {};

  // Keep every detected symbol until the explicit daily reset is added.
  // A symbol already present in the feed is not duplicated.
  for (const symbol of incoming) {
    if (!previousFeed.has(symbol) && !Object.hasOwn(records, symbol)) {
      records[symbol] = true;
    }
  }

  const symbols = [
    ...incoming.filter(symbol => Object.hasOwn(records, symbol)),
    ...Object.keys(records).filter(symbol => !incoming.includes(symbol))
  ];
  return { records, lastFeedSymbols: incoming, symbols, dateKey };
}

function readSignalState() {
  try {
    const value = JSON.parse(localStorage.getItem(SIGNAL_STATE_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch (_) {
    return {};
  }
}

function writeSignalState(state) {
  try {
    if (Object.keys(state.records).length || state.lastFeedSymbols.length) {
      localStorage.setItem(SIGNAL_STATE_KEY, JSON.stringify({
        records: state.records,
        lastFeedSymbols: state.lastFeedSymbols,
        dateKey: state.dateKey
      }));
    } else {
      localStorage.removeItem(SIGNAL_STATE_KEY);
    }
  } catch (error) {
    console.warn("[VEGAS V9 signal storage]", error);
  }
}

function mountSignalTicker() {
  const ticker = document.getElementById("signal-ticker");
  if (!ticker) return;

  let timer = null;
  let request = null;
  let stopped = false;
  let signalState = readSignalState();

  async function refresh() {
    if (stopped || document.hidden) return;
    const controller = new AbortController();
    request = controller;
    try {
      const response = await fetch(BARK_SIGNAL_FEED_URL, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok) throw new Error("Bark feed HTTP " + response.status);
      const payload = await response.json();
      const currentDayPayload = isCurrentBeijingFeed(payload)
        ? payload
        : { schema_version: 1, source: "Vegasbark", symbols: [] };
      signalState = updateSignalLifecycle(currentDayPayload, signalState);
      writeSignalState(signalState);
      ticker.replaceChildren();
      ticker.textContent = formatSignalText({ ...payload, symbols: signalState.symbols });
      ticker.hidden = false;
    } catch (error) {
      if (error.name !== "AbortError") {
        signalState = updateSignalLifecycle({
          schema_version: 1,
          source: "Vegasbark",
          symbols: signalState.lastFeedSymbols || []
        }, signalState);
        writeSignalState(signalState);
        ticker.replaceChildren();
        ticker.textContent = formatSignalText({ schema_version: 1, source: "Vegasbark", symbols: signalState.symbols });
        ticker.hidden = false;
        console.warn("[VEGAS V9 Bark feed]", error);
      }
    } finally {
      if (request === controller) request = null;
    }
  }

  function start() {
    if (stopped || timer !== null) return;
    void refresh();
    timer = window.setInterval(refresh, 15000);
  }

  function stop() {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    request?.abort();
    request = null;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
  window.addEventListener("pagehide", () => {
    stopped = true;
    stop();
  }, { once: true });

  start();
}

if (typeof document !== "undefined") mountSignalTicker();
