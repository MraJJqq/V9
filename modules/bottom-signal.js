const SOURCE = "https://raw.githubusercontent.com/MraJJqq/bark/main/state.json";
const TARGET = document.getElementById("bottom-signal");
const SYMBOL_ORDER = [
  "MSFTUSDT","GOOGLUSDT","AMZNUSDT","NVDAUSDT","OPENAIUSDT","AMDUSDT",
  "TSMUSDT","AVGOUSDT","ORCLUSDT","ARMUSDT","MUUSDT","ASMLUSDT",
  "SNDKUSDT","SKHYUSDT","MRVLUSDT","GLWUSDT","HOODUSDT","SPCXUSDT",
  "BTCUSDT","HYPEUSDT","XAUUSDT","CLUSDT"
];
const NORMAL = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
const BOLD = Array.from("𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗");
const BOLD_MAP = new Map(NORMAL.map((char, index) => [char, BOLD[index]]));

function formatSymbol(symbol) {
  const name = String(symbol).replace(/USDT$/, "");
  return Array.from(name, char => BOLD_MAP.get(char) || char).join("");
}

async function refreshSignals() {
  try {
    const response = await fetch(SOURCE, {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error("Bark state HTTP " + response.status);
    const data = await response.json();
    const daily = data.daily_signals && typeof data.daily_signals === "object"
      ? Object.values(data.daily_signals) : [];
    const pending = data.pending_signals && typeof data.pending_signals === "object"
      ? Object.values(data.pending_signals) : [];
    const active = new Set([...daily, ...pending]
      .filter(symbol => typeof symbol === "string" && symbol.length > 0));
    const symbols = SYMBOL_ORDER.filter(symbol => active.has(symbol));
    TARGET.textContent = symbols.map(formatSymbol).join("\u00a0▰\u00a0");
  } catch (error) {
    console.warn("[BARK V9 signals]", error);
  }
}

void refreshSignals();
window.setInterval(refreshSignals, 15000);
