const SOURCE = "https://raw.githubusercontent.com/MraJJqq/vegas/main/signals.json";
const TARGET = document.getElementById("bottom-signal");
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
    if (!response.ok) throw new Error("Vegas signals HTTP " + response.status);
    const data = await response.json();
    if (!Array.isArray(data.signals)) return;
    const symbols = [...new Set(data.signals
      .map(item => item && item.symbol)
      .filter(symbol => typeof symbol === "string" && symbol.length > 0))];
    TARGET.textContent = symbols.map(formatSymbol).join("\u00a0▰\u00a0");
  } catch (error) {
    console.warn("[VEGAS V9 signals]", error);
  }
}

void refreshSignals();
window.setInterval(refreshSignals, 15000);
