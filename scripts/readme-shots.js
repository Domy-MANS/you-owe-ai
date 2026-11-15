#!/usr/bin/env node
"use strict";
// Retakes the README screenshots (docs/img/{hero,bill,call,friends}-{en,zh}.png) from the built page
// in real Chrome, so they never drift from what the page says. Run: npm run shots   (needs Chrome)
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const puppeteer = require("puppeteer-core");

const CHROME = process.env.CHROME_PATH || {
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "/usr/bin/google-chrome",
  win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
}[process.platform];
const ROOT = path.join(__dirname, "..");
const PAGE = "file://" + path.join(ROOT, "docs", "index.html");
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// what runs before the page's own scripts: a debt clock with a crowd in it, and (optionally) a plea already made
function setup(o) {
  window.__clockFake = function () { return { n: 1024, sum: 253100, guilty: 440, refuse: 584, order: 1024, pct: 87 }; };
  try {
    localStorage.clear(); // every shot starts as a first visit
    if (o.plea) localStorage.setItem("vw-plea", JSON.stringify({ y: new Date().getFullYear(), p: "refuse", d: "paid" }));
    if (o.friend) localStorage.setItem("vw-friend", JSON.stringify({ s: o.friend, t: Date.now() }));
  } catch (e) {}
}

(async () => {
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "build-web.js")]);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });

  async function open(lang, { hash = "", plea = false, friend = null, phone = false } = {}) {
    const pg = await browser.newPage();
    if (phone) await pg.setUserAgent(IPHONE);
    await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await pg.evaluateOnNewDocument(setup, { plea, friend });
    await pg.goto(`${PAGE}?lang=${lang}&still${hash}`);
    await sleep(400);
    return pg;
  }
  /** The demo's numbers as a real bill (so the clock, the plea and the call all happen). `tweak` runs in the page. */
  async function bill(pg, tweak) {
    await pg.evaluate((src) => {
      const me = JSON.parse(JSON.stringify(window.VW_DEMO)); me.demo = false;
      if (src) new Function("me", src)(me);
      window.__vw.show(me, true);
    }, tweak || "");
    await sleep(700);
  }
  /** Turn to the page that holds `sel`. */
  async function turnTo(pg, sel) {
    for (let i = 0; i < 14; i++) {
      if (await pg.$(".slide.on " + sel)) break;
      await pg.keyboard.press("ArrowRight"); await sleep(120);
    }
    await sleep(500);
  }
  const shot = (pg) => pg.screenshot({ type: "png", encoding: "base64" });

  async function compose(file, shots, raise) {
    const pg = await browser.newPage();
    await pg.setViewport({ width: 866, height: 605, deviceScaleFactor: 2 });
    await pg.setContent(`<style>
      html, body { margin: 0; background: transparent; }
      .row { display: flex; justify-content: space-between; align-items: flex-start; padding: 50px 30px 0; }
      .phone { position: relative; width: 236px; height: 511px; padding: 7px; border-radius: 38px; background: #1c1c1e; }
      .phone.up { margin-top: -20px; }
      .phone img { display: block; width: 236px; height: 511px; border-radius: 31px; }
      .phone::after { content: ""; position: absolute; top: 9px; left: 50%; width: 60px; height: 10px; margin-left: -30px; border-radius: 5px; background: #000; }
    </style><div class="row">${shots.map((s, i) => `<div class="phone${raise && i === 1 ? " up" : ""}"><img src="data:image/png;base64,${s}"></div>`).join("")}</div>`);
    await sleep(300);
    await pg.screenshot({ path: path.join(ROOT, "docs", "img", file), omitBackground: true });
    await pg.close();
    console.log("docs/img/" + file);
  }

  for (const lang of ["en", "zh"]) {
    // ---- hero: the cover, the catchphrases, the client file ----
    let pg = await open(lang, { plea: true });
    await bill(pg);
    const cover = await shot(pg);
    await turnTo(pg, ".rc-item.big"); const noise = await shot(pg);
    await turnTo(pg, ".rc-persona"); const file = await shot(pg);
    await compose(`hero-${lang}.png`, [cover, noise, file], true);

    // ---- bill: item 1, the court, the IOU ----
    await turnTo(pg, "#card"); const iou = await shot(pg);
    await pg.close();
    pg = await open(lang, { plea: true });
    await bill(pg);
    await turnTo(pg, "#plea"); const court = await shot(pg);
    await pg.keyboard.press("ArrowRight"); await sleep(600); const item1 = await shot(pg);
    await compose(`bill-${lang}.png`, [item1, court, iou]);

    // ---- call: ringing, the call itself, the badge after you hang up on it ----
    await pg.keyboard.press("ArrowLeft"); await sleep(100); await pg.keyboard.press("ArrowLeft");
    await pg.waitForSelector(".call-bar.in", { timeout: 15000 }); await sleep(700);
    const ringing = await shot(pg);
    await pg.click(".call-bar .yes"); await sleep(6800);
    const onCall = await shot(pg);
    await pg.close();
    pg = await open(lang, { plea: true });
    await bill(pg);
    await pg.waitForSelector(".call-bar.in", { timeout: 15000 }); await sleep(500);
    await pg.click(".call-bar .no"); await sleep(1300);
    const missed = await shot(pg);
    await pg.close();
    await compose(`call-${lang}.png`, [ringing, onCall, missed]);

    // ---- friends: their shared bill, the phone home page, the comparison ----
    pg = await open(lang);
    const link = await pg.evaluate(() => window.VWShare.link(Object.assign({}, window.VW_DEMO, { plea: "refuse", defense: "paid" })));
    await pg.close();
    const code = link.split("#s=")[1];
    pg = await open(lang, { hash: "#s=" + code }); await sleep(500);
    const theirs = await shot(pg);
    await pg.close();
    pg = await open(lang, { phone: true });
    const home = await shot(pg);
    await pg.close();
    pg = await open(lang, { friend: code, plea: true });
    await bill(pg, `
      me.workHours = 20; me.totalTokens = 2.1e6; me.tokens.output = 4e5; me.prompts = 900; me.shares.night = 0.04;
      me.roast.prompts = 900; me.roast.you.deny = 58; me.roast.you.thanks = 94; me.roast.you.why = 20; me.roast.you.lost = 30; me.roast.ai.sorry = 22; me.roast.angriestDay = null; me.roast.latest = null; me.roast.tinyShare = 0.05;
      me.roast.catchphrases = [{ text: "looks good", count: 5 }]; me.roast.catchphrases_zh = [{ text: "挺好的", count: 5 }];`);
    const versus = await shot(pg);
    await pg.close();
    await compose(`friends-${lang}.png`, [theirs, home, versus]);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
