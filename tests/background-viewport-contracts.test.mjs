import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = path => readFile(new URL(path, root), "utf8");

test("background layer covers the complete dynamic app viewport", async () => {
  const html = await source("index.html");
  const background = await source("background/background.css");
  const full = await source("assets/css/full-screen-dynamic.css");
  assert.match(html, /<main id="app">\s*<div id="background-layer"/);
  assert.match(background, /#background-layer\{[^}]*position:absolute;inset:0;z-index:0;[^}]*background:#07110D/);
  assert.match(full, /#app\{[^}]*width:100vw;height:100vh;height:100dvh/);
  assert.match(full, /#kline-host\{[^}]*position:absolute;inset:0;width:100%;height:100%/);
});

test("cold start paints the fixed background before asynchronous modules become ready", async () => {
  const html = await source("index.html");
  const modules = await source("assets/css/v9-modules.css");
  assert.ok(html.indexOf('id="background-layer"') < html.indexOf('id="kline-host"'));
  assert.ok(html.indexOf('id="kline-host"') < html.indexOf('id="logo-frame"'));
  assert.ok(html.indexOf('id="rolling-cards-frame"') < html.indexOf('type="module"'));
  assert.match(modules, /#app\{isolation:isolate\}/);
  assert.match(modules, /#kline-host\{[^}]*z-index:5;[^}]*opacity:0/);
  assert.match(modules, /#kline-host\.is-ready\{opacity:1\}/);
  assert.match(modules, /#logo-frame\{[^}]*opacity:0/);
  assert.match(modules, /#rolling-cards-frame\{[^}]*opacity:0/);
  assert.match(html, /<meta name="theme-color" content="#07110D">/);
  assert.match(modules, /html,body\{background:#07110D\}/);
});

test("iOS safe-area and dynamic viewport contracts cover all four edges", async () => {
  const html = await source("index.html");
  const full = await source("assets/css/full-screen-dynamic.css");
  const logoHtml = await source("modules/logo/logo.html");
  assert.match(html, /viewport-fit=cover/);
  assert.match(logoHtml, /viewport-fit=cover/);
  for (const edge of ["top", "right", "bottom", "left"]) {
    assert.match(full, new RegExp(`safe-area-inset-${edge}`), `missing safe-area inset for ${edge}`);
  }
  assert.match(full, /height:100dvh/);
  assert.match(full, /@supports not\(height:100dvh\)/);
  assert.match(full, /#logo-frame\{[^}]*top:var\(--v9-safe-top\)/);
  assert.match(full, /#timeframe-frame\{[^}]*bottom:var\(--v9-safe-bottom\)/);
  assert.match(full, /#rolling-cards-frame\{[^}]*bottom:0/);
});
