// Browser tests: the built page (docs/index.html) in real Chrome, real animations, phone sizes.
// Run: npm run test:e2e   (needs Chrome; set CHROME_PATH if it isn't in the default place)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const puppeteer = require("puppeteer-core");
const { chatgptExport } = require("../test/helpers/zip");

const CHROME = process.env.CHROME_PATH || {
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "/usr/bin/google-chrome",
  win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
}[process.platform];
const ROOT = path.join(__dirname, "..");
const PAGE = "file://" + path.join(ROOT, "docs", "index.html");
const PHONES = [[360, 740], [375, 667], [390, 844]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let browser, zipPath;
test.before(async () => {
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "build-web.js")]);
  zipPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "yoa-")), "chatgpt-export.zip");
  fs.writeFileSync(zipPath, chatgptExport(40));
  browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--autoplay-policy=no-user-gesture-required"] });
});
test.after(() => browser && browser.close());

/** A fresh phone-sized page that records errors. `setup` runs before the page's own scripts. */
async function open(url, { w = 390, h = 844, setup, arg } = {}) {
  const pg = await browser.newPage();
  await pg.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  pg.errors = [];
  pg.on("pageerror", (e) => pg.errors.push(e.message));
  if (setup) await pg.evaluateOnNewDocument(setup, arg); // runs in the page: pass values as `arg`, not closures
  await pg.goto(url);
  return pg;
}
const text = (pg, sel) => pg.$eval(sel, (e) => e.textContent.replace(/\s+/g, " ").trim());
const exists = (pg, sel) => pg.$(sel).then(Boolean);

test("every page fits a phone after printing: no clipped text, nothing off-screen", async () => {
  for (const [w, h] of PHONES) for (const lang of ["en", "zh"]) {
    const pg = await open(`${PAGE}?lang=${lang}`, { w, h });
    await pg.click("#demo");
    for (let i = 0; i < 9; i++) {
      if (i) await pg.keyboard.press("ArrowRight");
      await sleep(i === 0 ? 3200 : 2200); // let the receipt print and the total count up
      const bad = await pg.evaluate((W) => {
        const out = [];
        for (const el of document.querySelectorAll(".slide.on .pop *, .top *")) {
          if (el.closest(".deco") || el.tagName === "CANVAS") continue;
          const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!ownText) continue;
          const cs = getComputedStyle(el), r = el.getBoundingClientRect();
          if (cs.clipPath !== "none") out.push(`clip-path left on "${el.textContent.trim().slice(0, 20)}"`);
          if (r.width && (r.right > W + 1 || r.left < -1)) out.push(`off-screen "${el.textContent.trim().slice(0, 20)}"`);
        }
        return out;
      }, w);
      assert.deepEqual(bad, [], `${w}×${h} ${lang} page ${i}`);
    }
    assert.deepEqual(pg.errors, []);
    await pg.close();
  }
});

test("the total counts up to the real amount, then the stamp lands", async () => {
  const pg = await open(`${PAGE}?lang=en`);
  await pg.click("#demo");
  await sleep(300);
  assert.equal(await text(pg, ".slide.on .rc-total"), "$0.00");
  await sleep(3000);
  assert.equal(await text(pg, ".slide.on .rc-total"), await pg.evaluate(() => window.VW_TOTAL));
  assert.equal(await pg.$eval(".slide.on .stamp", (e) => getComputedStyle(e).opacity), "1");
  await pg.close();
});

test("sound toggle mutes the printer and the ringtone; muted still vibrates", async () => {
  const count = (mode) => {
    localStorage.setItem("vw-sound", mode);
    window.__osc = 0; window.__noise = 0; window.__vib = 0;
    const AC = window.AudioContext;
    AC.prototype.createOscillator = ((f) => function () { window.__osc++; return f.call(this); })(AC.prototype.createOscillator);
    AC.prototype.createBufferSource = ((f) => function () { window.__noise++; return f.call(this); })(AC.prototype.createBufferSource);
    navigator.vibrate = () => { window.__vib++; return true; };
  };
  for (const [mode, expectSound] of [["off", false], ["on", true]]) {
    const pg = await open(`${PAGE}?lang=en`, { setup: count, arg: mode });
    await pg.click("#demo"); await sleep(1500);
    await pg.evaluate(() => window.VWCall.incoming(() => {})); await sleep(3000);
    const r = await pg.evaluate(() => ({ osc: window.__osc, noise: window.__noise, vib: window.__vib }));
    assert.equal(r.osc > 0, expectSound, `ringtone with sound ${mode}`);
    assert.equal(r.noise > 0, expectSound, `printer with sound ${mode}`);
    assert.ok(r.vib > 0, "vibrates either way");
    assert.match(await text(pg, "#snd"), mode === "on" ? /Sound on/ : /Muted/);
    await pg.close();
  }
});

