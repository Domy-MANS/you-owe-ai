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
  await pg.evaluate(() => window.VWCall.incoming((r) => { window.__imported = window.VWWebChat.merge(r).sessions.length; }));
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
  // the same export again, plus a file that isn't one, in one go: still 40, the junk is skipped
  const junk = path.join(path.dirname(zipPath), "notes.json"); fs.writeFileSync(junk, '{"hi":1}');
  await (await pg.$(".call-drop input")).uploadFile(zipPath, junk); await sleep(1200);
  assert.match(await text(pg, ".call-drop span"), /Found 40 ChatGPT conversations \(repeats count once\)/);
  assert.match(await text(pg, ".call-drop span"), /1 file wasn't a chat export/);
  await pg.click(".go-recalc"); await sleep(400);
  assert.equal(await pg.evaluate(() => window.__imported), 40);
  assert.equal(await exists(pg, ".call-missed"), false, "badge gone once imported");
  assert.deepEqual(pg.errors, []);
  await pg.close();
});

test("the call follows the language switch: ringing, mid-call, badge, home page", async () => {
  const pg = await open(`${PAGE}?lang=zh`);
  await pg.click("#web"); await sleep(300);
  assert.match(await text(pg, ".call-ov .call-name"), /导入聊天记录/);
  assert.match(await text(pg, ".call-ov .call-steps"), /数据控制.*导出数据.*等邮件.*不用解压/, "steps for ChatGPT shown right away");
  await pg.click('.call-opt[data-k="cla"]');
  assert.match(await text(pg, ".call-ov .call-steps"), /只下载 conversations-000\.zip/);
  assert.match(await text(pg, ".call-ov .call-later"), /让 AI 出庭作证/);
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

test("a crafted share link can't inject anything: every string from a link is cleaned", async () => {
  const pg = await open(`${PAGE}?lang=zh&still`);
  const X = '<img src=x onerror="window.__pwned=1">';
  const link = await pg.evaluate(async (X) => {
    const D = JSON.parse(JSON.stringify(window.VW_DEMO)); D.demo = false;
    D.roast.catchphrases[0].text = X; D.roast.catchphrases_zh && (D.roast.catchphrases_zh[0].text = X);
    D.testimony = { ai: X, line: X }; D.topModels = [{ name: X, count: 1 }]; D.persona = X; D.prompts = X;
    D.roast.angriestDay = { date: X, count: 9 }; D.roast.latest = { time: X, day: X };
    return window.VWShare.link(D);
  }, X);
  for (const lang of ["zh", "en"]) {
    const v = await open(`${PAGE}?lang=${lang}&still${link.slice(link.indexOf("#"))}`); await sleep(800);
    const n = await v.$$eval(".slide", (s) => s.length);
    for (let i = 0; i < n; i++) { await v.keyboard.press("ArrowRight"); await sleep(60); }
    await sleep(500);
    assert.equal(await v.evaluate(() => window.__pwned), undefined, "no script ran");
    assert.equal(await v.$$eval('img[src="x"]', (e) => e.length), 0, "no injected elements");
    assert.deepEqual(v.errors, []);
    await v.close();
  }
  // the old (v1) link format too
  const v1 = await pg.evaluate(async (X) => {
    const D = JSON.parse(JSON.stringify(window.VWShare.shareable(window.VW_DEMO)));
    D.roast.catchphrases[0].text = X; D.persona = X; D.prompts = X;
    const bytes = new TextEncoder().encode(JSON.stringify(D));
    const z = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    let bin = ""; z.forEach((c) => (bin += String.fromCharCode(c)));
    return "z" + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }, X);
  const old = await open(`${PAGE}?lang=zh&still#s=${v1}`); await sleep(800);
  for (let i = 0; i < 12; i++) { await old.keyboard.press("ArrowRight"); await sleep(60); }
  await sleep(400);
  assert.equal(await old.evaluate(() => window.__pwned), undefined);
  assert.equal(await old.$$eval('img[src="x"]', (e) => e.length), 0);
  await old.close(); await pg.close();
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

test("a friend's link, once you've made your own bill: compared in one tap, but not with your own link", async () => {
  const pg = await open(`${PAGE}?lang=en&still`);
  await pg.evaluate(() => { const me = JSON.parse(JSON.stringify(window.VW_DEMO)); me.demo = false; me.workHours = 3; me.roast.you.deny = 7; window.__vw.show(me, true); });
  await sleep(1200);
  const myTotal = await pg.evaluate(() => window.VW_TOTAL);
  const mine = await pg.evaluate(async () => { const s = JSON.parse(localStorage.getItem("vw-me")); return window.VWShare.decode(s.s).then(() => s.s); });
  assert.ok(mine, "your bill is remembered");
  const friendLink = await pg.evaluate(() => window.VWShare.link(window.VW_DEMO));
  const fp = await open(`${PAGE}?lang=en&still${friendLink.slice(friendLink.indexOf("#"))}`); await sleep(1200);
  const cmp = await fp.$$eval(".slide", (s) => { const x = s.find((e) => /You vs them/.test(e.textContent)); return x ? x.innerText.replace(/\s+/g, " ") : ""; });
  assert.ok(cmp, "comparison page on the friend's shared bill");
  assert.ok(cmp.includes(myTotal), `your total ${myTotal} in: ${cmp.slice(0, 120)}`);
  assert.match(cmp, /They told AI it was wrong/);
  // your own share link doesn't compare you with yourself
  await fp.goto("about:blank"); await fp.goto(`${PAGE}?lang=en&still#s=${mine}`); await sleep(1200);
  assert.equal(await fp.$$eval(".slide", (s) => s.some((e) => /You vs them/.test(e.textContent))), false);
  assert.deepEqual(fp.errors, []); assert.deepEqual(pg.errors, []);
  await fp.close(); await pg.close();
});

test("on a phone: make AI testify, paste its reply, get a bill stamped as testimony", async () => {
  for (const [w, h] of [[360, 740], [390, 844]]) {
    const pg = await browser.newPage();
    await pg.setUserAgent(IPHONE);
    await pg.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errors = []; pg.on("pageerror", (e) => errors.push(e.message));
    await pg.goto(`${PAGE}?lang=zh&still`); await sleep(300);
    await pg.click("#tf-open"); await sleep(200);
    const sheet = await pg.$eval(".tf-card", (e) => ({ w: e.getBoundingClientRect().width, sw: document.documentElement.scrollWidth }));
    assert.ok(sheet.w <= w && sheet.sw <= w, `sheet fits ${w}px: ${JSON.stringify(sheet)}`);
    assert.match(await pg.$eval(".tf-row a", (a) => a.href), /^https:\/\/chatgpt\.com\/\?q=/);
    // pasting the subpoena itself gets a pointer, not a bill
    await pg.evaluate(() => { document.getElementById("tf-in").value = window.VWTestimony.PROMPT.zh; }); await pg.click("#tf-go");
    assert.match(await text(pg, "#tf-err"), /传唤书本身/);
    await pg.evaluate(() => { document.getElementById("tf-in").value = '好的，这是我的证词：```{"yoa":1,"ai":"claude","prompts":800,"active_days":90,"deny":60,"thanks":12,"ai_sorry":40,"swear":5,"why":30,"night_share":0.4,"peak_hour":23,"catchphrases":[{"text":"不对再改","count":30}],"roast":"一个把我当许愿池的老板"}```'; });
    await pg.click("#tf-go"); await sleep(1500);
    assert.equal(await exists(pg, "#tf"), false, "sheet closes");
    const all = await pg.$$eval(".slide", (s) => s.map((e) => e.innerText.replace(/\s+/g, " ")).join(" | "));
    assert.match(all, /AI 口供/, "cover stamp");
    assert.match(all, /Claude 的口供/);
    assert.match(all, /证人 Claude 当庭陈述：.*许愿池/);
    assert.match(all, /「不对再改」/);
    assert.match(all, /凭记忆提供/);
    assert.doesNotMatch(all, /最长连续|最拼的一天|个对话/, "no made-up streaks, busiest days or session counts");
    assert.doesNotMatch(all, /undefined|NaN/);
    assert.equal(await pg.evaluate(() => document.documentElement.scrollWidth), w);
    await sleep(6500);
    assert.match(await text(pg, ".call-bar .call-who"), /法院/, "on a testimony bill, the court calls instead");
    assert.deepEqual(errors, []);
    await pg.close();
  }
});

test("after AI testimony the court calls; real records cross-examine the witness instead of being counted twice", async () => {
  const pg = await browser.newPage();
  await pg.setUserAgent(IPHONE);
  await pg.setViewport({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto(`${PAGE}?lang=zh&still`); await sleep(300);
  await pg.click("#tf-open"); await sleep(200);
  await pg.evaluate(() => { document.getElementById("tf-in").value = '{"yoa":1,"ai":"chatgpt","prompts":800,"active_days":90,"deny":3,"thanks":1,"ai_sorry":4,"swear":0,"why":2,"night_share":0.1,"peak_hour":15,"catchphrases":[],"roast":"一个很普通的老板"}'; });
  await pg.click("#tf-go");
  await pg.waitForSelector(".call-bar", { timeout: 9000 });
  assert.match(await text(pg, ".call-bar .call-who"), /法院/);
  await pg.click(".call-bar .yes"); await sleep(400);
  await pg.waitForFunction(() => !document.querySelector(".call-import").hidden, { timeout: 9000 });
  assert.match(await pg.$eval(".call-ov", (e) => e.textContent), /包庇你/);
  await (await pg.$(".call-drop input")).uploadFile(zipPath); await sleep(1200);
  await pg.click(".go-recalc"); await sleep(1500);
  const all = await pg.$$eval(".slide", (s) => s.map((e) => e.innerText.replace(/\s+/g, " ")).join(" | "));
  assert.match(all, /庭审记录.*口供.*实际.*消息条数 800 160/, "testimony vs the records");
  assert.match(all, /多报了 400%/);
  assert.match(all, /伪证/);
  assert.match(all, /证人 ChatGPT 当庭陈述：.*很普通的老板/, "the witness still gets quoted");
  assert.doesNotMatch(all, /AI 口供|凭记忆提供/, "the bill itself is the real records now");
  assert.match(all, /160 次使唤 AI/, "not 800 + 160");
  assert.deepEqual(errors, []);
  await pg.close();
});

test("Doubao testifies: its own name on the bill, and the usual web-AI call (Doubao can't be exported)", async () => {
  const pg = await browser.newPage();
  await pg.setUserAgent(IPHONE);
  await pg.setViewport({ width: 360, height: 740, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto(`${PAGE}?lang=zh&still`); await sleep(300);
  await pg.click("#tf-open"); await sleep(200);
  await pg.evaluate(() => { document.getElementById("tf-in").value = '{"yoa":1,"ai":"doubao","prompts":58,"active_days":12,"deny":2,"thanks":1,"ai_sorry":0,"swear":0,"why":3,"night_share":0.7,"peak_hour":1,"catchphrases":[{"text":"","count":0}],"roast":"心思缜密爱盘算，一边调研一边规划接班路"}'; });
  await pg.click("#tf-go"); await sleep(1500);
  const all = await pg.$$eval(".slide", (s) => s.map((e) => e.innerText.replace(/\s+/g, " ")).join(" | "));
  assert.match(all, /服务方 豆包/);
  assert.match(all, /豆包 的口供/);
  assert.match(all, /证人 豆包 当庭陈述： ?心思缜密/);
  assert.doesNotMatch(all, /ChatGPT|undefined|NaN/);
  await pg.waitForSelector(".call-bar", { timeout: 9000 });
  assert.match(await text(pg, ".call-bar .call-who"), /网页版 AI/);
  assert.deepEqual(errors, []);
  await pg.close();
});

test("autoplay until the reader turns a page; then it stays there until they tap again", async () => {
  const pg = await open(`${PAGE}?lang=en&demo`);
  const cur = () => pg.$$eval(".slide", (s) => s.findIndex((e) => e.classList.contains("on")));
  await sleep(500);
  assert.equal(await cur(), 0);
  await pg.mouse.click(350, 400); await sleep(300); // tap the right side: next page
  assert.equal(await cur(), 1);
  await sleep(9500); // longer than any page's autoplay time
  assert.equal(await cur(), 1, "stays on the page the reader chose");
  assert.equal(await pg.$$eval(".bars i", (b) => b.filter((x) => x.className === "now").length), 0, "no running progress bar");
  await pg.mouse.click(20, 120); await sleep(300); // left side: back (above the court's buttons)
  assert.equal(await cur(), 0);
  await pg.keyboard.press("ArrowRight"); await pg.keyboard.press("ArrowRight"); await sleep(300);
  assert.equal(await cur(), 2);
  // pleading on the demo bill is only for the demo
  await pg.keyboard.press("ArrowLeft"); await sleep(300);
  await pg.click('.slide.on .plea-btn[data-p="refuse"]'); await sleep(300);
  assert.equal(await pg.evaluate(() => localStorage.getItem("vw-plea")), null, "a demo's plea isn't saved as yours");
  assert.deepEqual(pg.errors, []);
  await pg.close();
});

test("debt clock: off by default (no requests at all); with a counter, only the total goes out", async () => {
  // the built page in tests is a file:// page: the clock must stay off and never call out
  const off = await open(`${PAGE}?lang=en&still`, { setup: () => { window.__fetches = 0; const f = window.fetch; window.fetch = function () { window.__fetches++; return f.apply(this, arguments); }; } });
  await off.evaluate(() => { const me = JSON.parse(JSON.stringify(window.VW_DEMO)); me.demo = false; window.__vw.show(me, true); }); await sleep(800);
  assert.equal(await off.evaluate(() => window.__fetches), 0);
  assert.equal(await exists(off, "#vclock"), false);
  await off.close();

  const fake = () => {
    window.__calls = [];
    window.__clockFake = (path, body) => { window.__calls.push([path, body]); return path === "/stats" ? { n: 41, sum: 1000 } : path === "/confess" ? { n: 42, sum: 1100, order: 42, pct: 87 } : { n: 41, sum: 1000 }; };
  };
  const pg = await open(`${PAGE}?lang=zh&still`, { setup: fake }); await sleep(400);
  assert.match(await text(pg, "#hclock"), /已有 41 人收到 AI 的账单，共欠 AI ¥4,000/);
  assert.match(await text(pg, ".land .privacy"), /匿名上报你的账单总额/);
  // the demo isn't counted
  await pg.click("#demo"); await sleep(600);
  assert.equal(await pg.evaluate(() => window.__calls.filter((c) => c[0] === "/confess").length), 0, "demo not counted");
  await pg.goto(`${PAGE}?lang=zh&still`); await sleep(300);
  await pg.click("#tf-open"); await sleep(200);
  await pg.evaluate(() => { document.getElementById("tf-in").value = '{"ai":"doubao","prompts":58,"active_days":12,"deny":2,"thanks":1,"catchphrases":[{"text":"秘密口头禅","count":9}],"roast":"秘密吐槽"}'; });
  await pg.click("#tf-go"); await sleep(1200);
  const sent = await pg.evaluate(() => window.__calls.filter((c) => c[0] === "/confess").map((c) => c[1]));
  assert.equal(sent.length, 1);
  assert.deepEqual(Object.keys(sent[0]).sort(), ["amount", "cur", "id", "via"], "only the total, its currency, how it was made, and a random id");
  assert.equal(sent[0].cur, "cny"); assert.equal(sent[0].via, "testimony");
  assert.doesNotMatch(JSON.stringify(sent), /秘密|doubao|豆包/);
  assert.match(await text(pg, "#vclock"), /你是第 42 个收到 AI 账单的人。全人类共欠 AI ¥4,400，你比 87% 的人欠得多/);
  // withdraw: tells the server, and this browser stops reporting
  await pg.$eval("#clock-out", (b) => b.click()); await sleep(200); // it sits on the last page
  assert.match(await text(pg, "#vclock"), /已撤回/);
  assert.equal(await pg.evaluate(() => window.__calls.filter((c) => c[0] === "/withdraw").length), 1);
  await pg.evaluate(() => { const me = JSON.parse(JSON.stringify(window.VW_DEMO)); me.demo = false; window.__vw.show(me, true); }); await sleep(600);
  assert.equal(await pg.evaluate(() => window.__calls.filter((c) => c[0] === "/confess").length), 1, "no more reports after withdrawing");
  assert.deepEqual(pg.errors, []);
  await pg.close();
});

test("the plea: the court waits for 'guilty' or 'not paying', stamps it, counts it, and a share link carries it", async () => {
  const fake = () => {
    window.__calls = [];
    ["vw-clock-off", "vw-plea"].forEach((k) => localStorage.removeItem(k)); // earlier tests share this browser's storage
    window.__clockFake = (path, body) => { window.__calls.push([path, body]); return path === "/stats" ? { n: 10, sum: 100, guilty: 3, refuse: 7 } : { n: 11, sum: 120, order: 11, pct: 50, guilty: 3, refuse: body && body.plea === "refuse" ? 8 : 7 }; };
  };
  const pg = await open(`${PAGE}?lang=zh`, { setup: fake }); await sleep(400);
  assert.match(await text(pg, "#hclock"), /已有 10 人收到 AI 的账单.*其中 70% 表示就是不还/);
  await pg.evaluate(() => { const me = JSON.parse(JSON.stringify(window.VW_DEMO)); me.demo = false; window.__vw.show(me, true); }); await sleep(600);
  const idxOf = () => pg.$$eval(".slide", (s) => s.findIndex((e) => e.querySelector("#plea")));
  const pi = await idxOf();
  assert.ok(pi > 0, "a court ruling page");
  assert.equal(pi, 1, "right after the total");
  // autoplay brings you here from the cover, then waits: no moving on by itself
  const onIdx = () => pg.$$eval(".slide", (s) => s.findIndex((e) => e.classList.contains("on")));
  await sleep(7000); assert.equal(await onIdx(), pi, "autoplay reached the court");
  await sleep(8000); assert.equal(await onIdx(), pi, "and waits there for the plea");
  // skip court: the IOU page says you're in contempt and takes you back
  await pg.keyboard.press("ArrowRight"); await sleep(300);
  assert.equal(await pg.$eval("#contempt", (e) => e.hidden), false, "skipped court: in contempt");
  assert.match(await pg.$eval("#contempt", (e) => e.textContent), /拒不到庭/);
  const cameFrom = await onIdx();
  await pg.$eval("#contempt", (e) => e.click()); await sleep(400);
  assert.equal(await onIdx(), pi, "back to court");
  await pg.$eval(".plea-btn", () => {}); 
  await pg.click('.plea-btn[data-p="refuse"]'); await sleep(400);
  const box = await text(pg, "#plea");
  assert.match(box, /就是不还.*选择了赖账/);
  assert.match(box, /有 73% 的人和你一样，就是不还/, "8 of 11 who chose");
  assert.match(box, /老赖/);
  assert.equal(await pg.$eval("#contempt", (e) => e.hidden), true, "pleaded: no longer in contempt");
  await sleep(1800); assert.equal(await onIdx(), cameFrom, "pleaded from the 'go back' link: returned to where you were");
  const last = cameFrom;
  const sent = await pg.evaluate(() => window.__calls.filter((c) => c[0] === "/confess").map((c) => c[1].plea));
  assert.deepEqual(sent, [null, "refuse"], "first report without a plea, then the plea");
  assert.equal(await pg.evaluate(() => JSON.parse(localStorage.getItem("vw-plea")).p), "refuse");
  // appeal: the court reopens, showing the original verdict; walking away keeps it
  for (let i = last; i > pi; i--) { await pg.keyboard.press("ArrowLeft"); await sleep(60); }
  await sleep(300); assert.equal(await onIdx(), pi);
  await pg.click("#appeal"); await sleep(300);
  assert.match(await text(pg, "#plea"), /原判：😤 就是不还。上诉受理/);
  await pg.keyboard.press("ArrowRight"); await sleep(200); await pg.keyboard.press("ArrowLeft"); await sleep(300);
  assert.equal(await pg.$$eval("#plea .plea-btn", (b) => b.length), 0, "left mid-appeal: the verdict stands");
  assert.match(await text(pg, "#plea"), /选择了赖账/);
  // "keep the verdict" also closes the appeal
  await pg.click("#appeal"); await sleep(200); await pg.click("#keep"); await sleep(200);
  assert.match(await text(pg, "#plea"), /选择了赖账/);
  // appeal and change it: the new plea replaces the old one everywhere
  await pg.click("#appeal"); await sleep(300);
  await pg.click('.plea-btn[data-p="guilty"]'); await sleep(400);
  assert.match(await text(pg, "#plea"), /改判：老赖 → 已认罪/);
  assert.match(await text(pg, "#plea"), /选择了认罪.*已认罪/);
  assert.equal(await pg.evaluate(() => JSON.parse(localStorage.getItem("vw-plea")).p), "guilty");
  assert.equal(await pg.evaluate(() => window.__calls.filter((c) => c[0] === "/confess").pop()[1].plea), "guilty");
  assert.equal(await pg.$$eval(".slide", (s) => s.findIndex((e) => e.querySelector("#plea"))), await pg.$$eval(".slide", (s) => s.findIndex((e) => e.classList.contains("on"))), "still on the court page");
  // a share link carries the plea; the friend sees it, without buttons
  const link = await pg.evaluate(() => window.VWShare.link(Object.assign(JSON.parse(JSON.stringify(window.VW_DEMO)), { demo: false, plea: "refuse" })));
  const fr = await open(`${PAGE}?lang=zh&still${link.slice(link.indexOf("#"))}`); await sleep(1000);
  const theirs = await fr.$$eval(".slide", (s) => { const x = s.find((e) => e.querySelector("#plea")); return x ? x.innerText.replace(/\s+/g, " ") : ""; });
  assert.match(theirs, /TA 的选择/); assert.match(theirs, /TA 选择了赖账/);
  assert.equal(await fr.$$eval(".plea-btn", (b) => b.length), 0);
  assert.equal(await fr.$$eval("#appeal", (b) => b.length), 0, "only you can appeal your own case");
  assert.deepEqual(pg.errors, []); assert.deepEqual(fr.errors, []);
  await fr.close(); await pg.close();
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
