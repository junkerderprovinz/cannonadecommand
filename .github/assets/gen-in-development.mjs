/**
 * Renders the README notice for an app that is still in development, in the style
 * of ArrowLoop's call for Android testers: 1920x640, the app's mark as a relief in
 * the background and in colour on the right. The file is the same in every repo
 * that carries the notice; the app's name and logo come from in-development.json
 * next to it, and the picture is written there as in-development.png.
 *
 * The test tube is Noto Emoji (Apache-2.0), so it looks the same on every system.
 *
 * Needs playwright-core installed globally and Chrome.
 * Run: node .github/assets/gen-in-development.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { chromium } = require(`${execSync("npm root -g").toString().trim()}/playwright-core`);

const here = dirname(fileURLToPath(import.meta.url));
const { name, logo } = JSON.parse(readFileSync(join(here, "in-development.json"), "utf8"));

async function cached(file, url) {
  const path = join(tmpdir(), `in-development-${file}`);
  if (!existsSync(path)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${file}: fetch ${res.status}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(path);
}

const dataUrl = (buf, type) => `data:${type};base64,${buf.toString("base64")}`;
const fonts = "https://github.com/google/fonts/raw/main/ofl";
const bree = dataUrl(await cached("BreeSerif-Regular.ttf", `${fonts}/breeserif/BreeSerif-Regular.ttf`), "font/ttf");
const lato = dataUrl(await cached("Lato-Regular.ttf", `${fonts}/lato/Lato-Regular.ttf`), "font/ttf");
const latoBold = dataUrl(await cached("Lato-Bold.ttf", `${fonts}/lato/Lato-Bold.ttf`), "font/ttf");
const tube = dataUrl(await cached("emoji_u1f9ea.svg", "https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/svg/emoji_u1f9ea.svg"), "image/svg+xml");
const mark = dataUrl(readFileSync(join(here, logo)), "image/svg+xml");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Bree Serif"; src: url(${bree}); }
@font-face { font-family: Lato; src: url(${lato}); font-weight: 400; }
@font-face { font-family: Lato; src: url(${latoBold}); font-weight: 700; }
* { box-sizing: border-box; margin: 0; }
body { position: relative; width: 1920px; height: 640px; overflow: hidden; font-family: Lato, sans-serif; background: #0c0c0b; }
.wall { position: absolute; inset: 0; background: radial-gradient(55% 60% at 62% 35%, #26231d, #0f0e0c 72%); }
.relief { position: absolute; width: 40%; left: 58%; top: -30%; transform: rotate(-10deg); opacity: .32;
  filter: grayscale(1) brightness(.36) contrast(1.2) drop-shadow(-2px -2px 0 rgba(255,255,255,.16)) drop-shadow(12px 18px 26px rgba(0,0,0,.85)); }
.vignette { position: absolute; inset: 0; box-shadow: inset 0 0 200px rgba(0,0,0,.6); }
.copy { position: absolute; left: 96px; top: 0; bottom: 0; width: 1180px; display: flex; flex-direction: column; justify-content: center; gap: 26px; }
.label { align-self: flex-start; padding: 8px 18px; border-radius: 8px; background: #FCC419; color: #141414; font: 700 22px/1 Lato, sans-serif; letter-spacing: .12em; text-transform: uppercase; }
h1 { display: flex; align-items: center; gap: 28px; font: 400 92px/1.05 "Bree Serif", serif; color: #f4f4f4; }
h1 img { width: 96px; height: 96px; }
h1 em { font-style: normal; color: #FCC419; }
.sub { font-size: 34px; line-height: 1.35; color: #c9bfa9; }
.go { align-self: flex-start; margin-top: 8px; padding: 22px 40px; border-radius: 18px; background: #FCC419; color: #141414; font: 700 34px/1 Lato, sans-serif;
  box-shadow: 0 0 0 6px rgba(252,196,25,.18), 0 18px 40px rgba(0,0,0,.5); }
.app { position: absolute; right: 150px; top: 50%; width: 380px; height: 380px; transform: translateY(-50%); object-fit: contain;
  filter: drop-shadow(0 26px 40px rgba(0,0,0,.7)); }
</style></head><body>
<div class="wall"></div><img class="relief" src="${mark}"><div class="vignette"></div>
<div class="copy">
  <span class="label">In development</span>
  <h1><img src="${tube}" alt="">Testers <em>welcome</em></h1>
  <p class="sub">${name} is still in development, so bugs can happen.<br>Try it and report what you find.</p>
  <span class="go">Report a bug &rarr;</span>
</div>
<img class="app" src="${mark}">
</body></html>`;

// Rendered at twice the size and scaled down, which keeps the type crisp.
const browser = await chromium.launch({ channel: "chrome" });
const big = await browser.newPage({ viewport: { width: 1920, height: 640 }, deviceScaleFactor: 2 });
await big.setContent(html);
await big.evaluate(() => document.fonts.ready);
const shot = await big.screenshot();
const small = await browser.newPage({ viewport: { width: 1920, height: 640 } });
await small.setContent(`<body style="margin:0"><img src="${dataUrl(shot, "image/png")}" style="display:block;width:1920px;height:640px">`);
await small.locator("img").evaluate((img) => img.decode());
await small.screenshot({ path: join(here, "in-development.png") });
await browser.close();
console.log("in-development.png written");