test("the call: decline → missed badge → call back → hang up → call-back badge → import → bill goes up", async () => {
  const pg = await open(`${PAGE}?lang=en`);
  await pg.click("#demo"); await sleep(800);
  const before = await pg.evaluate(() => window.VW_TOTAL);
  await pg.evaluate(() => window.VWCall.incoming((r) => { window.__imported = r.sessions.length; }));
  await sleep(700);
  await pg.click(".call-bar .no"); await sleep(900);
  assert.equal(await exists(pg, ".call-missed .dot"), true, "red dot after declining");
  assert.equal(await text(pg, ".call-missed .tag"), "You hung up on AI");
  await pg.click(".call-missed"); await sleep(1200);
  assert.equal(await exists(pg, ".call-ov"), true, "calls back");
  await pg.click(".call-ov .end"); await sleep(600);
  assert.equal(await exists(pg, ".call-missed .dot"), false, "no red dot after a real call");
  assert.equal(await text(pg, ".call-missed .tag"), "Call back anytime");
  await pg.click(".call-missed"); await sleep(6200);
  await pg.click('.call-opt[data-k="gpt"]');
  await (await pg.$(".call-drop input")).uploadFile(zipPath); await sleep(1200);
  assert.match(await text(pg, ".call-drop span"), /Found 40 ChatGPT conversations/);
  await pg.click(".go-recalc"); await sleep(400);
  assert.equal(await pg.evaluate(() => window.__imported), 40);
  assert.equal(await exists(pg, ".call-missed"), false, "badge gone once imported");
  assert.deepEqual(pg.errors, []);
  await pg.close();
});

test("the call follows the language switch: ringing, mid-call, badge, home page", async () => {
  const pg = await open(`${PAGE}?lang=zh`);
  await pg.click("#web"); await sleep(300);
  assert.match(await text(pg, ".call-ov .call-later"), /邮件还没到/);
  await pg.click(".call-ov .end");
  await pg.click("#demo"); await sleep(600);
  await pg.evaluate(() => window.VWCall.incoming(() => {})); await sleep(800);
  assert.match(await text(pg, ".call-bar .call-who"), /网页版 AI/);
  await pg.click("#lang"); await sleep(300);
  assert.match(await text(pg, ".call-bar .call-who"), /Web AI/);
  await pg.click(".call-bar .yes"); await sleep(3200);
  assert.match(await text(pg, ".call-lines"), /\$/);
  await pg.click(".call-lang"); await sleep(300);
  assert.match(await text(pg, ".call-lines"), /¥/);
  assert.equal(await text(pg, "#lang .on"), "中");
  assert.deepEqual(pg.errors, []);
  await pg.close();
});

test("share links: short, same total for the viewer, old links still open", async () => {
  const pg = await open(`${PAGE}?lang=en`);
  await pg.click("#demo"); await sleep(3200);
  const mine = await pg.evaluate(async () => ({ total: window.VW_TOTAL, link: await window.VWShare.link(window.__vw ? window.VW_DEMO : null) }));
  assert.ok(mine.link.length < 600, `link is ${mine.link.length} chars`);
  const viewer = await open(PAGE + "?lang=en" + mine.link.slice(mine.link.indexOf("#")));
  await sleep(3200);
  assert.equal(await viewer.evaluate(() => window.VW_TOTAL), mine.total);
  assert.match(await text(viewer, ".slide.on .kicker"), /shared their AI invoice/);
  const v1 = await pg.evaluate(async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(window.VWShare.shareable(window.VW_DEMO)));
    const z = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    let bin = ""; z.forEach((c) => (bin += String.fromCharCode(c)));
    return "z" + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  });
  const old = await open(`${PAGE}?lang=en#s=${v1}`);
  await sleep(3200);
  assert.equal(await old.evaluate(() => window.VW_TOTAL), mine.total);
  for (const p of [pg, viewer, old]) { assert.deepEqual(p.errors, []); await p.close(); }
});

test("the page cannot reach the network", async () => {
  const pg = await open(`${PAGE}?lang=en`);
  const blocked = await pg.evaluate(() => new Promise((resolve) => {
    const v = [];
    document.addEventListener("securitypolicyviolation", (e) => v.push(e.violatedDirective));
    fetch("https://example.com/x").catch(() => {});
    const i = new Image(); i.src = "https://example.com/x.png";
    navigator.sendBeacon("https://example.com/b", "x");
    setTimeout(() => resolve(v), 800);
  }));
  for (const d of ["connect-src", "img-src"]) assert.ok(blocked.includes(d), `${d} blocked (${blocked})`);
  await pg.close();
});

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test("on a phone: no folder buttons, import is the way in, 'send to computer' carries the friend", async () => {
  const pg = await browser.newPage();
  await pg.setUserAgent(IPHONE);
  await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; pg.on("pageerror", (e) => errors.push(e.message));
  await pg.evaluateOnNewDocument(() => { navigator.share = (d) => { window.__shared = d.url; return Promise.resolve(); }; });
  await pg.goto(`${PAGE}?lang=en`);
  const friend = await pg.evaluate(() => window.VWShare.link(window.VW_DEMO));
  await pg.evaluate((code) => localStorage.setItem("vw-friend", JSON.stringify({ s: code, t: Date.now() })), friend.split("#s=")[1]);
  await pg.goto(`${PAGE}?lang=en&from=friend`); await sleep(300);
  assert.equal(await exists(pg, "#pick-claude"), false, "no folder buttons on a phone");
  assert.match(await text(pg, "#web"), /Import ChatGPT/);
  assert.equal(await pg.$eval("#go", (e) => e.disabled), true);
  await pg.click("#pc"); await sleep(200);
  assert.match(await pg.evaluate(() => window.__shared), /#vs=y/, "the link sent to the computer carries the friend");
  await pg.click("#web"); await sleep(300);
  await (await pg.$(".call-drop input")).uploadFile(zipPath); await sleep(1200);
  await pg.click(".go-recalc"); await sleep(300);
  assert.equal(await pg.$eval("#go", (e) => e.disabled), false);
  await pg.click("#go"); await sleep(1500);
  assert.equal(await pg.$$eval(".slide", (s) => s.some((x) => /You vs them/.test(x.textContent))), true, "comparison page added");
  assert.deepEqual(errors, []);
  await pg.close();
});

test("you vs your friend: their total matches their own bill, labels in the current language", async () => {
  const pg = await open(`${PAGE}?lang=zh`);
  const link = await pg.evaluate(() => window.VWShare.link(window.VW_DEMO));
  const theirs = await open(`${PAGE}?lang=zh&still${link.slice(link.indexOf("#"))}`); await sleep(1200);
  const theirTotal = await theirs.evaluate(() => window.VW_TOTAL); await theirs.close();
  await pg.evaluate((code) => localStorage.setItem("vw-friend", JSON.stringify({ s: code, t: Date.now() })), link.split("#s=")[1]);
  await pg.goto(`${PAGE}?lang=zh&still`);
  await pg.evaluate(() => { const me = JSON.parse(JSON.stringify(window.VW_DEMO)); me.demo = false; me.workHours = 3; me.roast.you.deny = 7; window.__vw.show(me, true); });
  await sleep(1200);
  const cmp = await pg.$$eval(".slide", (s) => { const x = s.find((e) => /你 vs TA/.test(e.textContent)); return x ? x.innerText.replace(/\s+/g, " ") : ""; });
  assert.ok(cmp.includes(theirTotal), `their total ${theirTotal} in: ${cmp.slice(0, 120)}`);
  assert.doesNotMatch(cmp, /undefined/);
  assert.match(cmp, /「继续」/, "friend's catchphrase in Chinese");
  assert.match(cmp, /TA 比你多否定了 AI/);
  // a friend saved more than two weeks ago is forgotten
  await pg.evaluate((code) => localStorage.setItem("vw-friend", JSON.stringify({ s: code, t: Date.now() - 15 * 864e5 })), link.split("#s=")[1]);
  await pg.goto(`${PAGE}?lang=zh&still`);
  await pg.evaluate(() => { const me = JSON.parse(JSON.stringify(window.VW_DEMO)); me.demo = false; window.__vw.show(me, true); });
  await sleep(1000);
  assert.equal(await pg.$$eval(".slide", (s) => s.some((e) => /你 vs TA/.test(e.textContent))), false);
  assert.deepEqual(pg.errors, []);
  await pg.close();
});

test("desktop home page: folder buttons open the picker, also after importing web chats first", async () => {
  const pg = await browser.newPage(); await pg.setViewport({ width: 1280, height: 900 });
  const errors = []; pg.on("pageerror", (e) => errors.push(e.message));
  await pg.evaluateOnNewDocument(() => { window.__picker = []; window.showDirectoryPicker = (o) => { window.__picker.push(o && o.id); return new Promise(() => {}); }; });
  await pg.goto(`${PAGE}?lang=en`); await sleep(300);
  await pg.click("#pick-claude"); await sleep(200);
  assert.match(await text(pg, "#st-claude"), /Copied ~\/\.claude/);
  await pg.click("#web"); await sleep(300);
  await (await pg.$(".call-drop input")).uploadFile(zipPath); await sleep(1200);
  await pg.click(".go-recalc"); await sleep(300);
  await pg.click("#pick-codex"); await sleep(200);
  assert.deepEqual(await pg.evaluate(() => window.__picker), ["claude", "codex"]);
  assert.deepEqual(errors, []);
  await pg.close();
});
